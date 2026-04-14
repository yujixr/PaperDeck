import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSigmod } from "../src/parser-sigmod";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("SIGMOD parser", () => {
  const html = readFileSync(join(__dirname, "fixtures/sigmod2024-sample.html"), "utf-8");
  const url = "https://2024.sigmod.org/toc.html";

  it("extracts papers from HTML, excluding editorials", () => {
    const papers = parseSigmod(html, url);
    expect(papers).toHaveLength(213);
  });

  it("extracts conference name and year", () => {
    const papers = parseSigmod(html, url);
    expect(papers[0].conference_name).toBe("SIGMOD");
    expect(papers[0].year).toBe(2024);
  });

  it("extracts title, authors, url, abstract", () => {
    const papers = parseSigmod(html, url);
    const first = papers[0];
    expect(first.title).toBe("AirIndex: Versatile Index Tuning Through Data and Storage");
    expect(first.authors).toContain("Supawit Chockchowwat");
    expect(first.authors).toContain("Yongjoo Park");
    expect(first.url).toBe("https://dl.acm.org/doi/10.1145/3617308");
    expect(first.abstract_text).toContain("end-to-end lookup latency");
  });

  it("every paper has a non-empty url and string abstract", () => {
    const papers = parseSigmod(html, url);
    for (const p of papers) {
      expect(p.url).not.toBe("");
      expect(typeof p.abstract_text).toBe("string");
    }
  });

  it("unwraps Proofpoint-wrapped URLs", () => {
    const proofpointHtml = `
      <div id="DLcontent">
        <h3><a class="DLtitleLink" href="https://urldefense.proofpoint.com/v2/url?u=https-3A__dl.acm.org_doi_10.1145_3725256&d=DwMGaQ&c=foo">Test Paper</a></h3>
        <ul class="DLauthors"><li class="nameList Last">Author One</li></ul>
        <div class="DLabstract"><p>Abstract</p></div>
      </div>`;
    const papers = parseSigmod(proofpointHtml, "https://2025.sigmod.org/toc-3-3.html");
    expect(papers[0].url).toBe("https://dl.acm.org/doi/10.1145/3725256");
  });
});
