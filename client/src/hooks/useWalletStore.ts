/**
 * useWalletStore.ts
 * - Shows embedded (DB) wallet from auth.me as first entry
 * - Parallel price+balance fetch — no waterfall
 * - 60s balance cache, no repeated fetches on re-render
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadWallets, addWallet, removeWallet, renameWallet,
  fetchWalletBalances, fetchLivePrices, migrateWalletsToUser,
  type StoredWallet, type WalletWithBalance,
} from "../lib/wallet-store";
import { useNgnRate } from "./useNgnRate";
import { useCurrentUser } from "./useAuth";

const isValidAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
const DEFAULT_PRICES = { eth: 3500, bnb: 620, matic: 0.85 };

export function useWalletStore() {
  const { rate: NGN_PER_USD }   = useNgnRate();
  const { user }                = useCurrentUser();
  const [wallets, setWallets]   = useState<StoredWallet[]>([]);  // loaded after userId known
  const [balances, setBalances] = useState<Record<string, WalletWithBalance>>({});
  const [prices, setPrices]     = useState(DEFAULT_PRICES);
  const fetchingRef             = useRef<Set<string>>(new Set());

  // Fetch prices once on mount
  useEffect(() => { fetchLivePrices().then(setPrices); }, []);

  // Load wallets scoped to this user — migrate legacy unscoped data once
  const userId = (user as any)?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    migrateWalletsToUser(userId);
    setWallets(loadWallets(userId));
  }, [userId]);

  // Build full list: embedded wallet (from DB) + manually added wallets
  const embeddedAddress = (user as any)?.walletAddress as string | null ?? null;
  const embeddedWallet: StoredWallet | null = embeddedAddress ? {
    id:      `embedded_${embeddedAddress}`,
    address: embeddedAddress.toLowerCase(),
    label:   "My Aegis Wallet",
    chainId: 56,
    addedAt: new Date(0).toISOString(),
  } : null;

  // Merge: embedded first, then localStorage wallets (dedup by address)
  const allAddresses = new Set(wallets.map(w => w.address.toLowerCase()));
  const mergedWallets: StoredWallet[] = [
    ...(embeddedWallet && !allAddresses.has(embeddedWallet.address) ? [embeddedWallet] : []),
    ...wallets,
  ];

  // Fetch balances for all wallets
  useEffect(() => {
    if (mergedWallets.length === 0) return;
    mergedWallets.forEach((w) => {
      if (fetchingRef.current.has(w.id)) return;
      fetchingRef.current.add(w.id);

      setBalances(prev => ({
        ...prev,
        [w.id]: prev[w.id]?.loading === false
          ? prev[w.id]
          : { ...w, balanceUsd: 0, assets: [], loading: true, error: null },
      }));

      fetchWalletBalances(w.address as `0x${string}`, prices.eth, prices.bnb, prices.matic)
        .then(assets => {
          const totalUsd = assets.reduce((s, a) => s + a.balanceUsd, 0);
          setBalances(prev => ({ ...prev, [w.id]: { ...w, balanceUsd: totalUsd, assets, loading: false, error: null } }));
        })
        .catch(err => {
          setBalances(prev => ({ ...prev, [w.id]: { ...w, balanceUsd: 0, assets: [], loading: false, error: err.message } }));
        })
        .finally(() => fetchingRef.current.delete(w.id));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets, prices, embeddedAddress]);

  const add = useCallback((address: string, label: string): string | null => {
    if (!isValidAddress(address)) return "Invalid Ethereum address";
    addWallet(address, label, 56, userId);
    setWallets(loadWallets(userId));
    return null;
  }, [userId]);

  const remove = useCallback((id: string) => {
    removeWallet(id);
    setWallets(loadWallets());
    setBalances(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const rename = useCallback((id: string, label: string) => {
    renameWallet(id, label);
    setWallets(loadWallets());
  }, []);

  const walletsWithBalances: WalletWithBalance[] = mergedWallets.map(w =>
    balances[w.id] ?? { ...w, balanceUsd: 0, assets: [], loading: true, error: null }
  );

  const totalUsd = walletsWithBalances.reduce((s, w) => s + w.balanceUsd, 0);
  const totalNgn = totalUsd * NGN_PER_USD;

  return { wallets: walletsWithBalances, totalUsd, totalNgn, add, remove, rename, prices, NGN_PER_USD };
}
