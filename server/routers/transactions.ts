/**
 * transactions.ts — tRPC router
 *
 * Exposes transaction lifecycle to the frontend:
 *   - create: CREATED state, idempotent
 *   - get: ownership-checked fetch
 *   - list: all transactions for the authenticated user
 *   - transition: advance state (CREATED → QUOTED, etc.)
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { isAddress } from "viem";
import { TransactionService, SUPPORTED_CHAIN_IDS } from "../lib/transactions/transaction-service";
import { TransactionStateMachine } from "../lib/transactions/transaction-state-machine";

const SUPPORTED_CHAINS_SET = new Set(SUPPORTED_CHAIN_IDS as readonly number[]);

// Validate bigint-as-string safely (no scientific notation, no negatives)
const BigIntStringSchema = z
  .string()
  .regex(/^[0-9]+$/, "Amount must be a positive integer string (smallest token unit)")
  .refine((s) => BigInt(s) > 0n, "Amount must be greater than zero");

export const transactionsRouter = router({
  /** Create a new transaction — idempotent via idempotencyKey */
  create: protectedProcedure
    .input(
      z.object({
        referenceId: z.string().min(1).max(255),
        idempotencyKey: z.string().min(1).max(255),
        chainId: z.number().int().refine(
          (c) => SUPPORTED_CHAINS_SET.has(c),
          `Unsupported chain. Supported: ${SUPPORTED_CHAIN_IDS.join(", ")}`
        ),
        wallet: z.string().refine(isAddress, "Invalid sender wallet address"),
        recipient: z.string().refine(isAddress, "Invalid recipient address"),
        amountRaw: BigIntStringSchema,
        tokenDecimals: z.number().int().min(0).max(18),
        businessIds: z.array(z.number().int().positive()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const txId = await TransactionService.createTransaction({
        userId: ctx.user.id,
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
        chainId: input.chainId,
        wallet: input.wallet,
        recipient: input.recipient,
        amountRaw: BigInt(input.amountRaw),
        tokenDecimals: input.tokenDecimals,
        businessIds: input.businessIds,
      });

      return { transactionId: txId };
    }),

  /** Get a single transaction — ownership enforced */
  get: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      return tx;
    }),

  /** List all transactions for the authenticated user */
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return TransactionService.listTransactions(ctx.user.id, input.limit);
    }),

  /** Advance transaction state — only valid transitions accepted */
  transition: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().int().positive(),
        toState: z.enum([
          "QUOTED",
          "SIMULATED",
          "PENDING_SIGNATURE",
          "SUBMITTED",
          "CONFIRMED",
          "SETTLED",
          "FAILED",
          "REVERSED",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Ownership check before allowing any state transition
      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });

      await TransactionStateMachine.transition(input.transactionId, input.toState);
      return { success: true, state: input.toState };
    }),
});
