const CJK = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/;

export function detectLang(text: string): "ja" | "en" {
  return CJK.test(text) ? "ja" : "en";
}
