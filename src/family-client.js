import { API_URL } from "./data";
export const ROLE_NAMES = {
  owner: "Власник",
  editor: "Годування",
  viewer: "Лише перегляд",
};
export const PALETTES = [
  { id: "sage", name: "М’ята" },
  { id: "peach", name: "Персик" },
  { id: "blue", name: "Блакитний" },
  { id: "lavender", name: "Лавандовий" },
  { id: "sand", name: "Пісочний" },
  { id: "rose", name: "Трояндовий" },
  { id: "aqua", name: "Бірюзовий" },
  { id: "butter", name: "Ванільний" },
  { id: "apricot", name: "Абрикосовий" },
];
export const EMOJIS = [
  "🐣",
  "🦁",
  "🐻",
  "🐰",
  "🐼",
  "🦊",
  "🐨",
  "🐯",
  "🐸",
  "🐥",
  "🦄",
  "🐱",
  "🌻",
  "⭐",
  "🌙",
  "🍓",
  "🐶",
  "🐧",
  "🐢",
  "🦋",
];
export async function api(path, options = {}, token = "") {
  if (!API_URL)
    throw new Error(
      "Для створення родин відкрийте локальний перегляд з тестовим API. Демо працює без сервера.",
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : {};
    if (!response.ok) {
      const error = new Error(
        data.error ||
          (response.status === 429
            ? "Забагато спроб. Спробуйте пізніше."
            : "Сервер тимчасово недоступний."),
      );
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (e) {
    if (e.name === "AbortError" || e instanceof TypeError)
      throw new Error("Немає зв’язку із сервером. Спробуйте ще раз.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
export function download(name, content, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(value) {
  if (!navigator.clipboard?.writeText)
    throw new Error("Скопіюйте код вручну з поля.");
  await navigator.clipboard.writeText(value);
}
export function inviteLink(code) {
  return `${location.origin}${location.pathname}#join=${encodeURIComponent(code)}`;
}
