import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb } from "../data/db.js";

const router = Router();

router.use(authenticate, csrfProtect, authorize("admin"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const limit = Math.min(Number(req.query.limit || 200), 1000);
    res.json({ logs: db.logs.slice(0, limit) });
  }),
);

export default router;
