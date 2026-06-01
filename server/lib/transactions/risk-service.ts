/**
 * risk-service.ts
 *
 * Evaluates transaction risk before CREATED state is committed.
 * Currently implements:
 *   1. Daily spend limit per user (default $10,000 USD equivalent)
 *
 * Extensible: add sanctions screening, device fingerprinting, velocity checks, etc.
 *
 * NOTE: Precision — all amounts stay in bigint smallest-unit until
 * final comparison, to avoid IEEE 754 floating-point errors on large values.
 */

import { eq, gte, and } from "drizzle-orm";
import { sum } from "drizzle-orm";
import { getDb } from "../../db";
import { transactions } from "../../../drizzle/schema";

// ── Configuration ─────────────────────────────────────────────────
// Expressed in USD-equivalent smallest units (6 decimals = USDT standard)
// $10,000 USD = 10_000 * 10^6 = 10_000_000_000n
const DAILY_LIMIT_SMALLEST_UNITS = BigInt(10_000) * BigInt(10 ** 6);
const DAILY_LIMIT_DECIMALS = 6; // USDT/USDC decimals — assumed for limit comparison

// ── Types ─────────────────────────────────────────────────────────
export interface RiskResult {
  blocked: boolean;
  flags: string[];
}

// ══════════════════════════════════════════════════════════════════
export class RiskService {
  static async evaluate(params: {
    userId: number;
    amountRaw: bigint;
    tokenDecimals: number;
    chainId: number;
  }): Promise<RiskResult> {
    const flags: string[] = [];

    const db = await getDb();
    if (!db) {
      // If DB is unavailable, fail-open with a flag (do not block — avoid bricking app)
      flags.push("RISK_DB_UNAVAILABLE");
      return { blocked: false, flags };
    }

    // ── 1. Daily spend limit ────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [result] = await db
      .select({ total: sum(transactions.amountRaw) })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, params.userId),
          gte(transactions.createdAt, todayStart)
        )
      );

    // sum() returns string | null from Drizzle — convert carefully
    const totalSpentRaw = BigInt(result?.total ?? "0");

    // Normalize this tx amount to 6 decimals for comparison
    // (handles tokens with different decimals — e.g. BTC = 8, USDT = 6)
    const thisAmountNormalized =
      params.tokenDecimals >= DAILY_LIMIT_DECIMALS
        ? params.amountRaw / BigInt(10 ** (params.tokenDecimals - DAILY_LIMIT_DECIMALS))
        : params.amountRaw * BigInt(10 ** (DAILY_LIMIT_DECIMALS - params.tokenDecimals));

    if (totalSpentRaw + thisAmountNormalized > DAILY_LIMIT_SMALLEST_UNITS) {
      flags.push("DAILY_LIMIT_EXCEEDED");
    }

    // ── 2. High single-amount flag (> $5,000 equivalent) ───────────
    const HIGH_AMOUNT_THRESHOLD = BigInt(5_000) * BigInt(10 ** DAILY_LIMIT_DECIMALS);
    if (thisAmountNormalized > HIGH_AMOUNT_THRESHOLD) {
      flags.push("HIGH_AMOUNT");
    }

    // ── 3. Blocked — any hard-stop flag blocks the transaction ──────
    const BLOCKING_FLAGS = new Set(["DAILY_LIMIT_EXCEEDED"]);
    const blocked = flags.some((f) => BLOCKING_FLAGS.has(f));

    return { blocked, flags };
  }
}
