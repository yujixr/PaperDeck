import * as cheerio from "cheerio";
import type { CrawledPaper } from "./parser-usenix";

export function parseJstage(html: string, _sourceUrl: string): CrawledPaper[] {
  const $ = cheerio.load(html);

  const conferenceName = $("div.journal-name").first().text().trim() || "Unknown Journal";

  const papers: CrawledPaper[] = [];

  $("div.searchlist-title").each((_, el) => {
    const titleDiv = $(el);
    const link = titleDiv.find("a").first();
    const title = link.text().trim();
    if (!title) return;

    const url = link.attr("href") || "";

    const li = titleDiv.closest("li");

    const authors = li.find("div.searchlist-authortags").attr("title")?.trim() || "";

    const infoText = li.find("div.searchlist-additional-info").text();
    const yearMatch = infoText.match(/(\d{4})\s*年/);
    const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : new Date().getFullYear();

    const abstractText = li
      .find("div.inner-content.abstract p")
      .map((_, p) => $(p).text())
      .get()
      .join("\n")
      .trim();

    papers.push({
      conference_name: conferenceName,
      year,
      title,
      url,
      authors,
      abstract_text: abstractText,
    });
  });

  return papers;
}
