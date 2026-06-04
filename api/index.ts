// Build: 20260604-131959 — cache bust for notify router registration fix
import express from "express";

const ALLOWED_ORIGINS = [
  "https://aegis-wvxz.vercel.app",
  "https://aegis.cozanet.net",   // future custom domain
  "http://localhost:5173",        // local dev
  "http://localhost:3000",
];

let _handler: any = null;
let _err: any = null;

try {
  const { createExpressMiddleware } = require("@trpc/server/adapters/express");
  const { appRouter }  = require("../server/routers");
  const { createContext } = require("../server/_core/context");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // ── Security headers ──────────────────────────────────────────────────
  app.use((_req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options",   "nosniff");
    res.setHeader("X-Frame-Options",          "DENY");
    res.setHeader("X-XSS-Protection",         "1; mode=block");
    res.setHeader("Referrer-Policy",          "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy",       "geolocation=(), microphone=(), camera=()");
    res.setHeader("Strict-Transport-Security","max-age=63072000; includeSubDomains; preload");
    next();
  });

  // ── CORS — locked to allowed origins only ─────────────────────────────
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin ?? "";
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin",      origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-trpc-source");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  // ── Cron routes — protected by CRON_SECRET ───────────────────────────
  app.use("/api/cron", (req: any, res: any, next: any) => {
    const secret = req.headers["x-cron-secret"] ?? req.query?.secret;
    if (!secret || secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // ── tRPC ──────────────────────────────────────────────────────────────
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));


  // ── Confirmation poller cron ──────────────────────────────────────
  app.get("/api/cron/confirmations", async (_req: any, res: any) => {
    try {
      const { pollConfirmations } = await import("../server/lib/transactions/confirmation-poller");
      const result = await pollConfirmations();
      return res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error("[Cron] Confirmation poller error:", e?.message);
      return res.status(500).json({ ok: false, error: e?.message });
    }
  });


  // ── Portfolio snapshot refresher cron ─────────────────────────────
  app.get("/api/cron/snapshots", async (_req: any, res: any) => {
    try {
      const { updateStalePortfolioSnapshots } = await import("../server/lib/wallets/snapshot-updater");
      const result = await updateStalePortfolioSnapshots();
      return res.json({ ok: true, ...result });
    } catch (e: any) {
      console.error("[Cron] Snapshot updater error:", e?.message);
      return res.status(500).json({ ok: false, error: e?.message });
    }
  });

  // ── Debug: detailed router inspection ──────────────────────────────
  app.get("/api/debug/routes", (_req: any, res: any) => {
    try {
      const def = (appRouter as any)._def ?? {};
      const procs = Object.keys(def.procedures ?? {});
      const routerKeys = Object.keys(def.router?._def?.record ?? def.record ?? {});
      return res.json({
        ok: true,
        procedures: procs,
        procCount: procs.length,
        routerKeys,
        defKeys: Object.keys(def),
      });
    } catch(e: any) {
      return res.status(500).json({ ok: false, error: e?.message, stack: e?.stack?.slice(0,500) });
    }
  });

  // ── Health — no version leak ──────────────────────────────────────────
  app.get("/api/health", (_req: any, res: any) => {
    res.json({ ok: true, ts: Date.now() });
  });

  _handler = app;
} catch (e: any) {
  _err = e;
  console.error("[AEGIS BOOT]", e?.message, e?.stack?.slice(0, 400));
}

module.exports = function handler(req: any, res: any) {
  if (_err || !_handler) {
    // Never leak internals in production
    const isProd = process.env.NODE_ENV === "production";
    return res.status(500).json({
      ok: false,
      error: isProd ? "Internal server error" : _err?.message,
    });
  }
  return _handler(req, res);
};
