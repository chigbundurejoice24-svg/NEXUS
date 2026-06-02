/**
 * cozanet.ts — tRPC router
 *
 * Exposes Cozanet token status for the authenticated user:
 *   getStatus → live CZN price, user Points, discount tier, fee preview
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getConsolidatedWalletList } from "../lib/accounts/wallet-list";
import { buildPortfolio } from "../lib/wallets/portfolio-aggregator";
import {
  getCozanetBalance,
  getDiscountResult,
} from "../lib/cozanet/discount-calculator";
import { fetchTokenPrices } from "../lib/prices/fetch-prices";
import { TIER_DISPLAY, BASE_FEE_PERCENT, CZN_TOKEN } from "../lib/cozanet/discount-config";

// ── Public: live CZN price only (no auth needed, used on landing/login page) ─
export const cozanetRouter = router({
  getPrice: publicProcedure.query(async () => {
    try {
      const prices = await fetchTokenPrices([CZN_TOKEN.coingeckoId]);
      const priceUsd = prices[CZN_TOKEN.coingeckoId] ?? 0;
      return { priceUsd, symbol: CZN_TOKEN.symbol };
    } catch {
      return { priceUsd: 0, symbol: CZN_TOKEN.symbol };
    }
  }),

  // ── Authenticated: full status with user Points ────────────────────────────
  getStatus: protectedProcedure
    .input(
      z.object({
        /** Optional: show what the fee would be for this USDT amount */
        exampleAmountUsdt: z.number().positive().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user!.id;

      // 1. Portfolio (all wallets)
      const walletList = await getConsolidatedWalletList(userId);
      const portfolio = walletList.length > 0
        ? await buildPortfolio(walletList)
        : { assets: [] };

      // 2. CZN price
      let priceUsd = 0;
      try {
        const prices = await fetchTokenPrices([CZN_TOKEN.coingeckoId]);
        priceUsd = prices[CZN_TOKEN.coingeckoId] ?? 0;
      } catch { /* non-fatal */ }

      // 3. User balance + discount
      const cznBalance = getCozanetBalance(portfolio as any);
      const discount = getDiscountResult(cznBalance);

      // 4. Optional fee preview
      let exampleFeeUsdt: string | null = null;
      if (input.exampleAmountUsdt) {
        const fee = (input.exampleAmountUsdt * discount.effectiveFeeBps) / 10000;
        exampleFeeUsdt = fee.toFixed(4);
      }

      return {
        priceUsd,
        pointsBalance: cznBalance.toFixed(2),
        discountPercent: discount.discountPercent,
        discountBps: discount.discountBps,
        baseFeePercent: BASE_FEE_PERCENT,
        effectiveFeePercent: discount.effectiveFeePercent,
        exampleFeeUsdt,
        tiers: TIER_DISPLAY,
      };
    }),
});
