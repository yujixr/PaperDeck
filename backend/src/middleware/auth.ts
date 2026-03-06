import { createMiddleware } from "hono/factory";
import { verifyJwt } from "../lib/crypto";
import type { Env } from "../lib/types";

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.text("Missing or invalid Authorization header", 401);
  }

  const token = authHeader.slice(7);

  let claims: Awaited<ReturnType<typeof verifyJwt>>;
  try {
    claims = await verifyJwt(token, c.env.JWT_SECRET);
  } catch {
    return c.text("Invalid token", 401);
  }

  // Verify user exists and token is not invalidated
  const user = await c.env.DB.prepare("SELECT token_invalidated_at FROM users WHERE user_id = ?")
    .bind(claims.sub)
    .first<{ token_invalidated_at: string | null }>();

  if (!user) {
    return c.text("User does not exist", 401);
  }

  if (user.token_invalidated_at) {
    const invalidatedAt = Math.floor(new Date(user.token_invalidated_at).getTime() / 1000);
    if (claims.iat <= invalidatedAt) {
      return c.text("Token has been revoked", 401);
    }
  }

  c.set("userId", claims.sub);
  await next();
});
