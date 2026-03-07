import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

async function registerUser(username: string, password: string) {
  return SELF.fetch("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

async function loginUser(username: string, password: string) {
  return SELF.fetch("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

describe("Auth API", () => {
  beforeAll(async () => {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, token_invalidated_at TEXT);",
    );
  });

  it("POST /api/auth/register — success", async () => {
    const res = await registerUser("testuser", "password123");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user_id: number; username: string };
    expect(body.username).toBe("testuser");
    expect(body.user_id).toBeDefined();
  });

  it("POST /api/auth/register — duplicate username returns 409", async () => {
    await registerUser("dupeuser", "password123");
    const res = await registerUser("dupeuser", "password123");
    expect(res.status).toBe(409);
  });

  it("POST /api/auth/register — short password returns 400", async () => {
    const res = await registerUser("user2", "short");
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/login — success", async () => {
    await registerUser("loginuser", "password123");
    const res = await loginUser("loginuser", "password123");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; token_type: string };
    expect(body.token).toBeTruthy();
    expect(body.token_type).toBe("Bearer");
  });

  it("POST /api/auth/login — wrong password returns 401", async () => {
    await registerUser("wrongpwuser", "password123");
    const res = await loginUser("wrongpwuser", "wrongpassword");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — with valid token", async () => {
    await registerUser("meuser", "password123");
    const loginRes = await loginUser("meuser", "password123");
    const { token } = (await loginRes.json()) as { token: string };

    const meRes = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.status).toBe(200);
    const user = (await meRes.json()) as { user_id: number; username: string };
    expect(user.username).toBe("meuser");
    expect((user as Record<string, unknown>).password_hash).toBeUndefined();
  });

  it("GET /api/auth/me — without token returns 401", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/me");
    expect(res.status).toBe(401);
  });
});
