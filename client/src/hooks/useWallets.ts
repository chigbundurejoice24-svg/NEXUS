/**
 * useWallets.ts
 * Fetches linked wallets + live enriched portfolio via tRPC.
 * Falls back gracefully when the backend is not reachable.
 */
import { trpc } from "../lib/trpc";

export function useWallets() {
  const walletsQuery = trpc.accounts.myWallets.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const addresses = (walletsQuery.data ?? []).map((w) => ({
    address: w.address as `0x${string}`,
    label: w.label ?? undefined,
  }));

  const portfolioQuery = trpc.portfolio.getAggregated.useQuery(
    { wallets: addresses },
    { enabled: addresses.length > 0, staleTime: 30_000 }
  );

  const totalValueQuery = trpc.portfolio.getTotalValue.useQuery(
    { wallets: addresses },
    { enabled: addresses.length > 0, staleTime: 30_000 }
  );

  return {
    linkedWallets: walletsQuery.data ?? [],
    linkedWalletsLoading: walletsQuery.isLoading,
    linkedWalletsError: walletsQuery.error,
    portfolio: portfolioQuery.data?.data ?? null,
    portfolioLoading: portfolioQuery.isLoading,
    portfolioError: portfolioQuery.error,
    totalValueUsd: totalValueQuery.data?.totalValueUsd ?? "0",
    totalWallets: totalValueQuery.data?.totalWallets ?? 0,
  };
}
