/**
 * portfolio.ts — tRPC Portfolio Router
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  Returning user:  read snapshot → <50ms             │
 * │  New user:        build live → store snapshot async  │
 * └─────────────────────────────────────────────────────┘
 *
 * The background cron (/api/cron/snapshots) keeps snapshots fresh.
 * No JSON.parse — Neon returns jsonb as a native JS object.
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { portfolioSnapshots } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { buildPortfolio } from "../lib/wallets/portfolio-aggregator";
import { enrichPortfolio } from "../lib/wallets/enriched-portfolio";
import { getConsolidatedWalletList } from "../lib/accounts/wallet-list";

// ── Serialiser (BigInt → string so JSON transport never crashes) ──────────
function serializePortfolio(enriched: Awaited<ReturnType<typeof enrichPortfolio>>) {
  return JSON.parse(
    JSON.stringify(enriched, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val
    )
  );
}

// ── Input schemas (kept for legacy public endpoints) ─────────────────────
const WalletInputSchema = z.object({
  address: z.string().transform(s => s.toLowerCase()).refine(
    (addr) => /^0x[a-f0-9]{40}$/.test(addr),
    "Invalid Ethereum address format"
  ),
  label: z.string().optional(),
});
const GetPortfolioInputSchema = z.object({
  wallets: z.array(WalletInputSchema).min(1),
});

export const portfolioRouter = router({

  // ── PRIMARY: authenticated dashboard endpoint ──────────────────
  // Returns snapshot in <50ms for returning users.
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const userId = ctx.user!.id;

    // 1. Try snapshot first — instant for returning users
    const [snap] = await db
      .select()
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.userId, userId))
      .limit(1);

    if (snap) {
      // snapshot is already a JS object (Neon jsonb → no JSON.parse needed)
      return snap.snapshot as ReturnType<typeof serializePortfolio>;
    }

    // 2. Brand-new user — build synchronously, persist async
    const walletList = await getConsolidatedWalletList(userId);
    if (walletList.length === 0) return null;

    const portfolio  = await buildPortfolio(walletList);
    const enriched   = await enrichPortfolio(portfolio);
    const serialized = serializePortfolio(enriched);

    const totalValueUsd = parseFloat(enriched.totalValueUsd) || 0;
    const chains     = new Set(enriched.aggregatedAssets.map((a) => a.network));
    const assetCount = enriched.aggregatedAssets.length;

    // Persist snapshot (log errors, never crash the response)
    db.insert(portfolioSnapshots)
      .values({
        userId,
        totalValueUsd: totalValueUsd.toFixed(2),
        chainCount:    chains.size,
        assetCount,
        snapshot:      serialized,
        updatedAt:     new Date(),
      })
      .onConflictDoUpdate({
        target: portfolioSnapshots.userId,
        set: {
          totalValueUsd: totalValueUsd.toFixed(2),
          chainCount:    chains.size,
          assetCount,
          snapshot:      serialized,
          updatedAt:     new Date(),
        },
      })
      .catch((err) => console.error("[Portfolio] Failed to persist initial snapshot:", err));

    return serialized;
  }),

  // ── PUBLIC: arbitrary wallet list (for external/anonymous queries) ──
  getAggregated: publicProcedure
    .input(GetPortfolioInputSchema)
    .query(async ({ input }) => {
      try {
        const wallets = input.wallets.map((w) => ({
          address: w.address as `0x${string}`,
          label:   w.label,
        }));
        const portfolio = await buildPortfolio(wallets);
        const enriched  = await enrichPortfolio(portfolio);
        return { success: true, data: serializePortfolio(enriched) };
      } catch (error) {
        console.error("[Portfolio] getAggregated error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch portfolio", data: null };
      }
    }),

  getTotalValue: publicProcedure
    .input(GetPortfolioInputSchema)
    .query(async ({ input }) => {
      try {
        const wallets = input.wallets.map((w) => ({
          address: w.address as `0x${string}`,
          label:   w.label,
        }));
        const portfolio = await buildPortfolio(wallets);
        const enriched  = await enrichPortfolio(portfolio);
        return { success: true, totalValueUsd: enriched.totalValueUsd, totalWallets: enriched.totalWallets };
      } catch (error) {
        console.error("[Portfolio] getTotalValue error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed", totalValueUsd: "0", totalWallets: 0 };
      }
    }),

  getByWallet: publicProcedure
    .input(GetPortfolioInputSchema)
    .query(async ({ input }) => {
      try {
        const wallets = input.wallets.map((w) => ({
          address: w.address as `0x${string}`,
          label:   w.label,
        }));
        const portfolio = await buildPortfolio(wallets);
        const enriched  = await enrichPortfolio(portfolio);
        return { success: true, wallets: enriched.perWallet };
      } catch (error) {
        console.error("[Portfolio] getByWallet error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed", wallets: [] };
      }
    }),

  getPrices: publicProcedure
    .input(z.object({ assetKeys: z.array(z.string()).min(1) }))
    .query(async ({ input }) => {
      try {
        const { fetchTokenPrices } = await import("../lib/prices/fetch-prices");
        const prices = await fetchTokenPrices(input.assetKeys);
        return { success: true, prices };
      } catch (error) {
        console.error("[Portfolio] getPrices error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed", prices: {} };
      }
    }),
});

