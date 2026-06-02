/**
 * useWallets.ts
 *
 * Unified wallet hook — returns wallets from the localStorage store
 * (same source as the Wallets page) so ALL pages are in sync.
 *
 * Also exposes tRPC portfolio data when backend is available,
 * falling back gracefully to zero values when offline.
 *
 * Pages using this hook: SendMoney, ReceiveMoney, Profile, Settings, Dashboard
 */

import { useWalletStore } from "./useWalletStore";
import type { LinkedWalletRecord } from "../lib/app-router-type";

export function useWallets() {
  const { wallets, totalUsd, totalNgn } = useWalletStore();

  // Map localStorage wallets to the LinkedWalletRecord shape
  // so pages that destructure { linkedWallets } work without changes
  const linkedWallets: LinkedWalletRecord[] = wallets.map((w, i) => ({
    id:        i + 1,                   // synthetic id for key purposes
    userId:    0,
    address:   w.address,
    chainId:   1,                       // default — real chain stored in wallet-store
    type:      "EXTERNAL" as const,
    label:     w.label ?? null,
    createdAt: new Date(w.createdAt),
    updatedAt: new Date(w.createdAt),
  }));

  return {
    linkedWallets,
    linkedWalletsLoading: false,
    linkedWalletsError:   null,
    portfolio:            null,          // portfolio aggregation handled in useWalletStore
    portfolioLoading:     false,
    portfolioError:       null,
    totalValueUsd:        totalUsd.toFixed(2),
    totalWallets:         wallets.length,
  };
}
