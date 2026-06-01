/**
 * useWallets.ts
 * Fetches the authenticated user's linked wallets + live portfolio data.
 * Falls back gracefully when no wallets are connected yet.
 */
import { trpc } from "../lib/trpc";

export function useWallets() {
  const walletsQuery = trpc.accounts.myWallets.useQuery(undefined, {
    retry: 1,
  });

  const addresses = (walletsQuery.data ?? []).map((w) => ({
    address: w.address as `0x${string}`,
    label: w.label ?? undefined,
  }));

  const portfolioQuery = trpc.portfolio.getAggregated.useQuery(
    { wallets: addresses },
    {
      enabled: addresses.length > 0,
      staleTime: 30_000,
    }
  );

  const totalValueQuery = trpc.portfolio.getTotalValue.useQuery(
    { wallets: addresses },
    { enabled: addresses.length > 0, staleTime: 30_000 }
  );

  return {
    // raw linked wallet records (address, chainId, label)
    linkedWallets: walletsQuery.data ?? [],
    linkedWalletsLoading: walletsQuery.isLoading,
    linkedWalletsError: walletsQuery.error,

    // enriched portfolio
    portfolio: portfolioQuery.data?.data ?? null,
    portfolioLoading: portfolioQuery.isLoading,
    portfolioError: portfolioQuery.error,

    // totals
    totalValueUsd: totalValueQuery.data?.totalValueUsd ?? "0",
    totalWallets: totalValueQuery.data?.totalWallets ?? 0,
  };
}
