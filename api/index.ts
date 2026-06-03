import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

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
app.get("/api/health", (_req: any, res: any) => res.json({ ok: true, ts: Date.now() }));

export default app;
