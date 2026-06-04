/**
 * snapshot-updater.ts — Background portfolio snapshot maintenance
 *
 * Finds users with missing or stale snapshots and rebuilds them.
 * Uses clean Drizzle ORM queries — no raw SQL.
 *
 * Called by: /api/cron/snapshots (every 5 min) or on-demand.
 */
import { getDb } from "../../db";
import { portfolioSnapshots, users, linkedWallets } from "../../../drizzle/schema";
import { buildPortfolio } from "./portfolio-aggregator";
import { enrichPortfolio } from "./enriched-portfolio";
import { getConsolidatedWalletList } from "../accounts/wallet-list";
import { eq, lt, isNull, and, sql, inArray } from "drizzle-orm";

const STALE_MINUTES = 5;

function serializePortfolio(enriched: Awaited<ReturnType<typeof enrichPortfolio>>) {
  // Convert BigInt fields so JSON.stringify does not throw
  return JSON.parse(
    JSON.stringify(enriched, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val
    )
  );
}

export async function updateStalePortfolioSnapshots(): Promise<{ updated: number; skipped: number; errors: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[SnapshotUpdater] DB unavailable — skipping");
    return { updated: 0, skipped: 0, errors: 0 };
  }

  // ── 1. Users with NO snapshot who have at least one linked wallet ─────
  const noSnapshotResult = await db
    .select({ id: users.id })
    .from(users)
    .leftJoin(portfolioSnapshots, eq(portfolioSnapshots.userId, users.id))
    .where(
      and(
        isNull(portfolioSnapshots.userId),
        sql`EXISTS (
          SELECT 1 FROM ${linkedWallets}
          WHERE ${linkedWallets.userId} = ${users.id}
        )`
      )
    )
    .limit(50);

  // ── 2. Users with STALE snapshot (older than STALE_MINUTES) ──────────
  const staleResult = await db
    .select({ id: portfolioSnapshots.userId })
    .from(portfolioSnapshots)
    .where(
      lt(
        portfolioSnapshots.updatedAt,
        sql`NOW() - INTERVAL '${STALE_MINUTES} minutes'`
      )
    )
    .limit(50);

  // Merge + deduplicate
  const userIds = new Set([
    ...noSnapshotResult.map((u) => u.id),
    ...staleResult.map((s) => s.id),
  ]);

  if (userIds.size === 0) {
    console.log("[SnapshotUpdater] No stale snapshots — nothing to do");
    return { updated: 0, skipped: 0, errors: 0 };
  }

  console.log(`[SnapshotUpdater] Processing ${userIds.size} user(s)`);

  let updated = 0, skipped = 0, errors = 0;

  for (const userId of userIds) {
    try {
      const walletList = await getConsolidatedWalletList(userId);
      if (walletList.length === 0) { skipped++; continue; }

      const portfolio  = await buildPortfolio(walletList);
      const enriched   = await enrichPortfolio(portfolio);
      const serialized = serializePortfolio(enriched);

      const totalValueUsd = parseFloat(enriched.totalValueUsd) || 0;
      const chains = new Set(enriched.aggregatedAssets.map((a) => a.network));
      const assetCount = enriched.aggregatedAssets.length;

      // Upsert — ON CONFLICT (user_id) DO UPDATE (PostgreSQL syntax)
      await db
        .insert(portfolioSnapshots)
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
        });

      updated++;
      console.log(`[SnapshotUpdater] Updated snapshot for user ${userId} ($${totalValueUsd.toFixed(2)})`);
    } catch (err) {
      errors++;
      console.error(`[SnapshotUpdater] Failed for user ${userId}:`, err);
    }
  }

  return { updated, skipped, errors };
}

