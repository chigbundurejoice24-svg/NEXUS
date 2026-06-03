/**
 * ai.ts — AegisAI insights engine
 *
 * Rules-based (no LLM cost). Uses real data from:
 *   - cozanet discount engine
 *   - portfolio aggregator
 *   - transactions table
 *   - live prices
 *
 * Procedure: ai.getInsights → { insights[], cznPrice }
 */
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, transactions, linkedWallets } from "../../drizzle/schema";
import { eq, count, gte } from "drizzle-orm";
import { getConsolidatedWalletList } from "../lib/accounts/wallet-list";
import { buildPortfolio } from "../lib/wallets/portfolio-aggregator";
import { getCozanetBalance, getDiscountResult } from "../lib/cozanet/discount-calculator";
import { fetchTokenPrices } from "../lib/prices/fetch-prices";
import { CZN_TOKEN } from "../lib/cozanet/discount-config";

type InsightType = "discount" | "savings" | "portfolio" | "activity" | "market" | "tip" | "warning";

interface Insight {
  id:          string;
  type:        InsightType;
  title:       string;
  body:        string;
  badge?:      string;
  badgeColor?: "green" | "blue" | "purple" | "yellow" | "red";
  value?:      string;
}

export const aiRouter = router({
  getInsights: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const userId = ctx.user!.id;
    const insights: Insight[] = [];

    // ── 1. CZN price (always available) ─────────────────────────
    let cznPriceUsd = 0;
    try {
      const prices = await fetchTokenPrices([CZN_TOKEN.coingeckoId]);
      cznPriceUsd = prices[CZN_TOKEN.coingeckoId] ?? 0;
    } catch { /* non-fatal */ }

    // ── 2. Portfolio + CZN discount ───────────────────────────────
    let totalValueUsd = 0;
    let topAssetSymbol = "USDT";
    let cznBalance = 0;
    let discountPercent = 0;
    let effectiveFeePercent = 1.0;

    try {
      const walletList = await getConsolidatedWalletList(userId);
      if (walletList.length > 0) {
        const portfolio = await buildPortfolio(walletList);
        const assets = (portfolio as any).assets ?? [];

        totalValueUsd = assets.reduce((sum: number, a: any) => sum + (a.balanceUsd ?? 0), 0);
        if (assets.length > 0) {
          topAssetSymbol = assets.sort((a: any, b: any) => b.balanceUsd - a.balanceUsd)[0]?.symbol ?? "USDT";
        }

        cznBalance = getCozanetBalance(portfolio as any);
        const disc = getDiscountResult(cznBalance);
        discountPercent   = disc.discountPercent;
        effectiveFeePercent = disc.effectiveFeePercent;
      }
    } catch { /* non-fatal — DB might be empty */ }

    // ── 3. Monthly transaction count ──────────────────────────────
    let monthlyTxCount = 0;
    try {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [row] = await db.select({ cnt: count() })
        .from(transactions)
        .where(eq(transactions.userId, userId));
      monthlyTxCount = Number(row?.cnt ?? 0);
    } catch { /* non-fatal */ }

    // ── 4. User email verification status ─────────────────────────
    let emailVerified = false;
    try {
      const [user] = await db.select({ emailVerified: users.emailVerified })
        .from(users).where(eq(users.id, userId)).limit(1);
      emailVerified = user?.emailVerified ?? false;
    } catch { /* non-fatal */ }

    // ══ BUILD INSIGHTS ══════════════════════════════════════════

    // Discount / CZN insight
    if (cznBalance > 0) {
      insights.push({
        id: "czn-discount",
        type: "discount",
        title: "Cozanet Discount Active 🎉",
        body: `You hold ${cznBalance.toFixed(2)} CZN → you save ${discountPercent}% on all transfer fees. Your effective fee rate is ${effectiveFeePercent}%.`,
        badge:      `${discountPercent}% OFF`,
        badgeColor: "green",
        value:      `${cznBalance.toFixed(2)} CZN`,
      });
    } else {
      insights.push({
        id: "czn-buy",
        type: "tip",
        title: "Buy Cozanet (CZN) to Save on Fees",
        body: "Hold as little as 100 CZN to unlock a 10% discount on all transfer fees. Holding 500+ CZN gives you 25% off.",
        badge:      "Get Started",
        badgeColor: "purple",
      });
    }

    // Savings comparison
    const exampleAmount = 100;
    const aegisFee = exampleAmount * (effectiveFeePercent / 100);
    insights.push({
      id: "savings",
      type: "savings",
      title: "You're Saving vs Traditional Remittance",
      body: `Sending $${exampleAmount} via Aegis costs $${aegisFee.toFixed(2)} in fees — that's ${(((8 - aegisFee) / 8) * 100).toFixed(0)}% cheaper than the $8+ average with banks or services like Western Union.`,
      badge:      `$${(8 - aegisFee).toFixed(2)} saved`,
      badgeColor: "green",
      value:      `$${aegisFee.toFixed(2)} fee`,
    });

    // Portfolio health
    if (totalValueUsd > 0) {
      insights.push({
        id: "portfolio",
        type: "portfolio",
        title: "Portfolio Health",
        body: `Your total portfolio value is $${totalValueUsd.toFixed(2)}. Top holding: ${topAssetSymbol}. Keep your wallet connected to track real-time changes.`,
        badge:      `$${totalValueUsd.toFixed(2)}`,
        badgeColor: "blue",
        value:      `$${totalValueUsd.toFixed(2)}`,
      });
    } else {
      insights.push({
        id: "portfolio-empty",
        type: "tip",
        title: "Connect a Wallet to Track Your Portfolio",
        body: "Once you connect an EVM wallet, Aegis will track your real-time balances across Ethereum, BNB Chain, Polygon, and Arbitrum.",
        badge:      "Set Up",
        badgeColor: "blue",
      });
    }

    // Activity tip
    if (monthlyTxCount >= 5) {
      insights.push({
        id: "activity-reward",
        type: "activity",
        title: "You're a Power User! 💪",
        body: `You've made ${monthlyTxCount} transfers on Aegis. You're on track to earn bonus CZN Points — keep going!`,
        badge:      `${monthlyTxCount} transfers`,
        badgeColor: "purple",
      });
    } else if (monthlyTxCount > 0) {
      insights.push({
        id: "activity-progress",
        type: "tip",
        title: "You're Building Momentum",
        body: `${monthlyTxCount} transfer${monthlyTxCount > 1 ? "s" : ""} so far this period. Make ${5 - monthlyTxCount} more to earn bonus CZN Points.`,
        badge:      `${5 - monthlyTxCount} to go`,
        badgeColor: "yellow",
      });
    } else {
      insights.push({
        id: "activity-first",
        type: "tip",
        title: "Make Your First Transfer",
        body: "Send money to any Nigerian bank account in under 60 seconds. Your first transfer earns you 50 CZN Points.",
        badge:      "50 CZN Bonus",
        badgeColor: "yellow",
      });
    }

    // Email verification warning
    if (!emailVerified) {
      insights.push({
        id: "email-unverified",
        type: "warning",
        title: "Verify Your Email for Higher Limits",
        body: "Unverified accounts have a $100/day transfer limit. Verify your email in Settings to unlock $10,000/day limits and account recovery.",
        badge:      "Action Needed",
        badgeColor: "yellow",
      });
    }

    // Market pulse
    if (cznPriceUsd > 0) {
      insights.push({
        id: "market",
        type: "market",
        title: "Cozanet (CZN) Market Pulse",
        body: `CZN is currently trading at $${cznPriceUsd.toFixed(6)} USD. The more CZN you hold, the more you save on fees — and the more the ecosystem grows.`,
        badge:      `$${cznPriceUsd.toFixed(4)}`,
        badgeColor: "blue",
        value:      `$${cznPriceUsd.toFixed(6)}`,
      });
    }

    return { insights, cznPriceUsd, totalValueUsd, emailVerified };
  }),
});
