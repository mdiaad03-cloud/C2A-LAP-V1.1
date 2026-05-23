import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { applySaleFilters, buildProfitSummary } from "../services/analyticsService.js";
import { syncSalesWorkbook } from "../services/excelAutoSaveService.js";
import { nowIso } from "../utils/dateUtils.js";

const router = Router();

router.use(authenticate, csrfProtect, authorize("admin"));

async function syncSalesExcelSafe(sales) {
  try {
    await syncSalesWorkbook(sales);
  } catch (error) {
    console.error("Auto Excel sync failed:", error);
  }
}

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const filteredSales = applySaleFilters(db.sales, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      brand: req.query.brand,
      employee: req.query.employee,
      warrantyStatus: req.query.warrantyStatus,
      query: req.query.query,
    });

    const summary = buildProfitSummary(filteredSales);

    res.json({
      summary,
      salesCount: summary.effectiveSalesCount,
    });
  }),
);

router.delete(
  "/clear",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const filteredSales = applySaleFilters(db.sales, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      brand: req.query.brand,
      employee: req.query.employee,
      warrantyStatus: req.query.warrantyStatus,
      query: req.query.query,
    });

    const targetIds = new Set(filteredSales.map((sale) => sale.id));
    let clearedCount = 0;

    for (const sale of db.sales) {
      if (!targetIds.has(sale.id)) {
        continue;
      }
      if (Number(sale.profit || 0) === 0) {
        continue;
      }

      sale.profit = 0;
      sale.updatedAt = nowIso();
      clearedCount += 1;
    }

    if (clearedCount > 0) {
      await saveDb();
      await syncSalesExcelSafe(db.sales);
    }

    await addLog({
      action: "delete",
      module: "profits",
      user: req.user,
      details: `Cleared profits for ${clearedCount} sales`,
      ip: req.ip,
    });

    res.json({
      success: true,
      clearedCount,
    });
  }),
);

export default router;
