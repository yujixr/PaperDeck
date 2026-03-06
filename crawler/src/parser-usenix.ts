import * as cheerio from "cheerio";

export type CrawledPaper = {
  conference_name: string;
  year: number;
  title: string;
  url: string;
  authors: string;
  abstract_text: string;
};

const RE_CONF = /^(.*?)\s+'?(\d{2})/;

export function parseUsenix(html: string, sourceUrl: string): CrawledPaper[] {
  const $ = cheerio.load(html);
  const base = new URL(sourceUrl);

  const pageTitle = $("head > title").text().trim();
  const { conferenceName, year } = extractConferenceInfo(pageTitle);

  const papers: CrawledPaper[] = [];

  $("article.node-paper").each((_, el) => {
    const article = $(el);

    const titleLink = article.find("h2 a").first();
    const title = titleLink.text().trim() || "Paper title not found";
    const href = titleLink.attr("href") || "";
    const paperUrl = href ? new URL(href, base).toString() : "";

    const authors =
      article
        .find("div.field-name-field-paper-people-text p, div.field-name-field-presented-by p")
        .first()
        .text()
        .trim() || "Authors not found";

    const abstractText =
      article
        .find("div.field-name-field-paper-description-long p")
        .map((_, p) => $(p).text())
        .get()
        .join("\n")
        .trim() || "Abstract not found";

    papers.push({
      conference_name: conferenceName,
      year,
      title,
      url: paperUrl,
      authors,
      abstract_text: abstractText,
    });
  });

  return papers;
}

function extractConferenceInfo(pageTitle: string): {
  conferenceName: string;
  year: number;
} {
  const match = RE_CONF.exec(pageTitle);
  if (match) {
    return {
      conferenceName: match[1].trim(),
      year: 2000 + parseInt(match[2], 10),
    };
  }
  return {
    conferenceName: pageTitle.split("|")[0]?.trim() || "Unknown Conference",
    year: new Date().getFullYear(),
  };
}
