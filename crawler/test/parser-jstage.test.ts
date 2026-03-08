import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseJstage } from "../src/parser-jstage";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("J-STAGE parser", () => {
  const html = readFileSync(join(__dirname, "fixtures/jstage-sample.html"), "utf-8");
  const url = "https://www.jstage.jst.go.jp/browse/jscejj/80/1/_contents/-char/ja";

  it("extracts papers from HTML", () => {
    const papers = parseJstage(html, url);
    expect(papers).toHaveLength(16);
  });

  it("extracts journal name as conference_name", () => {
    const papers = parseJstage(html, url);
    expect(papers[0].conference_name).toBe("土木学会論文集");
  });

  it("extracts year", () => {
    const papers = parseJstage(html, url);
    expect(papers[0].year).toBe(2024);
  });

  it("extracts title, authors, abstract, url", () => {
    const papers = parseJstage(html, url);
    const first = papers[0];
    expect(first.title).toBe("高架橋上の照明柱のレベル2地震動に対する限界状態と耐震照査法");
    expect(first.authors).toContain("松原 拓朗");
    expect(first.abstract_text).toContain("緊急輸送道路");
    expect(first.url).toBe(
      "https://www.jstage.jst.go.jp/article/jscejj/80/1/80_23-00145/_article/-char/ja",
    );
  });
});
