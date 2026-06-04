/**
 * usePortfolioSnapshot.ts
 *
 * Reads the pre-computed portfolio snapshot from the DB via tRPC.
 * Returns in <100ms for returning users (no blockchain RPC calls).
 *
 * Falls back gracefully if snapshot is null (brand-new user).
 */
import { trpc } from "@/lib/trpc";
import { getToken } from "@/lib/trpc";

export interface SnapshotAsset {
  network: string;
  token: string;
  totalBalance: string;
  decimals: number;
  type: "native" | "erc20";
  priceUsd: number;
  valueUsd: string;
  valueUsdRaw: number;
}

export interface PortfolioSnapshot {
  totalValueUsd: string;
  totalWallets: number;
  aggregatedAssets: SnapshotAsset[];
  perWallet: {
    wallet: string;
    label?: string;
    assets: SnapshotAsset[];
    totalValueUsd: string;
  }[];
}

export function usePortfolioSnapshot() {
  const hasToken = !!getToken();

  const { data, isLoading, error, refetch } = trpc.portfolio.get.useQuery(undefined, {
    enabled: hasToken,
    staleTime: 60_000,      // treat as fresh for 60s — snapshot updates in background
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const snapshot = data as PortfolioSnapshot | null | undefined;
  const totalValueUsd = parseFloat(snapshot?.totalValueUsd ?? "0") || 0;

  return {
    snapshot,
    totalValueUsd,
    assets: snapshot?.aggregatedAssets ?? [],
    perWallet: snapshot?.perWallet ?? [],
    isLoading: hasToken ? isLoading : false,
    error,
    refetch,
    hasSnapshot: !!snapshot,
  };
}
