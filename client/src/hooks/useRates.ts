/**
 * useRates.ts
 * Fetches live prices from CoinGecko via the tRPC portfolio.getPrices procedure.
 * Refreshes every 30 seconds. Falls back gracefully when backend is offline.
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
    {
      staleTime: 30_000,
      refetchInterval: 30_000,
      retry: false,
    }
  );

  return {
    prices: data?.prices ?? {},
    isLoading,
    error,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
