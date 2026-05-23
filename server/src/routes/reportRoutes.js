import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb } from "../data/db.js";
import { applySaleFilters, buildProfitSummary } from "../services/analyticsService.js";

const router = Router();

router.use(authenticate, csrfProtect, authorize("admin"));

router.get(
  "/excel",
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

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    sheet.addRow(["Metric", "Value"]);
    sheet.addRow(["Total Revenue", summary.totalRevenue]);
    sheet.addRow(["Total Purchase Cost", summary.totalPurchaseCost]);
    sheet.addRow(["Total Shipping Cost", summary.totalShippingCost]);
    sheet.addRow(["Net Profit", summary.netProfit]);
    sheet.addRow([]);

    sheet.addRow([
      "Sale ID",
      "Laptop",
      "Brand",
      "Purchase Price",
      "Selling Price",
      "Shipping",
      "Profit",
      "Purchase Date",
      "Warranty Remaining",
      "Employee",
    ]);

    for (const sale of filteredSales) {
      sheet.addRow([
        sale.id,
        sale.laptopName,
        sale.brand,
        sale.purchasePrice,
        sale.sellingPrice,
        sale.shippingCost,
        sale.profit,
        sale.purchaseDate,
        sale.warrantyDaysRemaining,
        sale.createdByName,
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="c2a-sales-report-${Date.now()}.xlsx"`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(Buffer.from(buffer));
  }),
);

router.get(
  "/pdf",
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

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="c2a-sales-report-${Date.now()}.pdf"`,
      );
      res.send(pdf);
    });

    doc.fontSize(18).text("C2A LAP Sales Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Total Revenue: ${summary.totalRevenue.toFixed(2)}`);
    doc.text(`Total Purchase Cost: ${summary.totalPurchaseCost.toFixed(2)}`);
    doc.text(`Total Shipping Cost: ${summary.totalShippingCost.toFixed(2)}`);
    doc.text(`Net Profit: ${summary.netProfit.toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(11).text("Recent Sales");
    doc.moveDown(0.5);

    filteredSales.slice(0, 40).forEach((sale, index) => {
      doc
        .fontSize(9)
        .text(
          `${index + 1}. ${sale.laptopName} | ${sale.brand} | Sell: ${sale.sellingPrice} | Profit: ${sale.profit} | ${sale.purchaseDate} | ${sale.createdByName}`,
        );
    });

    doc.end();
  }),
);

export default router;
