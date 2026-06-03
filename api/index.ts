// Catch-all error handler — wraps entire app in try/catch at module level
let _handler: any = null;
let _err: any = null;

try {
  const express = require("express");
  const { createExpressMiddleware } = require("@trpc/server/adapters/express");
  const { appRouter } = require("../server/routers");
  const { createContext } = require("../server/_core/context");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));
  app.get("/api/health", (_req: any, res: any) => res.json({ ok: true, ts: Date.now() }));
  _handler = app;
} catch (e: any) {
  _err = e;
  console.error("[AEGIS CRASH]", e?.message, e?.stack);
}

module.exports = function(req: any, res: any) {
  if (_err || !_handler) {
    return res.status(500).json({
      ok: false,
      error: _err?.message ?? "Unknown startup error",
      stack: _err?.stack?.split("\n").slice(0, 8),
    });
  }
  return _handler(req, res);
};
