const dayKey = (date, offset) =>
  new Date(+new Date(date) + offset * 3600000).toISOString().slice(0, 10);
const MONTH_PERIODS = { "3m": 3, "6m": 6, "12m": 12 };

export function periodStart(today, period) {
  if (period === "all") return null;
  const date = new Date(`${today}T00:00:00Z`);
  const months = MONTH_PERIODS[period];
  if (months) {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  } else date.setUTCDate(date.getUTCDate() - (period - 1));
  return date.toISOString().slice(0, 10);
}

export async function loadFeedings(request, { allTime = false, now = Date.now() } = {}) {
  const params = new URLSearchParams();
  if (!allTime) params.set("from", new Date(now - 32 * 86400000).toISOString());
  const items = [];
  let cursor;
  do {
    if (cursor) params.set("cursor", cursor);
    const query = params.toString();
    const batch = await request(`/feedings${query ? `?${query}` : ""}`);
    items.push(...batch.items);
    cursor = batch.nextCursor;
  } while (cursor);
  return items;
}

export function feedingIntervals(sorted) {
  const lastByChild = new Map();
  const intervals = new Map();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const record = sorted[i];
    const previous = lastByChild.get(record.childId);
    const time = +new Date(record.fedAt);
    intervals.set(record._id, previous === undefined ? null : time - previous);
    lastByChild.set(record.childId, time);
  }
  return intervals;
}

export function periodStatistics(records, { period, childId = "all", today, offset }) {
  const allTime = period === "all";
  const cutoff = periodStart(today, period);
  const rows = records.filter(r => {
    if (childId !== "all" && r.childId !== childId) return false;
    if (allTime) return true;
    const day = dayKey(r.fedAt, offset);
    return day >= cutoff && day <= today;
  });
  const rowDays = rows.map(r => dayKey(r.fedAt, offset)).sort();
  const firstDay = allTime ? rowDays[0] || today : cutoff;
  const lastDay = allTime && rowDays.at(-1) > today ? rowDays.at(-1) : today;
  const monthly = Boolean(MONTH_PERIODS[period]) || allTime && (+new Date(lastDay) - +new Date(firstDay)) / 86400000 >= 31;
  const date = new Date(`${monthly ? firstDay.slice(0, 7) + "-01" : firstDay}T00:00:00Z`);
  const end = new Date(`${lastDay}T00:00:00Z`);
  const buckets = [];
  const byKey = new Map();
  while (date <= end) {
    const key = date.toISOString().slice(0, 10);
    const bucket = { key, total: 0, children: new Map() };
    buckets.push(bucket);
    byKey.set(key, bucket);
    if (monthly) date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCDate(date.getUTCDate() + 1);
  }
  for (const row of rows) {
    const day = dayKey(row.fedAt, offset);
    const bucket = byKey.get(monthly ? `${day.slice(0, 7)}-01` : day);
    bucket.total += row.consumedMl;
    bucket.children.set(row.childId, (bucket.children.get(row.childId) || 0) + row.consumedMl);
  }
  return { rows, firstDay, buckets, monthly };
}
