/**
 * useWalletStore.ts
 * React hook for the localStorage-backed wallet store.
 * Handles add/remove/rename + live balance fetching.
 */
import { useState, useEffect, useCallback } from "react";
import {
  loadWallets,
  addWallet,
  removeWallet,
  renameWallet,
  fetchWalletBalances,
  fetchLivePrices,
  type StoredWallet,
  type WalletWithBalance,
} from "../lib/wallet-store";
import { isAddress } from "viem";

const NGN_PER_USD = 1595.20;

export function useWalletStore() {
  const [wallets, setWallets] = useState<StoredWallet[]>([]);
  const [balances, setBalances] = useState<Record<string, WalletWithBalance>>({});
  const [prices, setPrices] = useState({ eth: 3200, bnb: 580, matic: 0.85 });
  const [pricesLoading, setPricesLoading] = useState(true);

  // Load wallets from localStorage on mount
  useEffect(() => {
    setWallets(loadWallets());
  }, []);

  // Fetch live prices once on mount
  useEffect(() => {
    fetchLivePrices().then(p => { setPrices(p); setPricesLoading(false); });
  }, []);

  // Fetch balances when wallets or prices change
  useEffect(() => {
    if (wallets.length === 0 || pricesLoading) return;

    wallets.forEach(async (w) => {
      setBalances(prev => ({
        ...prev,
        [w.id]: { ...w, balanceUsd: 0, assets: [], loading: true, error: null },
      }));

      try {
        const assets = await fetchWalletBalances(
          w.address as `0x${string}`,
          prices.eth,
          prices.bnb,
          prices.matic
        );
        const totalUsd = assets.reduce((s, a) => s + a.balanceUsd, 0);
        setBalances(prev => ({
          ...prev,
          [w.id]: { ...w, balanceUsd: totalUsd, assets, loading: false, error: null },
        }));
      } catch (err: any) {
        setBalances(prev => ({
          ...prev,
          [w.id]: { ...w, balanceUsd: 0, assets: [], loading: false, error: err.message },
        }));
      }
    });
  }, [wallets, prices, pricesLoading]);

  const add = useCallback((address: string, label: string): string | null => {
    if (!isAddress(address)) return "Invalid Ethereum address";
    const w = addWallet(address, label);
    setWallets(loadWallets());
    return null; // no error
  }, []);

  const remove = useCallback((id: string) => {
    removeWallet(id);
    setWallets(loadWallets());
    setBalances(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const rename = useCallback((id: string, label: string) => {
    renameWallet(id, label);
    setWallets(loadWallets());
  }, []);

  const walletsWithBalances: WalletWithBalance[] = wallets.map(w =>
    balances[w.id] ?? { ...w, balanceUsd: 0, assets: [], loading: true, error: null }
  );

  const totalUsd = walletsWithBalances.reduce((s, w) => s + w.balanceUsd, 0);
  const totalNgn = totalUsd * NGN_PER_USD;

  return {
    wallets: walletsWithBalances,
    totalUsd,
    totalNgn,
    add,
    remove,
    rename,
    prices,
    NGN_PER_USD,
  };
}
