/**
 * transactions.ts — tRPC router
 *
 * Transaction lifecycle:
 *   create        → CREATED  (idempotent)
 *   sendMoney     → QUOTED → SIMULATED → PENDING_SIGNATURE (combined, with off-ramp)
 *   submit        → SUBMITTED (store tx hash after user signs)
 *   build         → SIMULATED (manual, crypto-to-crypto)
 *   requestSig    → PENDING_SIGNATURE (manual)
 *   transition    → any valid next state
 *   get / list    → ownership-checked reads
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { isAddress } from "viem";
import { TransactionService, SUPPORTED_CHAIN_IDS } from "../lib/transactions/transaction-service";
import { TransactionStateMachine } from "../lib/transactions/transaction-state-machine";
import { TransactionBuilder } from "../lib/transactions/transaction-builder";
import { OffRampService } from "../lib/ramps/offramp-service";
import { getDb } from "../db";
import { transactions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const SUPPORTED_CHAINS_SET = new Set(SUPPORTED_CHAIN_IDS as readonly number[]);

const BigIntStringSchema = z
  .string()
  .regex(/^[0-9]+$/, "Amount must be a positive integer string")
  .refine((s) => BigInt(s) > 0n, "Amount must be greater than zero");

export const transactionsRouter = router({

  // ── CREATE (crypto-to-crypto) ─────────────────────────────────────
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
      });

      return { transactionId: txId };
    }),

  // ── SEND MONEY TO BANK (combined: quote → create → build → pending_sig) ──
  // This is the primary Send Money flow.
  // 1. Gets an off-ramp quote (rate, fee, deposit address) from Transak
  // 2. Creates the tx record routing to the deposit address
  // 3. Builds + simulates on-chain calldata
  // 4. Advances to PENDING_SIGNATURE, returns unsigned txs for the client to sign
  sendMoney: protectedProcedure
    .input(
      z.object({
        referenceId:    z.string().min(1).max(255),
        idempotencyKey: z.string().min(1).max(255),
        chainId: z.number().int().refine(
          (c) => SUPPORTED_CHAINS_SET.has(c),
          `Unsupported chain: ${SUPPORTED_CHAIN_IDS.join(", ")}`
        ),
        wallet:        z.string().refine(isAddress, "Invalid sender wallet address"),
        recipientBank: z.object({
          bankCode:      z.string().min(1),
          accountNumber: z.string().min(5).max(20),
          accountName:   z.string().min(1),
          currency:      z.string().length(3).default("NGN"),
        }),
        amountRaw:     BigIntStringSchema,  // USDT in smallest unit (e.g. 6 decimals)
        tokenDecimals: z.number().int().min(0).max(18),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const usdtAmount = Number(input.amountRaw) / 10 ** input.tokenDecimals;

      // ── 1. Get off-ramp quote from Transak ──────────────────────
      let quote;
      try {
        quote = await OffRampService.getQuote({
          usdtAmount,
          currency:      input.recipientBank.currency,
          bankCode:      input.recipientBank.bankCode,
          accountNumber: input.recipientBank.accountNumber,
          accountName:   input.recipientBank.accountName,
        });
      } catch (err: any) {
        throw new TRPCError({
          code:    "INTERNAL_SERVER_ERROR",
          message: `Could not get off-ramp quote: ${err?.message}`,
        });
      }

      // ── 2. Create transaction (recipient = Transak deposit address) ──
      let txId: number;
      try {
        txId = await TransactionService.createTransaction({
          userId:         ctx.user.id,
          referenceId:    input.referenceId,
          idempotencyKey: input.idempotencyKey,
          chainId:        input.chainId,
          wallet:         input.wallet,
          // IMPORTANT: recipient is the off-ramp deposit address, not the bank account
          recipient:      quote.depositAddress,
          amountRaw:      BigInt(input.amountRaw),
          tokenDecimals:  input.tokenDecimals,
        });
      } catch (err: any) {
        throw new TRPCError({
          code:    "INTERNAL_SERVER_ERROR",
          message: `Failed to create transaction: ${err?.message}`,
        });
      }

      // ── 3. Store quoteId + bank details in metadata for poller ──
      const db = await getDb();
      if (db) {
        await db
          .update(transactions)
          .set({
            metadata: {
              quoteId:     quote.quoteId,
              bankDetails: {
                bankCode:      input.recipientBank.bankCode,
                accountNumber: input.recipientBank.accountNumber,
                accountName:   input.recipientBank.accountName,
                currency:      input.recipientBank.currency,
              },
              provider:      quote.provider,
              estimatedFiat: quote.estimatedFiat,
              fiatCurrency:  quote.fiatCurrency,
            },
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, txId));
      }

      // ── 4. Advance to QUOTED ─────────────────────────────────────
      await TransactionStateMachine.transition(txId, "QUOTED");

      // ── 5. Build calldata + simulate (QUOTED → SIMULATED) ───────
      let buildResult;
      try {
        buildResult = await TransactionBuilder.build(txId, quote.depositAddress);
      } catch (err: any) {
        throw new TRPCError({
          code:    "INTERNAL_SERVER_ERROR",
          message: `Build failed: ${err?.message}`,
        });
      }

      // ── 6. Advance to PENDING_SIGNATURE ──────────────────────────
      await TransactionBuilder.requestSignature(txId);

      // ── 7. Return everything the client needs to sign ─────────────
      return {
        transactionId: txId,
        unsignedTxs:   buildResult,
        quote: {
          provider:      quote.provider,
          estimatedFiat: quote.estimatedFiat,
          fiatCurrency:  quote.fiatCurrency,
          fee:           quote.fee,
          feePercent:    quote.feePercent,
          rate:          quote.rate,
          estimatedTime: quote.estimatedTime,
        },
      };
    }),

  // ── GET ───────────────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
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

  // ── BUILD (manual, crypto-to-crypto) ─────────────────────────────
  build: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.state !== "QUOTED") {
        throw new TRPCError({
          code:    "PRECONDITION_FAILED",
          message: `Transaction must be QUOTED — current: ${tx.state}`,
        });
      }
      try {
        return await TransactionBuilder.build(input.transactionId);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message });
      }
    }),

  // ── REQUEST SIGNATURE ─────────────────────────────────────────────
  requestSignature: protectedProcedure
    .input(z.object({ transactionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.state !== "SIMULATED") {
        throw new TRPCError({
          code:    "PRECONDITION_FAILED",
          message: `Transaction must be SIMULATED — current: ${tx.state}`,
        });
      }
      await TransactionBuilder.requestSignature(input.transactionId);
      return { success: true };
    }),

  // ── SUBMIT (after user signs) ─────────────────────────────────────
  submit: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().int().positive(),
        txHash: z
          .string()
          .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid tx hash"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const tx = await TransactionService.getTransaction(input.transactionId, ctx.user.id);
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" });
      if (tx.state !== "PENDING_SIGNATURE") {
        throw new TRPCError({
          code:    "PRECONDITION_FAILED",
          message: `Transaction must be PENDING_SIGNATURE — current: ${tx.state}`,
        });
      }
      await TransactionBuilder.submit(input.transactionId, input.txHash);
      return { success: true };
    }),
});
// build: 1780489318
