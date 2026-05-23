import dayjs from "dayjs";

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export const number = new Intl.NumberFormat("en-US");

export function formatDate(value) {
  if (!value) {
    return "-";
  }
  return dayjs(value).format("YYYY-MM-DD");
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return dayjs(value).format("YYYY-MM-DD HH:mm");
}
