import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, csrfProtect } from "../middleware/auth.js";
import { getDb } from "../data/db.js";
import { applySaleFilters, buildDashboardCards } from "../services/analyticsService.js";

const router = Router();

router.use(authenticate, csrfProtect);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const visibleSales = req.user.role === "admin"
      ? db.sales
      : db.sales.filter((sale) => sale.createdBy === req.user.id);

    const filteredSales = applySaleFilters(visibleSales, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      brand: req.query.brand,
      employee: req.query.employee,
      warrantyStatus: req.query.warrantyStatus,
      query: req.query.query,
    });

    const cards = buildDashboardCards({
      sales: filteredSales,
      contacts: db.contacts,
      users: db.users,
      products: db.products,
      onlineOrders: db.onlineOrders,
      role: req.user.role,
    });

    res.json({
      role: req.user.role,
      ...cards,
    });
  }),
);

export default router;
