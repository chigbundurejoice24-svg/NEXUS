/**
 * discount-calculator.ts
 * All fee maths uses integer basis-point arithmetic — no floating-point drift.
 */
import { DISCOUNT_TIERS, BASE_FEE_BPS } from "./discount-config";
import type { Portfolio } from "../wallets/portfolio-aggregator";

export interface DiscountResult {
  discountBps: number;
  discountPercent: number;
  cznBalance: number;
  effectiveFeeBps: number;
  effectiveFeePercent: number;
}

/**
 * Sum all CZN / COZANET balances across the portfolio (BSC only).
 * Reads from aggregatedAssets — the correct field in the Portfolio type.
 */
export function getCozanetBalance(portfolio: Portfolio): number {
  let total = 0;
  for (const asset of portfolio.aggregatedAssets) {
    const sym = (asset.token ?? "").toUpperCase();
    if (
      (sym === "CZN" || sym === "COZANET") &&
      asset.network?.toLowerCase() === "bsc"
    ) {
      total += parseFloat(asset.totalBalance ?? "0");
    }
  }
  return total;
}

export function getDiscountResult(cznBalance: number): DiscountResult {
  const tier =
    DISCOUNT_TIERS.find(t => cznBalance >= t.minCzn) ??
    DISCOUNT_TIERS[DISCOUNT_TIERS.length - 1];
  const effectiveFeeBps = BASE_FEE_BPS - Math.floor((BASE_FEE_BPS * tier.discountBps) / 10000);
  return {
    discountBps: tier.discountBps,
    discountPercent: tier.discountPercent,
    cznBalance,
    effectiveFeeBps,
    effectiveFeePercent: effectiveFeeBps / 100,
  };
}

export function getDiscountPercent(cznBalance: number): number {
  return getDiscountResult(cznBalance).discountPercent;
}

/**
 * Fee in smallest token units (bigint) — no floating-point.
 * fee = amountRaw × effectiveFeeBps / 10000
 */
export function calculateFeeRaw(amountRaw: bigint, cznBalance: number): bigint {
  const { effectiveFeeBps } = getDiscountResult(cznBalance);
  return (amountRaw * BigInt(effectiveFeeBps)) / 10000n;
}
