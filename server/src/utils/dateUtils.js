import dayjs from "dayjs";

export function nowIso() {
  return dayjs().toISOString();
}

export function todayDate() {
  return dayjs().format("YYYY-MM-DD");
}

export function formatDate(value) {
  return dayjs(value).format("YYYY-MM-DD");
}

export function daysBetween(fromDate, toDate) {
  return dayjs(toDate).startOf("day").diff(dayjs(fromDate).startOf("day"), "day");
}

export function inDateRange(value, from, to) {
  const target = dayjs(value);
  if (from && target.isBefore(dayjs(from), "day")) {
    return false;
  }
  if (to && target.isAfter(dayjs(to), "day")) {
    return false;
  }
  return true;
}
