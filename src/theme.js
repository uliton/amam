export const THEME_OPTIONS = ["auto", "day", "night"];
export function resolveTheme(preference, now = new Date()) {
  if (preference === "day" || preference === "night") return preference;
  const hour = now.getHours();
  return hour >= 7 && hour < 21 ? "day" : "night";
}
export function nextThemeChange(now = new Date()) {
  const next = new Date(now);
  if (now.getHours() < 7) next.setHours(7, 0, 0, 0);
  else if (now.getHours() < 21) next.setHours(21, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
  }
  return next;
}
