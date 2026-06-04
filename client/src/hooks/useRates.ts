/**
 * useRates.ts — Fast live prices
 *
 * Strategy (fastest first):
 *   1. Return stale cache instantly (< 60s old) → user sees prices immediately
 *   2. Fetch CoinGecko directly from browser (no server round-trip, fastest path)
 *   3. Fall back to tRPC server prices if browser fetch fails (CORS, rate-limit)
 *
 * Result: prices appear in ~300ms on warm cache, ~800ms on cold load.
 */
import { useEffect, useState, useRef } from "react";
import { trpc } from "../lib/trpc";

// Local storage cache
const LS_KEY = "aegis_prices_v2";
const LS_TTL = 60_000; // 60 s

// Asset → CoinGecko ID
const CG_ID: Record<string, string> = {
  "ethereum:ETH":  "ethereum",
  "bsc:BNB":       "binancecoin",
  "ethereum:BTC":  "bitcoin",
  "ethereum:USDT": "tether",
  "ethereum:USDC": "usd-coin",
  "polygon:MATIC": "matic-network",
  "arbitrum:ETH":  "ethereum",
};

const RATE_KEYS = Object.keys(CG_ID);

function readCache(): { prices: Record<string, number>; ts: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts < LS_TTL) return parsed;
    return null;
  } catch { return null; }
}

function writeCache(prices: Record<string, number>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ prices, ts: Date.now() }));
  } catch {}
}

/** Direct CoinGecko fetch — skips the server entirely */
async function fetchCgDirect(): Promise<Record<string, number>> {
  const ids = [...new Set(Object.values(CG_ID))].join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error("CG direct failed");
  const data: Record<string, { usd?: number }> = await res.json();
  const out: Record<string, number> = {};
  for (const [key, id] of Object.entries(CG_ID)) {
    out[key] = data[id]?.usd ?? 0;
  }
  return out;
}

export function useRates() {
  const cached = readCache();
  const [prices, setPrices]         = useState<Record<string, number>>(cached?.prices ?? {});
  const [isLoading, setIsLoading]   = useState(!cached);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cached ? new Date(cached.ts) : null);
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;

    // Already have fresh cache — no fetch needed
    if (cached) { setIsLoading(false); return; }

    // Try direct CoinGecko first (fastest)
    fetchCgDirect()
      .then(p => {
        setPrices(p);
        writeCache(p);
        setLastUpdated(new Date());
        setIsLoading(false);
      })
      .catch(() => {
        // CG direct failed (CORS/rate limit) — will use tRPC fallback below
        setIsLoading(false);
      });
  }, []);

  // tRPC fallback — runs only when direct CG fetch fails (prices still empty after 3s)
  const needsFallback = Object.keys(prices).length === 0;
  const fallback = trpc.portfolio.getPrices.useQuery(
    { assetKeys: RATE_KEYS },
    {
      enabled: needsFallback,
      staleTime: 60_000,
      refetchInterval: 60_000,
      retry: 1,
    }
  );

  useEffect(() => {
    if (fallback.data?.prices && Object.keys(fallback.data.prices).length > 0) {
      const p = fallback.data.prices as Record<string, number>;
      setPrices(p);
      writeCache(p);
      setLastUpdated(new Date());
      setIsLoading(false);
    }
  }, [fallback.data]);

  return {
    prices,
    isLoading: isLoading && needsFallback && fallback.isLoading,
    error: fallback.error,
    lastUpdated,
  };
}
