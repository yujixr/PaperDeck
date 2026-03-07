import * as cheerio from "cheerio";
import type { CrawledPaper } from "./parser-usenix";

const RE_CONF = /SCIS\s*(\d{4})/;
const RE_PRESENTER = /^[〇◎]\s*/;

export function parseScis(html: string, sourceUrl: string): CrawledPaper[] {
  const $ = cheerio.load(html);

  const pageTitle = $("head > title").text().trim();
  const year = extractYear(pageTitle);
  const baseUrl = sourceUrl.split("#")[0];

  // 2026+ format uses div.print_wrap, older format uses div.session_header
  if ($("div.print_wrap h3[id]").length > 0) {
    return parse2026($, year, baseUrl);
  }
  return parse2025($, year, baseUrl);
}

function parse2026($: cheerio.CheerioAPI, year: number, baseUrl: string): CrawledPaper[] {
  const papers: CrawledPaper[] = [];

  $("div.print_wrap").each((_, wrap) => {
    const section = $(wrap);
    const h3 = section.find("h3").first();
    const sessionId = h3.attr("id");
    if (!sessionId) return;

    const sessionUrl = `${baseUrl}#${sessionId}`;

    section.find("a[onclick]").each((_, el) => {
      const anchor = $(el);
      const title = anchor.text().trim();
      if (!title) return;

      const paperId = anchor.attr("onclick")?.match(/ao_open\('(.+?)'\)/)?.[1];
      if (!paperId) return;

      const paperTd = anchor.closest("td");
      const authorsDiv = paperTd
        .find("div")
        .filter((_, d) => {
          const text = $(d).text().trim();
          return text.startsWith("〇") || text.startsWith("◎");
        })
        .first();
      const authors = authorsDiv.text().trim().replace(RE_PRESENTER, "");

      const abstractDiv = $(`#abst_${paperId}`);
      const abstractText = abstractDiv
        .contents()
        .filter((_, node) => node.type === "text")
        .text()
        .trim();

      papers.push({
        conference_name: "SCIS",
        year,
        title,
        url: sessionUrl,
        authors: authors || "",
        abstract_text: abstractText || "",
      });
    });
  });

  return papers;
}

function parse2025($: cheerio.CheerioAPI, year: number, baseUrl: string): CrawledPaper[] {
  const papers: CrawledPaper[] = [];
  let currentSessionId = "";

  $("div.session_header, div.presentation").each((_, el) => {
    const div = $(el);

    if (div.hasClass("session_header")) {
      currentSessionId = div.attr("id") || "";
      return;
    }

    // div.presentation
    const dt = div.find("dt").first();
    if (!dt.length) return;

    const dtHtml = dt.html() || "";
    const parts = dtHtml.split(/<br\s*\/?>/);
    const title = parts[0].trim();
    if (!title) return;

    const authorsText = (parts[1] || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(RE_PRESENTER, "")
      .replace(/^、\s*/, "");
    const authors = authorsText;

    const abstractText = div.find("div.abst").text().trim();

    papers.push({
      conference_name: "SCIS",
      year,
      title,
      url: currentSessionId ? `${baseUrl}#${currentSessionId}` : baseUrl,
      authors: authors || "",
      abstract_text: abstractText || "",
    });
  });

  return papers;
}

function extractYear(pageTitle: string): number {
  const match = RE_CONF.exec(pageTitle);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return new Date().getFullYear();
}
