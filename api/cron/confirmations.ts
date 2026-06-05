/**
 * /api/cron/confirmations — Vercel Cron handler
 * Schedule: every 5 minutes (see vercel.json)
 * Scans SUBMITTED transactions, checks on-chain, advances state.
 * Protected by CRON_SECRET header.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pollConfirmations } from "../../server/lib/transactions/confirmation-poller";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers["authorization"] ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  if (cronSecret && !authHeader.includes(cronSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const start  = Date.now();
    const result = await pollConfirmations();
    const ms     = Date.now() - start;

    console.log(`[Cron/Confirmations] checked=${result.checked} confirmed=${result.confirmed} settled=${result.settled} failed=${result.failed} (${ms}ms)`);
    return res.status(200).json({ ok: true, ...result, ms });
  } catch (err: any) {
    console.error("[Cron/Confirmations] Fatal:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? "Unknown error" });
  }
}
