/**
 * ramps.ts — tRPC router for on-ramp and off-ramp operations
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { OnRampService } from "../lib/ramps/onramp-service";
import { OffRampService } from "../lib/ramps/offramp-service";

export const rampsRouter = router({
  /** Best single on-ramp URL for this user */
  onramp: protectedProcedure
    .input(z.object({
      fiatAmount:     z.number().positive(),
      fiatCurrency:   z.string().min(3).max(3).default("NGN"),
      cryptoCurrency: z.string().default("USDT"),
    }))
    .query(async ({ input, ctx }) => {
      return OnRampService.getBestUrl({
        userId: ctx.user!.id,
        fiatAmount: input.fiatAmount,
        fiatCurrency: input.fiatCurrency ?? "NGN",
        cryptoCurrency: input.cryptoCurrency ?? "USDT",
      });
    }),

  /** All on-ramp provider options with fees + estimated crypto */
  onrampAll: protectedProcedure
    .input(z.object({
      fiatAmount:     z.number().positive(),
      fiatCurrency:   z.string().min(3).max(3).default("NGN"),
      cryptoCurrency: z.string().default("USDT"),
    }))
    .query(async ({ input, ctx }) => {
      return OnRampService.getAllUrls({
        userId: ctx.user!.id,
        fiatAmount: input.fiatAmount,
        fiatCurrency: input.fiatCurrency ?? "NGN",
        cryptoCurrency: input.cryptoCurrency ?? "USDT",
      });
    }),

  /** Off-ramp quotes for bank payout */
  offrampQuote: protectedProcedure
    .input(z.object({
      usdtAmount: z.number().positive(),
      currency:   z.string().min(3).max(3).default("NGN"),
    }))
    .query(async ({ input }) => {
      return OffRampService.getQuotes({
        usdtAmount: input.usdtAmount,
        currency: input.currency ?? "NGN",
      });
    }),

  /** Initiate a bank payout */
  offrampPayout: protectedProcedure
    .input(z.object({
      transactionId:          z.string(),
      recipientBankCode:      z.string(),
      recipientAccountNumber: z.string(),
      recipientName:          z.string(),
      amountFiat:             z.number().positive(),
      currency:               z.string(),
    }))
    .mutation(async ({ input }) => {
      return OffRampService.initiatePayout({
        transactionId:          input.transactionId,
        recipientBankCode:      input.recipientBankCode,
        recipientAccountNumber: input.recipientAccountNumber,
        recipientName:          input.recipientName,
        amountFiat:             input.amountFiat,
        currency:               input.currency,
      });
    }),
});
