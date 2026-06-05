/**
 * /api/cron/snapshots — Vercel Cron handler
 * Schedule: every 5 minutes (see vercel.json)
 * Finds stale/missing portfolio snapshots and rebuilds them.
 * Protected by CRON_SECRET header (set in Vercel env).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updateStalePortfolioSnapshots } from "../../server/lib/wallets/snapshot-updater";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel injects Authorization: Bearer <CRON_SECRET> automatically for cron jobs
  const authHeader = req.headers["authorization"] ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  if (cronSecret && !authHeader.includes(cronSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const start  = Date.now();
    const result = await updateStalePortfolioSnapshots();
    const ms     = Date.now() - start;

    console.log(`[Cron/Snapshots] updated=${result.updated} skipped=${result.skipped} errors=${result.errors} (${ms}ms)`);
    return res.status(200).json({ ok: true, ...result, ms });
  } catch (err: any) {
    console.error("[Cron/Snapshots] Fatal:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
  }
}
