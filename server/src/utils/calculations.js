import dayjs from "dayjs";
import { daysBetween, todayDate } from "./dateUtils.js";

export function calculateWarranty(inputDate, warrantyMonths) {
  const purchaseDate = inputDate ? dayjs(inputDate) : dayjs(todayDate());
  const normalizedMonths = Number(warrantyMonths) > 0 ? Number(warrantyMonths) : 1;

  const warrantyEnd = purchaseDate.add(normalizedMonths, "month").endOf("day");
  const replacementDeadline = purchaseDate.add(Math.min(normalizedMonths, 1), "month").endOf("day");
  const returnDeadline = purchaseDate.add(14, "day").endOf("day");

  const warrantyDaysRemaining = Math.max(daysBetween(dayjs(), warrantyEnd), 0);
  const replacementExpired = dayjs().isAfter(replacementDeadline);
  const returnExpired = dayjs().isAfter(returnDeadline);

  return {
    purchaseDate: purchaseDate.format("YYYY-MM-DD"),
    warrantyMonths: normalizedMonths,
    warrantyEndDate: warrantyEnd.format("YYYY-MM-DD"),
    replacementDeadline: replacementDeadline.format("YYYY-MM-DD"),
    returnDeadline: returnDeadline.format("YYYY-MM-DD"),
    warrantyDaysRemaining,
    replacementExpired,
    returnExpired,
  };
}

export function calculateProfit(sellingPrice, purchasePrice, shippingCost) {
  return Number(sellingPrice) - Number(purchasePrice) - Number(shippingCost || 0);
}
