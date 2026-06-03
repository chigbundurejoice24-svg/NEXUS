/**
 * api/index.ts — Vercel Serverless Function
 * Wrapped with startup error capture for debugging
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Capture any module-load errors
let startupError: unknown = null;
let app: ((req: any, res: any) => void) | null = null;

async function init() {
  try {
    const express = (await import("express")).default;
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");

    const _app = express();
    _app.use(express.json({ limit: "10mb" }));
    _app.use(express.urlencoded({ limit: "10mb", extended: true }));

    _app.use((req: any, res: any, next: any) => {
      const origin = req.headers.origin ?? "";
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-trpc-source");
      if (req.method === "OPTIONS") return res.status(200).end();
      next();
    });

    _app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
    _app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));
    _app.get("/api/health", (_req: any, res: any) => res.json({ ok: true, ts: Date.now() }));

    app = _app;
  } catch (err) {
    startupError = err;
    console.error("[AEGIS STARTUP ERROR]", err);
  }
}

// Run init immediately (top-level await not available in all runtimes)
const initPromise = init();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initPromise;

  if (startupError || !app) {
    const msg = startupError instanceof Error
      ? `${startupError.message}\n${startupError.stack}`
      : String(startupError);
    console.error("[AEGIS HANDLER] Startup error:", msg);
    return res.status(500).json({
      error: "Server startup failed",
      message: msg,
      hint: "Check Vercel function logs"
    });
  }

  return app(req, res);
}
