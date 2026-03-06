import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseUsenix } from "../src/parser-usenix";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("USENIX parser", () => {
  const html = readFileSync(join(__dirname, "fixtures/usenix-sample.html"), "utf-8");
  const url = "https://www.usenix.org/conference/usenixsecurity25/technical-sessions";

  it("extracts papers from HTML", () => {
    const papers = parseUsenix(html, url);
    expect(papers).toHaveLength(455);
  });

  it("extracts conference name and year", () => {
    const papers = parseUsenix(html, url);
    expect(papers[0].conference_name).toBe("USENIX Security");
    expect(papers[0].year).toBe(2025);
  });

  it("extracts title, authors, abstract, url", () => {
    const papers = parseUsenix(html, url);
    const first = papers[0];
    expect(first.title).toBe("Analyzing the AI Nudification Application Ecosystem");
    expect(first.authors).toContain("Cassidy Gibson");
    expect(first.abstract_text).toContain("nudification");
    expect(first.url).toBe(
      "https://www.usenix.org/conference/usenixsecurity25/presentation/gibson",
    );
  });
});
