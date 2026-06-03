/**
 * api/index.ts — Entry point compiled by esbuild into dist/api/index.js
 * Served as a Vercel serverless function (CJS bundle, Node.js runtime)
 */
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-trpc-source");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
app.use("/trpc",     createExpressMiddleware({ router: appRouter, createContext }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now(), version: "1.0.0" });
});

// Vercel CJS serverless: module.exports = app
module.exports = app;
