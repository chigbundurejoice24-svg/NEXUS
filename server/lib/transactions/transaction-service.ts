/**
 * transaction-service.ts
 *
 * Creates new transactions (CREATED state) with:
 *   - Race-proof idempotency via unique DB index + try/catch
 *   - Bigint-precise fee calculation (no floating-point)
 *   - Cozanet discount applied in basis points
 *   - Quote expiry (5 minutes)
 *   - Request hash for replay protection (keccak256 of critical fields)
 *   - Risk evaluation before insert
 */

import { eq, and } from "drizzle-orm";
import { keccak256, encodePacked } from "viem";
import { getDb } from "../../db";
import { transactions } from "../../../drizzle/schema";
import { TransactionStateMachine } from "./transaction-state-machine";
import { RiskService } from "./risk-service";
import { getConsolidatedWalletList } from "../accounts/wallet-list";
import { buildPortfolio } from "../wallets/portfolio-aggregator";
import type { LedgerService } from "./ledger-service";

// ── Fee config ────────────────────────────────────────────────────
// Base fee: 0.5% expressed in basis points
const BASE_FEE_BPS = 50n;     // Use bigint to keep all math in bigint
const BPS_DENOMINATOR = 10_000n;

// ── Supported chains ──────────────────────────────────────────────
export const SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161] as const; // ETH, BSC, Polygon, Arbitrum

// ─────────────────────────────────────────────────────────────────

export class TransactionService {
  /**
   * Create a new transaction in CREATED state.
   * Idempotent: calling with the same idempotencyKey returns the existing tx id.
   */
  static async createTransaction(params: {
    userId: number;
    referenceId: string;
    idempotencyKey: string;
    chainId: number;
    wallet: string;
    recipient: string;
    amountRaw: bigint;
    tokenDecimals: number;
    /** Optional business IDs to include in wallet consolidation */
    businessIds?: number[];
    ledgerService?: LedgerService;
  }): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    try {
      return await db.transaction(async (tx) => {
        // ── 1. Build portfolio for discount calculation ──────────
        const walletList = await getConsolidatedWalletList(
          params.userId,
          params.businessIds
        );
        const portfolio = walletList.length > 0
          ? await buildPortfolio(walletList)
          : null;

        // ── 2. Discount & fee (all bigint — zero precision loss) ──
        // Placeholder: cozanet discount config will slot in here once
        // the discount module is adapted to Drizzle.
        // For now: 0 discount, full BASE_FEE_BPS.
        const discountBps = 0n;
        const feeRaw = calculateFee(params.amountRaw, BASE_FEE_BPS, discountBps);
        const cozanetSnapshot = "0"; // will be real CZN balance once discount module lands

        // ── 3. Quote expiry ───────────────────────────────────────
        const quoteExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // ── 4. Request hash (keccak256 replay protection) ─────────
        const requestHash = keccak256(
          encodePacked(
            ["address", "uint256", "uint8", "uint256", "address", "uint256"],
            [
              params.recipient as `0x${string}`,
              params.amountRaw,
              params.tokenDecimals,
              BigInt(params.chainId),
              params.wallet as `0x${string}`,
              feeRaw,
            ]
          )
        );

        // ── 5. Risk evaluation ────────────────────────────────────
        const risk = await RiskService.evaluate({
          userId: params.userId,
          amountRaw: params.amountRaw,
          tokenDecimals: params.tokenDecimals,
          chainId: params.chainId,
        });

        if (risk.blocked) {
          throw new Error(
            `Transaction blocked by risk engine. Flags: ${risk.flags.join(", ")}`
          );
        }

        // ── 6. Insert ─────────────────────────────────────────────
        await tx.insert(transactions).values({
          userId: params.userId,
          referenceId: params.referenceId,
          idempotencyKey: params.idempotencyKey,
          state: "CREATED",
          chainId: params.chainId,
          wallet: params.wallet.toLowerCase(),
          recipient: params.recipient.toLowerCase(),
          amountRaw: params.amountRaw,
          tokenDecimals: params.tokenDecimals,
          feeRaw,
          discountBps: Number(discountBps),
          cozanetSnapshot,
          quoteExpiresAt,
          requestHash,
          riskFlags: risk.flags,
        });

        // ── 7. Retrieve the newly created record id ───────────────
        // MySQL autoincrement — use referenceId + userId to retrieve
        const [created] = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, params.userId),
              eq(transactions.referenceId, params.referenceId),
              eq(transactions.idempotencyKey, params.idempotencyKey)
            )
          )
          .limit(1);

        if (!created) throw new Error("Failed to retrieve created transaction");
        return created.id;
      });
    } catch (err: any) {
      // ── Idempotency: duplicate key = return existing tx id ────────
      if (
        err?.code === "ER_DUP_ENTRY" ||
        err?.message?.includes("Duplicate entry") ||
        err?.message?.includes("idempotency_key_idx")
      ) {
        const [existing] = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.idempotencyKey, params.idempotencyKey))
          .limit(1);
        if (!existing) throw new Error("Idempotency lookup failed — transaction missing");
        return existing.id;
      }
      throw err;
    }
  }

  /** Fetch a transaction — enforces ownership (userId must match) */
  static async getTransaction(transactionId: number, userId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [row] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  /** List all transactions for a user, newest first */
  static async listTransactions(userId: number, limit = 50) {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(transactions.createdAt)
      .limit(limit);
  }
}

// ── Pure helper — all bigint, no floating point ───────────────────
function calculateFee(
  amountRaw: bigint,
  baseFeeBps: bigint,
  discountBps: bigint
): bigint {
  // fee = amountRaw * baseFeeBps / 10000 * (10000 - discountBps) / 10000
  // Written as a single integer expression to avoid rounding mid-calc:
  // fee = amountRaw * baseFeeBps * (10000 - discountBps) / (10000 * 10000)
  return (
    (amountRaw * baseFeeBps * (BPS_DENOMINATOR - discountBps)) /
    (BPS_DENOMINATOR * BPS_DENOMINATOR)
  );
}
