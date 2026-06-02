/**
 * discount-calculator.ts
 *
 * Calculates Cozanet discount from an aggregated portfolio.
 * All fee maths uses bigint to avoid floating-point drift.
 */

import { DISCOUNT_TIERS, BASE_FEE_BPS } from "./discount-config";
import type { Portfolio } from "../wallets/portfolio-aggregator";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DiscountResult {
  discountBps: number;
  discountPercent: number;
  cznBalance: number;
  effectiveFeeBps: number;
  effectiveFeePercent: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sum all CZN / Cozanet token balances across the portfolio.
 * Matches on symbol "CZN" or "COZANET" (case-insensitive) on BSC.
 */
export function getCozanetBalance(portfolio: Portfolio): number {
  let total = 0;
  for (const asset of portfolio.assets) {
    const sym = (asset.symbol ?? "").toUpperCase();
    if (
      (sym === "CZN" || sym === "COZANET") &&
      asset.network?.toLowerCase() === "bsc"
    ) {
      total += asset.balance ?? 0;
    }
  }
  return total;
}

/**
 * Return the discount tier that matches the user's CZN balance.
 */
export function getDiscountResult(cznBalance: number): DiscountResult {
  const tier = DISCOUNT_TIERS.find(t => cznBalance >= t.minCzn) ?? DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];
  const effectiveFeeBps = BASE_FEE_BPS - Math.floor(BASE_FEE_BPS * tier.discountBps / 10000);
  return {
    discountBps: tier.discountBps,
    discountPercent: tier.discountPercent,
    cznBalance,
    effectiveFeeBps,
    effectiveFeePercent: effectiveFeeBps / 100,
  };
}

/** Convenience: just the discount percent (0–50) */
export function getDiscountPercent(cznBalance: number): number {
  return getDiscountResult(cznBalance).discountPercent;
}

/**
 * Apply the discount and return the final fee in the same bigint units as amountRaw.
 * Uses integer maths throughout — no floating-point.
 *
 * Formula: fee = amountRaw * effectiveFeeBps / 10000
 */
export function calculateFeeRaw(amountRaw: bigint, cznBalance: number): bigint {
  const { effectiveFeeBps } = getDiscountResult(cznBalance);
  return (amountRaw * BigInt(effectiveFeeBps)) / 10000n;
}
