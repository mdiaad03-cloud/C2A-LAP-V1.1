import fs from "node:fs/promises";
import path from "node:path";
import dayjs from "dayjs";
import ExcelJS from "exceljs";

const exportsDir = path.resolve("exports");
const salesWorkbookPath = path.join(exportsDir, "sales_autosave.xlsx");

function sanitizeSheetName(name) {
  return String(name || "Unknown")
    .replace(/[\\/?*\[\]:]/g, "_")
    .slice(0, 31);
}

function baseColumns() {
  return [
    { header: "Sale ID", key: "id", width: 20 },
    { header: "Created At", key: "createdAt", width: 22 },
    { header: "Created By", key: "createdByName", width: 22 },
    { header: "Laptop Name", key: "laptopName", width: 28 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "RAM", key: "ram", width: 14 },
    { header: "Storage", key: "storage", width: 18 },
    { header: "Purchase Price", key: "purchasePrice", width: 16 },
    { header: "Selling Price", key: "sellingPrice", width: 16 },
    { header: "Shipping Cost", key: "shippingCost", width: 14 },
    { header: "Profit", key: "profit", width: 14 },
    { header: "Purchase Date", key: "purchaseDate", width: 14 },
    { header: "Warranty Months", key: "warrantyMonths", width: 16 },
    { header: "Warranty End", key: "warrantyEndDate", width: 14 },
    { header: "Warranty Days Remaining", key: "warrantyDaysRemaining", width: 24 },
    { header: "Replacement Deadline", key: "replacementDeadline", width: 18 },
    { header: "Replacement Expired", key: "replacementExpired", width: 18 },
    { header: "Return Deadline", key: "returnDeadline", width: 16 },
    { header: "Return Expired", key: "returnExpired", width: 14 },
    { header: "Client Name", key: "clientName", width: 20 },
    { header: "Client Phone", key: "clientPhone", width: 18 },
    { header: "Client Address", key: "clientAddress", width: 28 },
    { header: "Shipping Company", key: "shippingCompanyName", width: 22 },
    { header: "Shipping Phone", key: "shippingCompanyPhone", width: 18 },
    { header: "Tracking Number", key: "trackingNumber", width: 22 },
    { header: "Representative", key: "representativeName", width: 20 },
    { header: "Notes", key: "notes", width: 34 },
  ];
}

function addSalesRows(sheet, sales) {
  for (const sale of sales) {
    sheet.addRow({
      ...sale,
      createdAt: sale.createdAt ? dayjs(sale.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
    });
  }
}

function styleHeader(sheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
}

export async function syncSalesWorkbook(sales) {
  await fs.mkdir(exportsDir, { recursive: true });

  const workbook = new ExcelJS.Workbook();

  const allSalesSheet = workbook.addWorksheet("All Sales");
  allSalesSheet.columns = baseColumns();
  addSalesRows(allSalesSheet, sales);
  styleHeader(allSalesSheet);

  const byUser = {};
  for (const sale of sales) {
    const key = sale.createdByName || "Unknown";
    byUser[key] ||= [];
    byUser[key].push(sale);
  }

  for (const [username, userSales] of Object.entries(byUser)) {
    const sheet = workbook.addWorksheet(sanitizeSheetName(username));
    sheet.columns = baseColumns();
    addSalesRows(sheet, userSales);
    styleHeader(sheet);
  }

  await workbook.xlsx.writeFile(salesWorkbookPath);
}

export function getSalesWorkbookPath() {
  return salesWorkbookPath;
}
