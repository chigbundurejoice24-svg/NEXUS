/**
 * useRates.ts
 * Live prices from CoinGecko via tRPC. Refreshes every 30s.
 */
import { trpc } from "../lib/trpc";

const RATE_KEYS = [
  "ethereum:ETH",
  "bsc:BNB",
  "ethereum:BTC",
  "ethereum:USDT",
  "ethereum:USDC",
  "polygon:MATIC",
  "arbitrum:ETH",
];

export function useRates() {
  const { data, isLoading, error, dataUpdatedAt } = trpc.portfolio.getPrices.useQuery(
    { assetKeys: RATE_KEYS },
    { staleTime: 30_000, refetchInterval: 30_000, retry: false }
  );

  return {
    prices: ((data as any)?.prices ?? {}) as Record<string, number>,
    isLoading,
    error,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
