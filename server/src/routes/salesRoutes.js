import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { applySaleFilters } from "../services/analyticsService.js";
import { syncSalesWorkbook } from "../services/excelAutoSaveService.js";
import { calculateProfit, calculateWarranty } from "../utils/calculations.js";
import { nowIso } from "../utils/dateUtils.js";
import {
  asOptionalText,
  requirePositiveInteger,
  requirePositiveNumber,
  requireText,
} from "../utils/validation.js";

const router = Router();

router.use(authenticate, csrfProtect);

async function syncSalesExcelSafe(sales) {
  try {
    await syncSalesWorkbook(sales);
  } catch (error) {
    console.error("Auto Excel sync failed:", error);
  }
}

function shapeSaleForViewer(sale, role) {
  if (role === "admin") {
    return sale;
  }

  return {
    ...sale,
    purchasePrice: undefined,
    profit: undefined,
  };
}

function refreshSaleWarranty(sale) {
  const updated = calculateWarranty(sale.purchaseDate, sale.warrantyMonths);
  return {
    ...sale,
    replacementExpired: updated.replacementExpired,
    returnExpired: updated.returnExpired,
    warrantyDaysRemaining: updated.warrantyDaysRemaining,
    replacementDeadline: sale.replacementDeadline || updated.replacementDeadline,
    returnDeadline: sale.returnDeadline || updated.returnDeadline,
    warrantyEndDate: sale.warrantyEndDate || updated.warrantyEndDate,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    let sales = db.sales.map(refreshSaleWarranty);
    if (req.user.role === "sales") {
      sales = sales.filter((sale) => sale.createdBy === req.user.id);
    }

    sales = applySaleFilters(sales, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      brand: req.query.brand,
      employee: req.query.employee,
      warrantyStatus: req.query.warrantyStatus,
      query: req.query.query,
    });

    sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      sales: sales.map((sale) => shapeSaleForViewer(sale, req.user.role)),
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const laptopName = requireText(req.body.laptopName, "Laptop name");
    const brand = requireText(req.body.brand, "Brand");
    const ram = requireText(req.body.ram, "RAM");
    const storage = requireText(req.body.storage, "Storage");

    const purchasePrice = requirePositiveNumber(req.body.purchasePrice, "Purchase price");
    const sellingPrice = requirePositiveNumber(req.body.sellingPrice, "Selling price");
    const shippingCost = requirePositiveNumber(req.body.shippingCost || 0, "Shipping cost");

    const warrantyMonths = requirePositiveInteger(req.body.warrantyMonths || 3, "Warranty duration");
    const warranty = calculateWarranty(req.body.purchaseDate, warrantyMonths);

    const sale = {
      id: nanoid(),
      laptopName,
      brand,
      ram,
      storage,
      purchasePrice,
      sellingPrice,
      shippingCost,
      profit: Number(calculateProfit(sellingPrice).toFixed(2)),
      purchaseDate: warranty.purchaseDate,
      warrantyMonths: warranty.warrantyMonths,
      warrantyEndDate: warranty.warrantyEndDate,
      replacementDeadline: warranty.replacementDeadline,
      returnDeadline: warranty.returnDeadline,
      warrantyDaysRemaining: warranty.warrantyDaysRemaining,
      replacementExpired: warranty.replacementExpired,
      returnExpired: warranty.returnExpired,
      shippingCompanyName: asOptionalText(req.body.shippingCompanyName),
      shippingCompanyPhone: asOptionalText(req.body.shippingCompanyPhone),
      trackingNumber: asOptionalText(req.body.trackingNumber),
      representativeName: asOptionalText(req.body.representativeName),
      clientName: asOptionalText(req.body.clientName),
      clientPhone: asOptionalText(req.body.clientPhone),
      clientAddress: asOptionalText(req.body.clientAddress),
      notes: asOptionalText(req.body.notes),
      createdBy: req.user.id,
      createdByName: req.user.name,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.sales.push(sale);

    if (sale.clientName || sale.clientPhone) {
      const normalizedPhone = sale.clientPhone.toLowerCase();
      let contact = db.contacts.find(
        (entry) =>
          (normalizedPhone && entry.phone.toLowerCase() === normalizedPhone) ||
          (!normalizedPhone && entry.name.toLowerCase() === sale.clientName.toLowerCase()),
      );

      if (!contact) {
        contact = {
          id: nanoid(),
          name: sale.clientName || "Unnamed Client",
          phone: sale.clientPhone || "",
          address: sale.clientAddress || "",
          notes: sale.notes || "",
          purchaseHistory: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        db.contacts.push(contact);
      }

      contact.purchaseHistory ||= [];
      contact.purchaseHistory.unshift({
        saleId: sale.id,
        laptopName: sale.laptopName,
        sellingPrice: sale.sellingPrice,
        purchaseDate: sale.purchaseDate,
      });
      contact.updatedAt = nowIso();
    }

    await saveDb();
    await syncSalesExcelSafe(db.sales);

    await addLog({
      action: "create",
      module: "sales",
      user: req.user,
      details: `Added sale ${sale.id} for ${sale.laptopName}`,
      ip: req.ip,
    });

    res.status(201).json({ sale: shapeSaleForViewer(sale, req.user.role) });
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admin can edit sales records." });
    }

    const db = await getDb();
    const sale = db.sales.find((entry) => entry.id === req.params.id);

    if (!sale) {
      return res.status(404).json({ error: "Sale not found." });
    }

    sale.laptopName = req.body.laptopName ? requireText(req.body.laptopName, "Laptop name") : sale.laptopName;
    sale.brand = req.body.brand ? requireText(req.body.brand, "Brand") : sale.brand;
    sale.ram = req.body.ram ? requireText(req.body.ram, "RAM") : sale.ram;
    sale.storage = req.body.storage ? requireText(req.body.storage, "Storage") : sale.storage;

    if (req.body.purchasePrice !== undefined) {
      sale.purchasePrice = requirePositiveNumber(req.body.purchasePrice, "Purchase price");
    }

    if (req.body.sellingPrice !== undefined) {
      sale.sellingPrice = requirePositiveNumber(req.body.sellingPrice, "Selling price");
    }

    if (req.body.shippingCost !== undefined) {
      sale.shippingCost = requirePositiveNumber(req.body.shippingCost, "Shipping cost");
    }

    if (req.body.warrantyMonths !== undefined || req.body.purchaseDate !== undefined) {
      const warranty = calculateWarranty(req.body.purchaseDate || sale.purchaseDate, req.body.warrantyMonths || sale.warrantyMonths);
      sale.purchaseDate = warranty.purchaseDate;
      sale.warrantyMonths = warranty.warrantyMonths;
      sale.warrantyEndDate = warranty.warrantyEndDate;
      sale.replacementDeadline = warranty.replacementDeadline;
      sale.returnDeadline = warranty.returnDeadline;
      sale.warrantyDaysRemaining = warranty.warrantyDaysRemaining;
      sale.replacementExpired = warranty.replacementExpired;
      sale.returnExpired = warranty.returnExpired;
    }

    sale.profit = Number(calculateProfit(sale.sellingPrice).toFixed(2));
    sale.updatedAt = nowIso();

    await saveDb();
    await syncSalesExcelSafe(db.sales);

    await addLog({
      action: "update",
      module: "sales",
      user: req.user,
      details: `Edited sale ${sale.id}`,
      ip: req.ip,
    });

    res.json({ sale });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admin can delete sales records." });
    }

    const db = await getDb();
    const index = db.sales.findIndex((entry) => entry.id === req.params.id);
    if (index < 0) {
      return res.status(404).json({ error: "Sale not found." });
    }

    const [deleted] = db.sales.splice(index, 1);
    await saveDb();
    await syncSalesExcelSafe(db.sales);

    await addLog({
      action: "delete",
      module: "sales",
      user: req.user,
      details: `Deleted sale ${deleted.id}`,
      ip: req.ip,
    });

    res.json({ success: true });
  }),
);

export default router;
