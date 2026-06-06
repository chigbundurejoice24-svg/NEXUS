/**
 * useWeb3Providers.ts
 *
 * Detects ALL injected Web3 wallets using EIP-6963 (announceProvider).
 * Falls back to window.ethereum (legacy) for wallets that don't support EIP-6963.
 *
 * Works with: MetaMask, Trust Wallet, OKX Wallet, Coinbase Wallet,
 *             Rabby, Rainbow, Phantom (EVM), Brave Wallet, and any EIP-6963 wallet.
 *
 * Usage:
 *   const { providers, connect, connectedProvider } = useWeb3Providers();
 */
import { useState, useEffect, useCallback } from "react";

export interface Web3ProviderInfo {
  rdns:  string;            // e.g. "io.metamask"
  name:  string;            // e.g. "MetaMask"
  icon:  string;            // base64 or URL
  uuid:  string;
}

export interface DetectedProvider {
  info:     Web3ProviderInfo;
  provider: any;            // the actual EIP-1193 provider object
}

export interface ConnectedWallet {
  address:  string;
  chainId:  number;
  provider: any;
  info:     Web3ProviderInfo;
}

// Well-known fallback names for wallets that identify via window.ethereum flags
function inferWalletName(eth: any): { name: string; rdns: string; icon: string } {
  if (eth?.isTrust || eth?.isTrustWallet)    return { name: "Trust Wallet",    rdns: "com.trustwallet.app",   icon: "🔵" };
  if (eth?.isOKXWallet || eth?.isOKEX)       return { name: "OKX Wallet",       rdns: "com.okex.wallet",       icon: "⚫" };
  if (eth?.isCoinbaseWallet)                 return { name: "Coinbase Wallet",  rdns: "com.coinbase.wallet",   icon: "🔵" };
  if (eth?.isRabby)                          return { name: "Rabby",            rdns: "io.rabby",              icon: "🟣" };
  if (eth?.isBraveWallet)                    return { name: "Brave Wallet",     rdns: "com.brave.wallet",      icon: "🦁" };
  if (eth?.isMetaMask)                       return { name: "MetaMask",         rdns: "io.metamask",           icon: "🦊" };
  if (eth?.isPhantom)                        return { name: "Phantom",          rdns: "app.phantom",           icon: "👻" };
  return { name: "Browser Wallet", rdns: "unknown", icon: "💼" };
}

export function useWeb3Providers() {
  const [providers,   setProviders]   = useState<DetectedProvider[]>([]);
  const [connected,   setConnected]   = useState<ConnectedWallet | null>(null);
  const [connecting,  setConnecting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    const found: DetectedProvider[] = [];
    const seen  = new Set<string>();

    // EIP-6963: listen for wallet announcements
    const handleAnnounce = (event: any) => {
      const { info, provider } = event.detail ?? {};
      if (!info?.rdns || seen.has(info.rdns)) return;
      seen.add(info.rdns);
      found.push({ info, provider });
      setProviders([...found]);
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounce);
    // Prompt wallets to announce themselves
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Fallback: window.ethereum (legacy EIP-1193)
    setTimeout(() => {
      const eth = (window as any).ethereum;
      if (!eth) return;

      // Handle wallets that inject multiple providers (MetaMask + Coinbase conflict)
      const legacyProviders: any[] = eth.providers ?? [eth];
      for (const p of legacyProviders) {
        const { rdns, name, icon } = inferWalletName(p);
        if (!seen.has(rdns)) {
          seen.add(rdns);
          found.push({ info: { rdns, name, icon, uuid: rdns }, provider: p });
        }
      }
      setProviders([...found]);
    }, 300);

    return () => window.removeEventListener("eip6963:announceProvider", handleAnnounce);
  }, []);

  // Connect to a specific provider and get address
  const connect = useCallback(async (detected: DetectedProvider): Promise<ConnectedWallet | null> => {
    setConnecting(true);
    setError(null);
    try {
      const { provider, info } = detected;
      const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
      if (!accounts?.length) throw new Error("No accounts returned");

      const chainHex: string = await provider.request({ method: "eth_chainId" });
      const chainId = parseInt(chainHex, 16);

      const wallet: ConnectedWallet = {
        address:  accounts[0],
        chainId,
        provider,
        info,
      };
      setConnected(wallet);
      return wallet;
    } catch (e: any) {
      const msg = e?.message ?? "Connection rejected";
      setError(msg.includes("rejected") ? "Connection rejected by user" : msg);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Switch to BSC (chainId 56)
  const switchToBSC = useCallback(async (provider: any) => {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    } catch (e: any) {
      if (e.code === 4902) {
        await provider.request({ method: "wallet_addEthereumChain", params: [{ 
          chainId: "0x38",
          chainName: "BNB Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: ["https://bsc-dataseed.binance.org", "https://rpc.ankr.com/bsc"],
          blockExplorerUrls: ["https://bscscan.com"],
        }] });
      } else throw e;
    }
  }, []);

  // Sign + broadcast a batch of transactions
  const sendTransactions = useCallback(async (
    provider: any,
    fromAddress: string,
    transactions: Array<{ to: string; data: string; value?: string; label?: string }>,
    onProgress?: (i: number, total: number, hash: string) => void
  ): Promise<string[]> => {
    const hashes: string[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const hash: string = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from:  fromAddress,
          to:    tx.to,
          data:  tx.data,
          value: tx.value ?? "0x0",
        }],
      });
      hashes.push(hash);
      onProgress?.(i + 1, transactions.length, hash);
    }
    return hashes;
  }, []);

  const disconnect = useCallback(() => setConnected(null), []);

  return { providers, connected, connecting, error, connect, switchToBSC, sendTransactions, disconnect };
}
