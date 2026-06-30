import dayjs from "dayjs";
import { inDateRange } from "../utils/dateUtils.js";

export function applySaleFilters(sales, filters = {}) {
  const {
    dateFrom,
    dateTo,
    brand,
    employee,
    warrantyStatus,
    query,
  } = filters;

  return sales.filter((sale) => {
    if (!inDateRange(sale.purchaseDate, dateFrom, dateTo)) {
      return false;
    }

    if (brand && sale.brand.toLowerCase() !== String(brand).toLowerCase()) {
      return false;
    }

    if (employee && sale.createdBy !== employee) {
      return false;
    }

    if (warrantyStatus === "active" && sale.warrantyDaysRemaining <= 0) {
      return false;
    }
    if (warrantyStatus === "expired" && sale.warrantyDaysRemaining > 0) {
      return false;
    }
    if (warrantyStatus === "return-expired" && !sale.returnExpired) {
      return false;
    }
    if (warrantyStatus === "replacement-expired" && !sale.replacementExpired) {
      return false;
    }

    if (query) {
      const text = String(query).toLowerCase();
      const searchable = [
        sale.laptopName,
        sale.brand,
        sale.ram,
        sale.storage,
        sale.clientName,
        sale.clientPhone,
        sale.createdByName,
        sale.trackingNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(text)) {
        return false;
      }
    }

    return true;
  });
}

export function buildProfitSummary(sales) {
  const effectiveSales = sales.filter((sale) => {
    if (sale.source !== "online-store") {
      return true;
    }
    const status = String(sale.onlineOrderStatus || "").toLowerCase();
    return !["pending", "cancelled"].includes(status);
  });

  const totalRevenue = effectiveSales.reduce((sum, sale) => sum + Number(sale.sellingPrice), 0);
  const totalPurchaseCost = effectiveSales.reduce((sum, sale) => sum + Number(sale.purchasePrice), 0);
  const totalShippingCost = effectiveSales.reduce((sum, sale) => sum + Number(sale.shippingCost), 0);
  const netProfit = effectiveSales.reduce((sum, sale) => sum + Number(sale.profit), 0);

  const monthlyMap = {};
  const brandMap = {};
  const employeeMap = {};
  const productMap = {};

  for (const sale of effectiveSales) {
    const month = dayjs(sale.purchaseDate).format("YYYY-MM");
    monthlyMap[month] = (monthlyMap[month] || 0) + Number(sale.profit);

    brandMap[sale.brand] = (brandMap[sale.brand] || 0) + 1;

    const productKey = String(sale.laptopName || sale.brand || "Unknown").trim() || "Unknown";
    productMap[productKey] ||= {
      laptopName: sale.laptopName || "Unknown",
      brand: sale.brand || "",
      quantity: 0,
      revenue: 0,
      profit: 0,
    };
    productMap[productKey].quantity += Math.max(1, Number(sale.quantity || 1));
    productMap[productKey].revenue += Number(sale.sellingPrice || 0);
    productMap[productKey].profit += Number(sale.profit || 0);

    employeeMap[sale.createdByName] ||= {
      employeeId: sale.createdBy,
      employeeName: sale.createdByName,
      salesCount: 0,
      revenue: 0,
      profit: 0,
    };

    employeeMap[sale.createdByName].salesCount += 1;
    employeeMap[sale.createdByName].revenue += Number(sale.sellingPrice);
    employeeMap[sale.createdByName].profit += Number(sale.profit);
  }

  const monthlyProfit = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value: Number(value.toFixed(2)) }));

  const employeePerformance = Object.values(employeeMap).sort((a, b) => b.profit - a.profit);
  const bestSellingBrand = Object.entries(brandMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const bestSellingProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 8)
    .map((item) => ({
      ...item,
      revenue: Number(item.revenue.toFixed(2)),
      profit: Number(item.profit.toFixed(2)),
    }));

  return {
    effectiveSalesCount: effectiveSales.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalPurchaseCost: Number(totalPurchaseCost.toFixed(2)),
    totalShippingCost: Number(totalShippingCost.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    monthlyProfit,
    employeePerformance,
    bestSellingBrand,
    bestSellingProducts,
  };
}

export function buildDashboardCards({ sales, contacts, users, products, role, onlineOrders = [] }) {
  const summary = buildProfitSummary(sales);

  const activeWarrantyCount = sales.filter((sale) => sale.warrantyDaysRemaining > 0).length;
  const expiringSoonCount = sales.filter(
    (sale) => sale.warrantyDaysRemaining > 0 && sale.warrantyDaysRemaining <= 30,
  ).length;

  const topSalesUsers = summary.employeePerformance.slice(0, 5);
  const lowStockProducts = products.filter((item) => Number(item.stock || 0) <= 3);
  const convertedOnlineOrders = onlineOrders.filter((order) =>
    ["confirmed", "shipped", "delivered"].includes(order.status),
  );
  const pendingOnlineOrders = onlineOrders.filter((order) => order.status === "pending").length;
  const onlineRevenue = convertedOnlineOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const onlineConversionRate = onlineOrders.length > 0
    ? Number(((convertedOnlineOrders.length / onlineOrders.length) * 100).toFixed(2))
    : 0;

  const salesVolumeByMonthMap = {};
  for (const sale of sales) {
    const month = dayjs(sale.purchaseDate).format("YYYY-MM");
    salesVolumeByMonthMap[month] = (salesVolumeByMonthMap[month] || 0) + 1;
  }

  const salesVolumeByMonth = Object.entries(salesVolumeByMonthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));

  return {
    kpis: {
      totalSalesRecords: Number(summary.effectiveSalesCount || sales.length),
      totalContacts: contacts.length,
      totalProducts: products.length,
      activeUsers: users.filter((user) => user.isActive).length,
      activeWarrantyCount,
      expiringSoonCount,
      netProfit: summary.netProfit,
      ...(role === "admin"
        ? {
            totalRevenue: summary.totalRevenue,
            totalPurchaseCost: summary.totalPurchaseCost,
            totalShippingCost: summary.totalShippingCost,
            totalOnlineOrders: onlineOrders.length,
            pendingOnlineOrders,
            onlineRevenue: Number(onlineRevenue.toFixed(2)),
            onlineConversionRate,
          }
        : {}),
    },
    charts: {
      monthlyProfit: role === "admin" ? summary.monthlyProfit : salesVolumeByMonth,
      employeePerformance: role === "admin" ? summary.employeePerformance : topSalesUsers,
      topSalesUsers,
      bestSellingBrand: summary.bestSellingBrand,
      bestSellingProducts: summary.bestSellingProducts,
      lowStockProducts,
    },
  };
}
