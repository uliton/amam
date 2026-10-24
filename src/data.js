export const CHILDREN = [
  {
    id: "leon",
    name: "Леон",
    emoji: "🦁",
    color: "sage",
    hint: "Наш маленький лев",
  },
  {
    id: "luka",
    name: "Лука",
    emoji: "🐻",
    color: "peach",
    hint: "Наш маленький ведмедик",
  },
];
export const REVIEW_MODE = import.meta.env.MODE === "review";
// Review never connects to the production API, even if an API URL is present in the environment.
export const API_URL = REVIEW_MODE
  ? ""
  : (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const storageKey = (key) => (REVIEW_MODE ? `amam.review.${key}` : key);
export function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(key))) ?? fallback;
  } catch {
    return fallback;
  }
}
export function store(key, value) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    /* Storage may be disabled. */
  }
}
export function elapsed(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const m = Math.floor(ms / 60000);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function dateKey(date, offset) {
  return new Date(+new Date(date) + offset * 3600000)
    .toISOString()
    .slice(0, 10);
}
export function timeLabel(date, offset) {
  return new Date(+new Date(date) + offset * 3600000)
    .toISOString()
    .slice(11, 16);
}
export function localInput(date, offset) {
  return new Date(+new Date(date) + offset * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function inputISO(value, offset) {
  const n = Date.parse(value + ":00Z") - offset * 3600000;
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
export function demoFeedings() {
  const now = Date.now();
  return Array.from({ length: 48 }, (_, i) => ({
    _id: `demo-${i}`,
    childId: i % 2 ? "luka" : "leon",
    offeredMl: i % 3 ? 150 : 120,
    consumedMl: [120, 105, 130, 110, 90, 140][i % 6],
    spitUp: i % 7 === 0,
    fedAt: new Date(now - (i * 80 + 48) * 60000).toISOString(),
  })).map((x) => ({ ...x, consumedMl: Math.min(x.consumedMl, x.offeredMl) }));
}
export async function request(path, options = {}) {
  if (!API_URL) throw new Error("Адресу API ще не налаштовано.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${readStored("amam.key", "")}`,
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Сервер тимчасово недоступний.");
    return data;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError)
      throw new Error(
        "Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
