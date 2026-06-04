/**
 * api/db-setup.ts
 * ONE-TIME endpoint — run this once to create all tables in Neon.
 * Protected by CRON_SECRET so it's not publicly accessible.
 *
 * Usage:
 *   curl -X POST https://<your-domain>/api/db-setup \
 *        -H "x-setup-secret: <CRON_SECRET>"
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "fs";
import { join } from "path";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers["x-setup-secret"] as string;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL not set" });

  try {
    const { Pool } = require("@neondatabase/serverless");
    const pool = new Pool({ connectionString: dbUrl });

    const sql = readFileSync(join(process.cwd(), "drizzle/init_postgres.sql"), "utf8");

    // Split by statement and execute each
    const stmts = sql
      .split(/;\s*
/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    let executed = 0;
    const errors: string[] = [];

    for (const stmt of stmts) {
      try {
        await pool.query(stmt);
        executed++;
      } catch (e: any) {
        // Ignore "already exists" errors — these are safe
        if (!e.message?.includes("already exists") && !e.message?.includes("duplicate")) {
          errors.push(e.message?.slice(0, 150));
        }
      }
    }

    await pool.end();

    return res.json({
      ok: true,
      executed,
      errors: errors.length > 0 ? errors : undefined,
      message: `Ran ${executed} statements. ${errors.length} warnings.`,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
