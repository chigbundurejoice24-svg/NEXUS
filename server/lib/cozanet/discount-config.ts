/**
 * discount-config.ts
 * Single source of truth for all Cozanet discount tiers and fee constants.
 * Change here → affects the entire system.
 */

export const BASE_FEE_BPS = 50;          // 0.50%
export const BASE_FEE_PERCENT = 0.5;     // human-readable version

/** Tiers: minimum CZN held → discount in basis points */
export const DISCOUNT_TIERS = [
  { minCzn: 5000,  discountBps: 5000, discountPercent: 50 },
  { minCzn: 1000,  discountBps: 3000, discountPercent: 30 },
  { minCzn: 500,   discountBps: 2000, discountPercent: 20 },
  { minCzn: 100,   discountBps: 1000, discountPercent: 10 },
  { minCzn: 0,     discountBps: 0,    discountPercent: 0  },
] as const;

/** Human-readable tiers for frontend display */
export const TIER_DISPLAY = DISCOUNT_TIERS.map(t => ({
  min: t.minCzn,
  discount: t.discountPercent,
}));

/** Cozanet token details */
export const CZN_TOKEN = {
  symbol: "CZN",
  name: "Cozanet Token",
  network: "bsc",
  // Contract address on BSC (BEP-20)
  address: "0x0000000000000000000000000000000000000000" as `0x${string}`, // TODO: set real address
  coingeckoId: "cozanet",
  apespaceKey: "bsc:CZN",
  dexscreenerPair: "", // TODO: set pair address
} as const;
