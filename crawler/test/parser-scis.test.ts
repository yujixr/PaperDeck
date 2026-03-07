import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseScis } from "../src/parser-scis";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("SCIS parser", () => {
  const html = readFileSync(join(__dirname, "fixtures/scis2026-sample.html"), "utf-8");
  const url = "https://www.iwsec.org/scis/2026/program.html";

  it("extracts papers from HTML", () => {
    const papers = parseScis(html, url);
    expect(papers).toHaveLength(405);
  });

  it("extracts conference name and year", () => {
    const papers = parseScis(html, url);
    expect(papers[0].conference_name).toBe("SCIS");
    expect(papers[0].year).toBe(2026);
  });

  it("extracts title, authors, abstract", () => {
    const papers = parseScis(html, url);
    const first = papers[0];
    expect(first.title).toBe("Practical leakage attack on HAWK Gaussian sampler");
    expect(first.authors).toContain("Haidar Calvin");
    expect(first.abstract_text).toContain("leakage template attack");
    expect(first.url).toBe("https://www.iwsec.org/scis/2026/program.html#1A1");
  });

  it("strips presenter markers from authors", () => {
    const papers = parseScis(html, url);
    const first = papers[0];
    expect(first.authors).not.toContain("〇");
    expect(first.authors).not.toContain("◎");
  });
});

describe("SCIS parser (2025 format)", () => {
  const html = readFileSync(join(__dirname, "fixtures/scis2025-sample.html"), "utf-8");
  const url = "https://www.iwsec.org/scis/2025/program.html";

  it("extracts papers from HTML", () => {
    const papers = parseScis(html, url);
    expect(papers).toHaveLength(391);
  });

  it("extracts conference name and year", () => {
    const papers = parseScis(html, url);
    expect(papers[0].conference_name).toBe("SCIS");
    expect(papers[0].year).toBe(2025);
  });

  it("extracts title, authors, abstract", () => {
    const papers = parseScis(html, url);
    const first = papers[0];
    expect(first.title).toBe("LPN問題とDual-LPN問題に基づいたノイズ付き鍵共有の提案");
    expect(first.authors).toContain("矢田 拓巳");
    expect(first.abstract_text).toContain("Learning Parity with Noise");
    expect(first.url).toBe("https://www.iwsec.org/scis/2025/program.html#1A1");
  });

  it("strips presenter markers from authors", () => {
    const papers = parseScis(html, url);
    const first = papers[0];
    expect(first.authors).not.toContain("〇");
    expect(first.authors).not.toContain("◎");
  });
});
