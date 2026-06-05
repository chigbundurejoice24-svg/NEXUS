/**
 * discount-config.ts
 * Single source of truth for all Cozanet discount tiers and fee constants.
 * Verified on-chain: 0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA (BSC BEP-20)
 *   Name: Cozanet | Symbol: CZN | Decimals: 9 | Supply: 100T
 */

export const BASE_FEE_BPS = 50;        // 0.50%
export const BASE_FEE_PERCENT = 0.5;   // human-readable

/** Tiers: minimum CZN held → discount in basis points */
export const DISCOUNT_TIERS = [
  { minCzn: 5000,  discountBps: 5000, discountPercent: 50 },
  { minCzn: 1000,  discountBps: 3000, discountPercent: 30 },
  { minCzn: 500,   discountBps: 2000, discountPercent: 20 },
  { minCzn: 100,   discountBps: 1000, discountPercent: 10 },
  { minCzn: 0,     discountBps: 0,    discountPercent: 0  },
] as const;

export const TIER_DISPLAY = DISCOUNT_TIERS.map(t => ({
  min: t.minCzn,
  discount: t.discountPercent,
}));

/** ✅ Verified on-chain 2026-06-05 */
export const CZN_TOKEN = {
  symbol:          "CZN",
  name:            "Cozanet",
  network:         "bsc",
  chainId:         56,
  decimals:        9,   // ⚠️ 9 decimals, NOT 18
  address:         "0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA" as `0x${string}`,
  coingeckoId:     "cozanet",
  dexscreenerPair: "0xdf7576158840899eeab2081fd0ed46e3428a4c0d", // CZN/WBNB pair
  pancakeswapUrl:  "https://pancakeswap.finance/swap?outputCurrency=0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA",
  bscscanUrl:      "https://bscscan.com/token/0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA",
} as const;

/** Routing: no direct USDT/CZN pair — must go USDT → WBNB → CZN */
export const SWAP_ROUTE = {
  USDT:  "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`,
  WBNB:  "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as `0x${string}`,
  CZN:   "0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA" as `0x${string}`,
  path:  ["0x55d398326f99059fF775485246999027B3197955", "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA"] as `0x${string}`[],
} as const;
