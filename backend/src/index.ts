import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import { auth } from "./routes/auth";
import { papers } from "./routes/papers";

const app = new Hono<Env>();

app.use(
  "/api/*",
  cors({
    origin: ["https://paperdeck.yuji.ne.jp"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400,
  }),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.route("/api/auth", auth);
app.route("/api/papers", papers);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Non-API routes: serve static assets with SPA fallback
app.all("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status === 404) {
    // SPA fallback: return index.html for client-side routes
    return c.env.ASSETS.fetch(new URL("/", c.req.url));
  }
  return res;
});

export default app;
