import { Command } from "commander";
import { insertPapers } from "./db";
import { parseJstage } from "./parser-jstage";
import { parseScis } from "./parser-scis";
import { parseUsenix } from "./parser-usenix";

const DB_NAME = "paperdeck-db";

const program = new Command();

program
  .name("crawler")
  .description("Crawl academic paper listings and insert into D1")
  .argument("<urls...>", "URLs to crawl")
  .option("--remote", "Write to remote D1 instead of local", false)
  .action(async (urls: string[], options: { remote: boolean }) => {
    let totalFound = 0;

    for (const url of urls) {
      console.log(`Fetching: ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Failed to fetch ${url}: ${res.status}`);
        continue;
      }
      const html = await res.text();

      const parsed = new URL(url);
      let papers: ReturnType<typeof parseUsenix> | undefined;
      if (parsed.hostname.includes("usenix.org")) {
        papers = parseUsenix(html, url);
      } else if (parsed.href.includes("iwsec.org/scis/")) {
        papers = parseScis(html, url);
      } else if (parsed.hostname.includes("jstage.jst.go.jp")) {
        papers = parseJstage(html, url);
      } else {
        console.error(`No parser for hostname: ${parsed.hostname}`);
        continue;
      }

      console.log(`Found ${papers.length} papers from ${url}`);
      totalFound += papers.length;

      insertPapers(papers, DB_NAME, options.remote);
    }

    console.log(`Done. Total papers found: ${totalFound}`);
  });

program.parse();
