import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

// Build a lightweight Express app that Vercel serverless can call.
// We do NOT use serveStatic here — Vercel serves the static dist/ files itself.
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS for dev / preview environments
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// tRPC — handles /api/trpc/* (Vercel rewrites strip /api/trpc prefix)
app.use(
  "/api/trpc",
  createExpressMiddleware({ router: appRouter, createContext })
);

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

export default app;
