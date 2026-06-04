/**
 * price-cache.ts — In-memory price cache (MVP)
 *
 * Returns prices from the DB cache (updated by background cron).
 * Falls back to live CoinGecko on first call or when DB is empty.
 *
 * NOTE: Replace priceCache with Upstash Redis when scaling to 1000+ users.
 */
import { getDb } from "../../db";

// Module-level memory cache (survives within a single serverless warm instance)
let _priceCache: Record<string, number> = {};
let _lastFetch = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function getCachedPrices(): Promise<Record<string, number>> {
  const now = Date.now();

  // Return in-memory cache if still fresh
  if (now - _lastFetch < CACHE_TTL_MS && Object.keys(_priceCache).length > 0) {
    return _priceCache;
  }

  try {
    // Fetch live prices using the existing engine (CoinGecko + PancakeSwap)
    const { fetchTokenPrices } = await import("../prices/fetch-prices");

    // Standard asset keys we always want cached
    const STANDARD_KEYS = [
      "bsc:BNB", "ethereum:ETH", "ethereum:BTC", "ethereum:USDT", "ethereum:USDC",
      "polygon:MATIC", "arbitrum:ETH", "bsc:CZN",
    ];

    const prices = await fetchTokenPrices(STANDARD_KEYS);

    if (Object.keys(prices).length > 0) {
      _priceCache = prices;
      _lastFetch = now;
      console.log(`[PriceCache] Refreshed ${Object.keys(prices).length} prices`);
    }

    return _priceCache;
  } catch (err) {
    console.error("[PriceCache] Failed to refresh prices:", err);
    return _priceCache; // Return stale cache rather than crashing
  }
}

export function getCachedPrice(assetKey: string): number {
  return _priceCache[assetKey] ?? 0;
}

