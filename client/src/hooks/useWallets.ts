/**
 * useWallets.ts
 * Fetches linked wallets and live portfolio data via tRPC.
 * Falls back gracefully when backend is offline.
 */
import { trpc } from "../lib/trpc";
import type { LinkedWalletRecord } from "../lib/app-router-type";

export function useWallets() {
  const walletsQuery = trpc.accounts.myWallets.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const linked: LinkedWalletRecord[] = walletsQuery.data ?? [];

  const addresses = linked.map((w) => ({
    address: w.address as `0x${string}`,
    label: w.label ?? undefined,
  }));

  const portfolioQuery = trpc.portfolio.getAggregated.useQuery(
    { wallets: addresses },
    { enabled: addresses.length > 0, staleTime: 30_000, retry: false }
  );

  const totalValueQuery = trpc.portfolio.getTotalValue.useQuery(
    { wallets: addresses },
    { enabled: addresses.length > 0, staleTime: 30_000, retry: false }
  );

  return {
    linkedWallets: linked,
    linkedWalletsLoading: walletsQuery.isLoading,
    linkedWalletsError: walletsQuery.error,
    portfolio: (portfolioQuery.data as any)?.data ?? null,
    portfolioLoading: portfolioQuery.isLoading,
    portfolioError: portfolioQuery.error,
    totalValueUsd: (totalValueQuery.data as any)?.totalValueUsd ?? "0",
    totalWallets: (totalValueQuery.data as any)?.totalWallets ?? 0,
  };
}
