/**
 * Price Engine Module
 * Fetches live USD prices from CoinGecko with caching
 * Maps internal token keys to CoinGecko IDs
 */

// ------------------------------------------------------------------
// Mapping from internal key to CoinGecko IDs
// Format: `${network}:${tokenSymbol}`
// ------------------------------------------------------------------
const COINGECKO_ID_MAP: Record<string, string> = {
  // Ethereum
  'ethereum:ETH': 'ethereum',
  'ethereum:USDT': 'tether',
  'ethereum:USDC': 'usd-coin',
  'ethereum:BTC': 'bitcoin',
  'ethereum:BNB': 'binancecoin',

  // BSC (Binance Smart Chain)
  'bsc:BNB': 'binancecoin',
  'bsc:USDT': 'tether',
  'bsc:USDC': 'usd-coin',
  'bsc:ETH': 'ethereum',
  'bsc:BTC': 'bitcoin',

  // Polygon
  'polygon:MATIC': 'matic-network',
  'polygon:USDT': 'tether',
  'polygon:USDC': 'usd-coin',
  'polygon:ETH': 'ethereum',
  'polygon:BTC': 'bitcoin',

  // Arbitrum
  'arbitrum:ETH': 'ethereum',
  'arbitrum:USDT': 'tether',
  'arbitrum:USDC': 'usd-coin',
  'arbitrum:BTC': 'bitcoin',
  'arbitrum:BNB': 'binancecoin',

  // Bitcoin (native)
  'bitcoin:BTC': 'bitcoin',
};

// ------------------------------------------------------------------
// Simple in-memory cache
// ------------------------------------------------------------------
interface CacheEntry {
  prices: Record<string, number>;
  timestamp: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 60_000; // 1 minute – respect CoinGecko free tier (10-30 req/min)

// ------------------------------------------------------------------
// Core function: fetch USD prices for a list of CoinGecko IDs
// ------------------------------------------------------------------
async function fetchCoingeckoPrices(ids: string[]): Promise<Record<string, number>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return {};

  // Check cache for a combined key (sorted IDs ensure consistent hit)
  const cacheKey = uniqueIds.slice().sort().join(',');
  const now = Date.now();
  if (cache[cacheKey] && now - cache[cacheKey]!.timestamp < CACHE_TTL_MS) {
    console.log(`[PriceEngine] Cache hit for: ${cacheKey}`);
    return cache[cacheKey]!.prices;
  }

  try {
    // Fetch from API
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd`;
    console.log(`[PriceEngine] Fetching prices from CoinGecko for: ${uniqueIds.join(', ')}`);
    
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[PriceEngine] CoinGecko API error: ${response.status} ${response.statusText}`);
      // Return stale cache if available, else empty
      if (cache[cacheKey]) {
        console.warn('[PriceEngine] Using stale price cache due to API error.');
        return cache[cacheKey]!.prices;
      }
      return {};
    }

    const data: Record<string, { usd?: number }> = await response.json();
    const prices: Record<string, number> = {};

    for (const id of uniqueIds) {
      prices[id] = data[id]?.usd ?? 0;
    }

    // Store in cache
    cache[cacheKey] = { prices, timestamp: now };
    console.log(`[PriceEngine] Cached prices: ${JSON.stringify(prices)}`);
    return prices;
  } catch (error) {
    console.error('[PriceEngine] Error fetching prices:', error);
    // Return stale cache if available
    if (cache[cacheKey]) {
      console.warn('[PriceEngine] Using stale cache due to fetch error.');
      return cache[cacheKey]!.prices;
    }
    return {};
  }
}

// ------------------------------------------------------------------
// Convert our asset key to CoinGecko ID, fetch all prices, map back
// ------------------------------------------------------------------
export async function fetchTokenPrices(
  assetKeys: string[] // each key like "ethereum:ETH"
): Promise<Record<string, number>> {
  // Build a list of unique CoinGecko IDs needed
  const neededIds = assetKeys
    .map((key) => COINGECKO_ID_MAP[key])
    .filter((id): id is string => !!id);

  if (neededIds.length === 0) {
    console.warn('[PriceEngine] No valid CoinGecko IDs found for asset keys:', assetKeys);
    return {};
  }

  const cgPrices = await fetchCoingeckoPrices(neededIds);

  // Build a map from our key -> USD price
  const priceMap: Record<string, number> = {};
  for (const key of assetKeys) {
    const cgId = COINGECKO_ID_MAP[key];
    if (cgId) {
      priceMap[key] = cgPrices[cgId] ?? 0;
    } else {
      console.warn(`[PriceEngine] No CoinGecko mapping for token: ${key}`);
      priceMap[key] = 0;
    }
  }
  return priceMap;
}

// ------------------------------------------------------------------
// Get price for a single asset
// ------------------------------------------------------------------
export async function getTokenPrice(assetKey: string): Promise<number> {
  const prices = await fetchTokenPrices([assetKey]);
  return prices[assetKey] ?? 0;
}

// ------------------------------------------------------------------
// Clear cache (useful for testing)
// ------------------------------------------------------------------
export function clearPriceCache(): void {
  for (const key in cache) {
    delete cache[key];
  }
  console.log('[PriceEngine] Price cache cleared');
}
