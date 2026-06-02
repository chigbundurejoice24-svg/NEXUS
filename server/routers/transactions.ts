/**
 * transactions.ts — tRPC router
 *
 * Transaction lifecycle:
 *   create     → CREATED  (idempotent)
 *   quote      → QUOTED   (apply fee + expiry)
 *   build      → SIMULATED (construct + simulate on-chain payload)
 *   requestSig → PENDING_SIGNATURE
 *   submit     → SUBMITTED (store tx hash)
 *   transition → any valid next state (admin/manual advance)
 *   get        → ownership-checked fetch
 *   list       → all txs for authenticated user
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { isAddress } from "viem";
import { TransactionService, SUPPORTED_CHAIN_IDS } from "../lib/transactions/transaction-service";
import { TransactionStateMachine } from "../lib/transactions/transaction-state-machine";
import { TransactionBuilder } from "../lib/transactions/transaction-builder";

const SUPPORTED_CHAINS_SET = new Set(SUPPORTED_CHAIN_IDS as readonly number[]);

// Validate bigint-as-string (no scientific notation, positive only)
const BigIntStringSchema = z
  .string()
  .regex(/^[0-9]+$/, "Amount must be a positive integer string (smallest token unit)")
  .refine((s) => BigInt(s) > 0n, "Amount must be greater than zero");

export const transactionsRouter = router({
  // ── CREATE ────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        referenceId:    z.string().min(1).max(255),
        idempotencyKey: z.string().min(1).max(255),
        chainId: z.number().int().refine(
          (c) => SUPPORTED_CHAINS_SET.has(c),
          `Unsupported chain. Supported: ${SUPPORTED_CHAIN_IDS.join(", ")}`
        ),
        wallet:        z.string().refine(isAddress, "Invalid sender wallet address"),
        recipient:     z.string().refine(isAddress, "Invalid recipient address"),
        amountRaw:     BigIntStringSchema,
        tokenDecimals: z.number().int().min(0).max(18),
        businessIds:   z.array(z.number().int().positive()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const txId = await TransactionService.createTransaction({
        userId:         ctx.user.id,
        referenceId:    input.referenceId,
        idempotencyKey: input.idempotencyKey,
        chainId:        input.chainId,
        wallet:         input.wallet,
        recipient:      input.recipient,
        amountRaw:      BigInt(input.amountRaw),
        tokenDecimals:  input.tokenDecimals,
        businessIds:    input.businessIds,
      });

      return { transactionId: txId };
    }),

  // ── GET ───────────────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      return tx;
    }),

  // ── LIST ──────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return TransactionService.listTransactions(ctx.user.id, input.limit);
    }),

  // ── TRANSITION (manual state advance) ────────────────────────────
  transition: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().int().positive(),
        toState: z.enum([
          "QUOTED", "SIMULATED", "PENDING_SIGNATURE",
          "SUBMITTED", "CONFIRMED", "SETTLED", "FAILED", "REVERSED",
        ]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });

      await TransactionStateMachine.transition(input.transactionId, input.toState);
      return { success: true, state: input.toState };
    }),

  // ── BUILD (QUOTED → SIMULATED) ────────────────────────────────────
  // Constructs the ERC-20 transfer calldata and runs on-chain simulation.
  // Returns the unsigned transaction payload for the frontend signing UI.
  build: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.state !== "QUOTED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Transaction must be QUOTED — current state: ${tx.state}`,
        });
      }

      try {
        return await TransactionBuilder.build(input.transactionId);
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err?.message ?? "Build failed",
        });
      }
    }),

  // ── REQUEST SIGNATURE (SIMULATED → PENDING_SIGNATURE) ────────────
  // Call this right before showing the signing UI.
  requestSignature: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.state !== "SIMULATED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Transaction must be SIMULATED — current state: ${tx.state}`,
        });
      }

      await TransactionBuilder.requestSignature(input.transactionId);
      return { success: true };
    }),

  // ── SUBMIT (PENDING_SIGNATURE → SUBMITTED) ────────────────────────
  // Called after the user signs and broadcasts the transaction.
  // Stores the on-chain tx hash and advances state.
  submit: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().int().positive(),
        txHash: z
          .string()
          .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid tx hash — must be 0x followed by 64 hex chars"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.state !== "PENDING_SIGNATURE") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Transaction must be PENDING_SIGNATURE — current state: ${tx.state}`,
        });
      }

      await TransactionBuilder.submit(input.transactionId, input.txHash);
      return { success: true };
    }),
});
