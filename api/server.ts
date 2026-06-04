// Build: 20260604-fixes — CORS expanded for preview deploys
import express from "express";

const ALLOWED_ORIGINS = [
  "https://aegis-wvxz.vercel.app",
  "https://aegis.cozanet.net",
  "http://localhost:5173",
  "http://localhost:3000",
];

// Allow any Vercel preview URL for this project
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow all aegis-wvxz preview deployments
  if (/^https:\/\/aegis-wvxz-[a-z0-9]+-cozycrypto-s-projects\.vercel\.app$/.test(origin)) return true;
  return false;
}

let _handler: any = null;
let _err: any = null;

try {
  const { createExpressMiddleware } = require("@trpc/server/adapters/express");
  const { appRouter }               = require("../server/routers");
  const { createContext }           = require("../server/_core/context");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // ── Security headers ──────────────────────────────────────────────────
  app.use((_req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options",    "nosniff");
    res.setHeader("X-Frame-Options",           "DENY");
    res.setHeader("X-XSS-Protection",          "1; mode=block");
    res.setHeader("Referrer-Policy",           "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy",        "geolocation=(), microphone=(), camera=()");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    next();
  });

  // ── CORS ──────────────────────────────────────────────────────────────
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin ?? "";
    if (isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin",      origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-trpc-source");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  // ── Cron routes — CRON_SECRET required ───────────────────────────────
  app.use("/api/cron", (req: any, res: any, next: any) => {
    const secret = (req.headers["x-cron-secret"] as string) ?? (req.query?.secret as string);
    if (!secret || secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // ── Health (no auth) ─────────────────────────────────────────────────
  app.get("/api/health", (_req: any, res: any) => {
    res.json({ ok: true, ts: Date.now() });
  });

  // ── tRPC ──────────────────────────────────────────────────────────────
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));

  // ── Snapshot cron (every 5 min via Vercel cron) ───────────────────────
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

  // ── Confirmation poller cron ───────────────────────────────────────────
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

  _handler = app;

} catch (e: any) {
  _err = e;
  console.error("[Server Init Error]", e?.message, e?.stack);
}

// ── Serverless export ─────────────────────────────────────────────────────────
module.exports = (req: any, res: any) => {
  if (_err) {
    console.error("[Runtime] Module load error:", _err?.message);
    return res.status(500).json({ error: "Server initialization failed", detail: _err?.message });
  }
  if (!_handler) {
    return res.status(500).json({ error: "Handler not initialized" });
  }
  return _handler(req, res);
};
