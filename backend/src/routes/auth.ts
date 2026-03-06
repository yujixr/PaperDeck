import { Hono } from "hono";
import { createJwt, hashPassword, verifyPassword } from "../lib/crypto";
import type { Env } from "../lib/types";
import { authMiddleware } from "../middleware/auth";

const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
const MAX_USERNAME_LEN = 32;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 128;

const auth = new Hono<Env>();

// POST /auth/register
auth.post("/register", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.text("Invalid request body", 400);
  }
  const { username, password } = body;

  if (typeof username !== "string" || typeof password !== "string") {
    return c.text("Invalid request body", 400);
  }
  if (!USERNAME_REGEX.test(username)) {
    return c.text("Username must be alphanumeric (a-z, A-Z, 0-9).", 400);
  }
  if (username.length > MAX_USERNAME_LEN) {
    return c.text(`Username must be at most ${MAX_USERNAME_LEN} characters.`, 400);
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return c.text(`Password must be at least ${MIN_PASSWORD_LEN} characters long.`, 400);
  }
  if (password.length > MAX_PASSWORD_LEN) {
    return c.text(`Password must be at most ${MAX_PASSWORD_LEN} characters.`, 400);
  }

  const passwordHash = await hashPassword(password);

  try {
    const result = await c.env.DB.prepare(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    )
      .bind(username, passwordHash)
      .run();

    return c.json({
      user_id: result.meta.last_row_id,
      username,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE")) {
      return c.text("Username already taken", 409);
    }
    throw e;
  }
});

// POST /auth/login
auth.post("/login", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.text("Invalid request body", 400);
  }
  const { username, password } = body;

  if (typeof username !== "string" || typeof password !== "string") {
    return c.text("Invalid request body", 400);
  }
  if (password.length > MAX_PASSWORD_LEN) {
    return c.text("Incorrect username or password", 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT user_id, username, password_hash FROM users WHERE username = ?",
  )
    .bind(username)
    .first<{ user_id: number; username: string; password_hash: string }>();

  if (!user) {
    // Run dummy PBKDF2 to prevent user enumeration via timing
    await hashPassword(password);
    return c.text("Incorrect username or password", 401);
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return c.text("Incorrect username or password", 401);
  }

  const token = await createJwt(user.user_id, c.env.JWT_SECRET);

  return c.json({ token, token_type: "Bearer" });
});

// GET /auth/me (protected)
auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare("SELECT user_id, username FROM users WHERE user_id = ?")
    .bind(userId)
    .first<{ user_id: number; username: string }>();

  if (!user) {
    return c.text("User not found", 404);
  }

  return c.json(user);
});

// POST /auth/logout (protected) — invalidates all existing tokens
auth.post("/logout", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const now = new Date().toISOString();

  await c.env.DB.prepare("UPDATE users SET token_invalidated_at = ? WHERE user_id = ?")
    .bind(now, userId)
    .run();

  return c.body(null, 204);
});

export { auth };
