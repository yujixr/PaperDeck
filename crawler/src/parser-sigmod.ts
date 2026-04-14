import * as cheerio from "cheerio";
import type { CrawledPaper } from "./parser-usenix";

export function parseSigmod(html: string, sourceUrl: string): CrawledPaper[] {
  const $ = cheerio.load(html);

  const year = extractYear(sourceUrl);
  const papers: CrawledPaper[] = [];

  $("h3:has(a.DLtitleLink)").each((_, el) => {
    const h3 = $(el);

    const titleLink = h3.find("a.DLtitleLink");
    const title = titleLink.text().trim();

    if (/editorial/i.test(title)) return;

    const rawHref = titleLink.attr("href") || "";
    const url = unwrapProofpoint(rawHref);

    const authorsUl = h3.nextAll("ul.DLauthors").first();
    const authors = authorsUl
      .find("li")
      .map((_, li) => $(li).text().trim())
      .get()
      .join(", ");

    const abstractDiv = h3.nextAll("div.DLabstract").first();
    const abstractText = abstractDiv.text().trim();

    papers.push({
      conference_name: "SIGMOD",
      year,
      title,
      url,
      authors,
      abstract_text: abstractText,
    });
  });

  return papers;
}

function unwrapProofpoint(href: string): string {
  if (!href.includes("urldefense.proofpoint.com")) return href;
  const u = new URL(href).searchParams.get("u");
  if (!u) return href;
  return u.replace(/-3A/g, ":").replace(/__/g, "//").replace(/_/g, "/");
}

function extractYear(sourceUrl: string): number {
  const match = /(\d{4})\.sigmod\.org/.exec(sourceUrl);
  if (match) return parseInt(match[1], 10);
  return new Date().getFullYear();
}
