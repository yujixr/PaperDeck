import { FONT_SIZE_KEY } from "./storageKeys";

export type FontSize = "small" | "medium" | "large";

const VALID: ReadonlySet<string> = new Set(["small", "medium", "large"]);

export function loadFontSize(): FontSize {
  const v = localStorage.getItem(FONT_SIZE_KEY);
  return v && VALID.has(v) ? (v as FontSize) : "medium";
}

export function saveFontSize(size: FontSize): void {
  localStorage.setItem(FONT_SIZE_KEY, size);
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.dataset.fontsize = size;
}
