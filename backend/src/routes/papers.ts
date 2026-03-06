import { Hono } from "hono";
import type { Env } from "../lib/types";
import { authMiddleware } from "../middleware/auth";

const papers = new Hono<Env>();

papers.use("/*", authMiddleware);

function parsePaperId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// GET /papers/conferences
papers.get("/conferences", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT conference_name AS name, year
     FROM papers
     ORDER BY year DESC, name ASC`,
  ).all<{ name: string; year: number }>();

  return c.json(results);
});

// GET /papers/next
papers.get("/next", async (c) => {
  const userId = c.get("userId");
  const conference = c.req.query("conference");
  const yearStr = c.req.query("year");

  let sql = `
    SELECT p.*
    FROM papers p
    LEFT JOIN user_paper_status ups
      ON p.id = ups.paper_id AND ups.user_id = ?
    WHERE ups.created_at IS NULL
  `;
  const params: (string | number)[] = [userId];

  if (conference) {
    sql += " AND p.conference_name = ?";
    params.push(conference);
  }
  if (yearStr) {
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) return c.text("Invalid year parameter", 400);
    sql += " AND p.year = ?";
    params.push(year);
  }
  sql += " ORDER BY RANDOM() LIMIT 1";

  const paper = await c.env.DB.prepare(sql)
    .bind(...params)
    .first();

  if (!paper) {
    let checkSql = "SELECT 1 FROM papers WHERE 1=1";
    const checkParams: (string | number)[] = [];
    if (conference) {
      checkSql += " AND conference_name = ?";
      checkParams.push(conference);
    }
    if (yearStr) {
      const year = parseInt(yearStr, 10);
      if (!Number.isFinite(year)) return c.text("Invalid year parameter", 400);
      checkSql += " AND year = ?";
      checkParams.push(year);
    }
    checkSql += " LIMIT 1";

    const exists = await c.env.DB.prepare(checkSql)
      .bind(...checkParams)
      .first();

    if (exists) {
      return c.text("All papers matching these filters have been rated.", 404);
    }
    return c.text("No papers found matching the specified filters.", 404);
  }

  return c.json(paper);
});

// GET /papers/liked
papers.get("/liked", async (c) => {
  const userId = c.get("userId");

  const { results } = await c.env.DB.prepare(
    `SELECT p.*
     FROM papers p
     JOIN user_paper_status ups ON p.id = ups.paper_id
     WHERE ups.user_id = ? AND ups.liked_at IS NOT NULL
     ORDER BY ups.liked_at DESC`,
  )
    .bind(userId)
    .all();

  return c.json(results);
});

// POST /papers/:paper_id/like
papers.post("/:paper_id/like", async (c) => {
  const userId = c.get("userId");
  const paperId = parsePaperId(c.req.param("paper_id"));
  if (paperId === null) return c.text("Invalid paper_id", 400);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO user_paper_status (user_id, paper_id, liked_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, paper_id) DO UPDATE SET liked_at = excluded.liked_at`,
  )
    .bind(userId, paperId, now)
    .run();

  return c.body(null, 201);
});

// DELETE /papers/:paper_id/like
papers.delete("/:paper_id/like", async (c) => {
  const userId = c.get("userId");
  const paperId = parsePaperId(c.req.param("paper_id"));
  if (paperId === null) return c.text("Invalid paper_id", 400);

  const result = await c.env.DB.prepare(
    `UPDATE user_paper_status SET liked_at = NULL
     WHERE user_id = ? AND paper_id = ? AND liked_at IS NOT NULL`,
  )
    .bind(userId, paperId)
    .run();

  if (!result.meta.changes) {
    return c.text("No like found", 404);
  }
  return c.body(null, 204);
});

// POST /papers/:paper_id/read
papers.post("/:paper_id/read", async (c) => {
  const userId = c.get("userId");
  const paperId = parsePaperId(c.req.param("paper_id"));
  if (paperId === null) return c.text("Invalid paper_id", 400);

  await c.env.DB.prepare(
    `INSERT INTO user_paper_status (user_id, paper_id, liked_at)
     VALUES (?, ?, NULL)
     ON CONFLICT(user_id, paper_id) DO NOTHING`,
  )
    .bind(userId, paperId)
    .run();

  return c.body(null, 201);
});

export { papers };
