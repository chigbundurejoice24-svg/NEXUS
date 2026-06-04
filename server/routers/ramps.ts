/**
 * ramps.ts — tRPC router for on-ramp and off-ramp operations
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { OnRampService } from "../lib/ramps/onramp-service";
import { OffRampService } from "../lib/ramps/offramp-service";

export const rampsRouter = router({
  onramp: protectedProcedure
    .input(z.object({
      fiatAmount:     z.number().positive(),
      fiatCurrency:   z.string().min(3).max(3).default("NGN"),
      cryptoCurrency: z.string().default("USDT"),
    }))
    .query(async ({ input, ctx }) => {
      return OnRampService.getBestUrl({
        userId:         ctx.user!.id,
        fiatAmount:     input.fiatAmount,
        fiatCurrency:   input.fiatCurrency ?? "NGN",
        cryptoCurrency: input.cryptoCurrency ?? "USDT",
      });
    }),

  onrampAll: protectedProcedure
    .input(z.object({
      fiatAmount:     z.number().positive(),
      fiatCurrency:   z.string().min(3).max(3).default("NGN"),
      cryptoCurrency: z.string().default("USDT"),
    }))
    .query(async ({ input, ctx }) => {
      return OnRampService.getAllUrls({
        userId:         ctx.user!.id,
        fiatAmount:     input.fiatAmount,
        fiatCurrency:   input.fiatCurrency ?? "NGN",
        cryptoCurrency: input.cryptoCurrency ?? "USDT",
      });
    }),

  offrampQuote: protectedProcedure
    .input(z.object({
      usdtAmount: z.number().positive(),
      currency:   z.string().min(3).max(3).default("NGN"),
    }))
    .query(async ({ input }) => {
      return OffRampService.getQuotes({
        usdtAmount: input.usdtAmount,
        currency:   input.currency ?? "NGN",
      });
    }),

  offrampPayout: protectedProcedure
    .input(z.object({
      transactionId:          z.string(),
      bankCode:               z.string(),   // FIX: was recipientBankCode
      recipientAccountNumber: z.string(),
      recipientName:          z.string(),
      amountFiat:             z.number().positive(),
      currency:               z.string(),
    }))
    .mutation(async ({ input }) => {
      return OffRampService.initiatePayout({
        transactionId: input.transactionId,
        bankCode:      input.bankCode,          // FIX: matches OffRampService signature
        accountNumber: input.recipientAccountNumber,
        accountName:   input.recipientName,
        fiatAmount:    input.amountFiat,
        currency:      input.currency,
        quoteId:       "",                      // filled by client from offrampQuote
      });
    }),
});
