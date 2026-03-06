import type { Hono } from "hono";

export type Env = {
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    ASSETS: Fetcher;
  };
  Variables: {
    userId: number;
  };
};

export type App = Hono<Env>;
