/**
 * api/index.ts — Vercel Serverless Function entry point
 *
 * Vercel rewrites /api/trpc/* and /api/* to this file.
 * The build step compiles server/_core/index.ts → dist/server.js (ESM bundle).
 * We import that bundle's express app and let Vercel call it as a handler.
 */
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// tRPC — Vercel rewrite strips /api/trpc prefix, so mount at both paths
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

export default app;
