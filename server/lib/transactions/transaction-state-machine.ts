/**
 * transaction-state-machine.ts
 *
 * The ONLY place in the codebase that updates transaction.state.
 * All state changes go through here — no direct DB updates allowed elsewhere.
 *
 * Uses pessimistic row locking (SELECT ... FOR UPDATE inside a transaction)
 * to prevent concurrent race conditions on the same transaction record.
 *
 * Ledger entries are posted during QUOTED (fee reservation) and SETTLED (final entry).
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { transactions, type TransactionState } from "../../../drizzle/schema";
import type { LedgerService } from "./ledger-service";
import { StubLedgerService } from "./ledger-service";

// ─────────────────────────────────────────────
// Valid state transitions — enforced strictly
// ─────────────────────────────────────────────
const VALID_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  CREATED:            ["QUOTED",    "FAILED"],
  QUOTED:             ["SIMULATED", "FAILED"],
  SIMULATED:          ["PENDING_SIGNATURE", "FAILED"],
  PENDING_SIGNATURE:  ["SUBMITTED", "FAILED"],
  SUBMITTED:          ["CONFIRMED", "FAILED"],
  CONFIRMED:          ["SETTLED",   "REVERSED"],
  SETTLED:            [],
  FAILED:             ["REVERSED",  "CREATED"],
  REVERSED:           [],
};

// Default to stub until real ledger is wired
const defaultLedger: LedgerService = new StubLedgerService();

export class TransactionStateMachine {
  /**
   * Transition a transaction to a new state.
   * Runs inside a DB transaction with a FOR UPDATE row lock.
   * Throws if the transition is invalid or the record does not exist.
   */
  static async transition(
    transactionId: number,
    toState: TransactionState,
    ledgerService: LedgerService = defaultLedger
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.transaction(async (tx) => {
      // Pessimistic lock — prevents two concurrent calls from both seeing CREATED
      // and both transitioning to QUOTED simultaneously.
      const [record] = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .for("update");

      if (!record) throw new Error(`Transaction ${transactionId} not found`);

      const currentState = record.state as TransactionState;
      const allowed = VALID_TRANSITIONS[currentState];

      if (!allowed || !allowed.includes(toState)) {
        throw new Error(
          `Invalid state transition: ${currentState} → ${toState}. ` +
          `Allowed from ${currentState}: [${allowed?.join(", ") ?? "none"}]`
        );
      }

      // ── Quote expiry guard ───────────────────────────────────────
      // Enforce before SIMULATED — quote must still be valid
      if (toState === "SIMULATED" && record.quoteExpiresAt) {
        if (new Date() > record.quoteExpiresAt) {
          throw new Error(
            "Quote has expired. Please create a new transaction to get a fresh quote."
          );
        }
      }

      // ── Ledger events ────────────────────────────────────────────
      if (toState === "QUOTED") {
        await ledgerService.postFeeEntry({
          userId: record.userId,
          amount: record.feeRaw,
          tokenDecimals: record.tokenDecimals,
          referenceId: record.referenceId,
        });
      }

      if (toState === "SETTLED") {
        await ledgerService.postSettlementEntry({
          userId: record.userId,
          amount: record.amountRaw,
          fee: record.feeRaw,
          tokenDecimals: record.tokenDecimals,
          referenceId: record.referenceId,
          txHash: record.txHash,
        });
      }

      // ── Persist new state ────────────────────────────────────────
      await tx
        .update(transactions)
        .set({ state: toState, updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));
    });
  }

  /** Read-only state fetch */
  static async getState(transactionId: number): Promise<TransactionState | null> {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({ state: transactions.state })
      .from(transactions)
      .where(eq(transactions.id, transactionId));
    return (row?.state as TransactionState) ?? null;
  }
}
