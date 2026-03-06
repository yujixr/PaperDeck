import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CrawledPaper } from "./parser-usenix";

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../backend");
const BATCH_SIZE = 20;

export function insertPapers(papers: CrawledPaper[], dbName: string, remote: boolean): void {
  if (papers.length === 0) return;

  const remoteFlag = remote ? "--remote" : "--local";

  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE);
    const sql = batch
      .map((p) => {
        const esc = (s: string) => s.replace(/'/g, "''");
        return `INSERT OR IGNORE INTO papers (conference_name, year, title, url, authors, abstract_text) VALUES ('${esc(p.conference_name)}', ${p.year}, '${esc(p.title)}', '${esc(p.url)}', '${esc(p.authors)}', '${esc(p.abstract_text)}');`;
      })
      .join("\n");

    const cmd = `npx wrangler d1 execute ${dbName} ${remoteFlag} --command "${sql.replace(/"/g, '\\"')}"`;
    execSync(cmd, { cwd: BACKEND_DIR, stdio: "inherit" });

    console.log(
      `  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(papers.length / BATCH_SIZE)}`,
    );
  }
}
