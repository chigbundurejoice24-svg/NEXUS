/**
 * api/index.ts — Vercel Serverless Function entry point
 *
 * Vercel Node.js serverless requires either:
 *   - module.exports = handler  (CJS)
 *   - export default handler    (ESM, where handler is a function)
 *
 * An Express app IS a request handler function, so `export default app` works,
 * BUT Vercel needs it wrapped explicitly to avoid cold-start module issues.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-trpc-source");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// tRPC — mount at both paths (Vercel rewrites strip /api prefix differently)
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));

// Health check — simple, no DB needed
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now(), version: "1.0.0" });
});

// Explicit Vercel handler — wraps the express app
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
