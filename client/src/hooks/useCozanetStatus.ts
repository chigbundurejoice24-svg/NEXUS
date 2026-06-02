/**
 * useCozanetStatus.ts
 *
 * Fetches live Cozanet token data for the current user.
 * Authenticated: returns user Points + discount tier.
 * Unauthenticated: falls back to public price-only call.
 *
 * Refreshes every 60 seconds.
 */
import { trpc } from "../lib/trpc";
import { useCurrentUser } from "./useAuth";

export interface CozanetStatus {
  priceUsd: number;
  pointsBalance: string;
  discountPercent: number;
  baseFeePercent: number;
  effectiveFeePercent: number;
  exampleFeeUsdt: string | null;
  tiers: { min: number; discount: number }[];
  isLoading: boolean;
  error: unknown;
}

export function useCozanetStatus(exampleAmountUsdt?: number): CozanetStatus {
  const { isAuthenticated } = useCurrentUser();

  // Authenticated path — full status with Points
  const authed = trpc.cozanet.getStatus.useQuery(
    { exampleAmountUsdt },
    { enabled: isAuthenticated, refetchInterval: 60_000, retry: false }
  );

  // Public path — price only, no auth needed
  const pub = trpc.cozanet.getPrice.useQuery(undefined, {
    enabled: !isAuthenticated,
    refetchInterval: 60_000,
    retry: false,
  });

  if (isAuthenticated) {
    return {
      priceUsd:            authed.data?.priceUsd            ?? 0,
      pointsBalance:       authed.data?.pointsBalance       ?? "0.00",
      discountPercent:     authed.data?.discountPercent     ?? 0,
      baseFeePercent:      authed.data?.baseFeePercent      ?? 0.5,
      effectiveFeePercent: authed.data?.effectiveFeePercent ?? 0.5,
      exampleFeeUsdt:      authed.data?.exampleFeeUsdt      ?? null,
      tiers:               authed.data?.tiers               ?? [],
      isLoading:           authed.isLoading,
      error:               authed.error,
    };
  }

  return {
    priceUsd:            pub.data?.priceUsd ?? 0,
    pointsBalance:       "0.00",
    discountPercent:     0,
    baseFeePercent:      0.5,
    effectiveFeePercent: 0.5,
    exampleFeeUsdt:      null,
    tiers:               [],
    isLoading:           pub.isLoading,
    error:               pub.error,
  };
}
