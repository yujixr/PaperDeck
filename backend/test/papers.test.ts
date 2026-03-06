import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createJwt, hashPassword } from "../src/lib/crypto";

async function setupAuthAndGetToken(): Promise<string> {
  const passwordHash = await hashPassword("password123");
  await env.DB.prepare("INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)")
    .bind("paperuser", passwordHash)
    .run();
  const user = await env.DB.prepare("SELECT user_id FROM users WHERE username = ?")
    .bind("paperuser")
    .first<{ user_id: number }>();
  if (!user) throw new Error("User not found");
  return createJwt(user.user_id, "test-secret-key-for-development-only");
}

describe("Papers API", () => {
  let token: string;

  beforeAll(async () => {
    // Create tables one at a time
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, token_invalidated_at TEXT)",
    );
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS papers (id INTEGER PRIMARY KEY AUTOINCREMENT, conference_name TEXT NOT NULL, year INTEGER NOT NULL, title TEXT NOT NULL UNIQUE, url TEXT, authors TEXT, abstract_text TEXT)",
    );
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS user_paper_status (user_id INTEGER NOT NULL, paper_id INTEGER NOT NULL, liked_at DATETIME, created_at DATETIME NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, paper_id), FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE, FOREIGN KEY (paper_id) REFERENCES papers (id) ON DELETE CASCADE)",
    );

    // Seed test papers one at a time
    await env.DB.prepare(
      "INSERT OR IGNORE INTO papers (conference_name, year, title, url, authors, abstract_text) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind("USENIX Security", 2025, "Paper A", "https://example.com/a", "Author A", "Abstract A")
      .run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO papers (conference_name, year, title, url, authors, abstract_text) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind("USENIX Security", 2025, "Paper B", "https://example.com/b", "Author B", "Abstract B")
      .run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO papers (conference_name, year, title, url, authors, abstract_text) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind("USENIX Security", 2024, "Paper C", "https://example.com/c", "Author C", "Abstract C")
      .run();

    token = await setupAuthAndGetToken();
  });

  it("GET /api/papers/conferences — returns conference list", async () => {
    const res = await SELF.fetch("http://localhost/api/papers/conferences", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; year: number }[];
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/papers/next — returns an unrated paper", async () => {
    const res = await SELF.fetch("http://localhost/api/papers/next", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const paper = (await res.json()) as { id: number; title: string };
    expect(paper.id).toBeDefined();
    expect(paper.title).toBeDefined();
  });

  it("GET /api/papers/next?conference=USENIX+Security&year=2024 — filters", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/papers/next?conference=USENIX+Security&year=2024",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status).toBe(200);
    const paper = (await res.json()) as {
      conference_name: string;
      year: number;
    };
    expect(paper.conference_name).toBe("USENIX Security");
    expect(paper.year).toBe(2024);
  });

  it("POST /api/papers/1/like — creates a like", async () => {
    const res = await SELF.fetch("http://localhost/api/papers/1/like", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(201);
  });

  it("DELETE /api/papers/1/like — removes the like", async () => {
    // Ensure liked first
    await SELF.fetch("http://localhost/api/papers/1/like", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await SELF.fetch("http://localhost/api/papers/1/like", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(204);

    // Verify no longer in liked list
    const likedRes = await SELF.fetch("http://localhost/api/papers/liked", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const liked = (await likedRes.json()) as { id: number }[];
    expect(liked.some((p) => p.id === 1)).toBe(false);
  });

  it("DELETE /api/papers/999/like — returns 404 when no like exists", async () => {
    const res = await SELF.fetch("http://localhost/api/papers/999/like", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/papers/2/read — marks as read", async () => {
    const res = await SELF.fetch("http://localhost/api/papers/2/read", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/papers/liked — returns liked papers", async () => {
    await SELF.fetch("http://localhost/api/papers/1/like", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await SELF.fetch("http://localhost/api/papers/liked", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const papers = (await res.json()) as { title: string }[];
    expect(papers.some((p) => p.title === "Paper A")).toBe(true);
  });

  it("GET /api/papers/next — without auth returns 401", async () => {
    const res = await SELF.fetch("http://localhost/api/papers/next");
    expect(res.status).toBe(401);
  });
});
