/**
 * useWalletStore.ts
 * Parallel fetch: prices + balances start at the same time.
 * UI updates immediately as each piece resolves — no waterfalls.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadWallets, addWallet, removeWallet, renameWallet,
  fetchWalletBalances, fetchLivePrices,
  type StoredWallet, type WalletWithBalance,
} from "../lib/wallet-store";
import { useNgnRate } from "./useNgnRate";

const isValidAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr);

// Default prices — used immediately while real prices load in background
const DEFAULT_PRICES = { eth: 3500, bnb: 620, matic: 0.85 };

export function useWalletStore() {
  const { rate: NGN_PER_USD } = useNgnRate();
  const [wallets, setWallets]   = useState<StoredWallet[]>(() => loadWallets());
  const [balances, setBalances] = useState<Record<string, WalletWithBalance>>({});
  const [prices, setPrices]     = useState(DEFAULT_PRICES);
  const fetchingRef             = useRef<Set<string>>(new Set());

  // ── Fetch live prices once on mount (non-blocking) ──────────────
  useEffect(() => {
    fetchLivePrices().then(setPrices);
  }, []);

  // ── Fetch balances for each wallet — starts immediately ─────────
  // Re-runs when wallets list or prices change (prices update silently)
  useEffect(() => {
    if (wallets.length === 0) return;

    wallets.forEach((w) => {
      // Skip if already fetching this wallet in this cycle
      if (fetchingRef.current.has(w.id)) return;
      fetchingRef.current.add(w.id);

      // Show loading state immediately
      setBalances(prev => ({
        ...prev,
        [w.id]: prev[w.id]?.loading === false
          ? prev[w.id]  // already have data — don't flash loading again
          : { ...w, balanceUsd: 0, assets: [], loading: true, error: null },
      }));

      fetchWalletBalances(w.address as `0x${string}`, prices.eth, prices.bnb, prices.matic)
        .then(assets => {
          const totalUsd = assets.reduce((s, a) => s + a.balanceUsd, 0);
          setBalances(prev => ({
            ...prev,
            [w.id]: { ...w, balanceUsd: totalUsd, assets, loading: false, error: null },
          }));
        })
        .catch(err => {
          setBalances(prev => ({
            ...prev,
            [w.id]: { ...w, balanceUsd: 0, assets: [], loading: false, error: err.message },
          }));
        })
        .finally(() => fetchingRef.current.delete(w.id));
    });
  }, [wallets, prices]);

  const add = useCallback((address: string, label: string): string | null => {
    if (!isValidAddress(address)) return "Invalid Ethereum address";
    addWallet(address, label);
    setWallets(loadWallets());
    return null;
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
