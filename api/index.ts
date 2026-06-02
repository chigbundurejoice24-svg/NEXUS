/**
 * api/index.ts — Vercel Serverless Function entry point
 *
 * Vercel rewrites /api/trpc/* and /api/* here.
 * Vercel compiles this TypeScript file directly — no .js extensions needed.
 */
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS — allow all origins for the API tier
app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// tRPC — Vercel rewrite strips /api/trpc, mount at both paths
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

export default app;
