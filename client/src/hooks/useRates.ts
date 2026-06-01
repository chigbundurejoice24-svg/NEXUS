/**
 * useRates.ts
 * Fetches live prices from CoinGecko via the tRPC portfolio.getPrices procedure.
 * Refreshes every 30 seconds automatically.
 */
import { trpc } from "../lib/trpc";

// Tokens the Rates page cares about (match portfolio-aggregator asset keys)
const RATE_KEYS = [
  "ethereum:ETH",
  "bsc:BNB",
  "polygon:MATIC",
  "arbitrum:ETH",
  "ethereum:USDT",
  "ethereum:USDC",
  "ethereum:BTC",
];

export function useRates() {
  const { data, isLoading, error, dataUpdatedAt } = trpc.portfolio.getPrices.useQuery(
    { assetKeys: RATE_KEYS },
    { staleTime: 30_000, refetchInterval: 30_000 }
  );

  return {
    prices: data?.prices ?? {},
    isLoading,
    error,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
