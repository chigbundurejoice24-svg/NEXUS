import express from "express";

let _handler: any = null;
let _err: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createExpressMiddleware } = require("@trpc/server/adapters/express");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { appRouter } = require("../server/routers");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createContext } = require("../server/_core/context");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-trpc-source");
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));
  app.get("/api/health", (_req: any, res: any) =>
    res.json({ ok: true, ts: Date.now(), version: "1.0.0" })
  );
  _handler = app;
} catch (e: any) {
  _err = e;
  console.error("[AEGIS BOOT]", e?.message, e?.stack?.slice(0, 400));
}

module.exports = function handler(req: any, res: any) {
  if (_err || !_handler) {
    return res.status(500).json({
      ok: false,
      error: _err?.message ?? "Boot failed",
      stack: _err?.stack?.split?.("\n")?.slice(0, 6),
    });
  }
  return _handler(req, res);
};
