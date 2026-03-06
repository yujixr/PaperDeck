import { Command } from "commander";
import { insertPapers } from "./db";
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

      const hostname = new URL(url).hostname;
      let papers: ReturnType<typeof parseUsenix> | undefined;
      if (hostname.includes("usenix.org")) {
        papers = parseUsenix(html, url);
      } else {
        console.error(`No parser for hostname: ${hostname}`);
        continue;
      }

      console.log(`Found ${papers.length} papers from ${url}`);
      totalFound += papers.length;

      insertPapers(papers, DB_NAME, options.remote);
    }

    console.log(`Done. Total papers found: ${totalFound}`);
  });

program.parse();
