/**
 * wallet-store.ts
 * localStorage-backed wallet manager + live balance fetcher.
 * Works 100% client-side — no backend or tRPC required.
 *
 * Balances are fetched directly from public EVM RPC nodes using viem.
 */
import { createPublicClient, http, formatUnits, isAddress } from "viem";
import { mainnet, bsc, polygon, arbitrum } from "viem/chains";

// ── Storage key ───────────────────────────────────────────────────
const STORAGE_KEY = "aegis_wallets";

// ── Types ──────────────────────────────────────────────────────────
export interface StoredWallet {
  id: string;         // uuid
  address: string;
  label: string;
  chainId: number;
  addedAt: string;
}

export interface WalletWithBalance extends StoredWallet {
  balanceUsd: number;
  assets: TokenBalance[];
  loading: boolean;
  error: string | null;
}

export interface TokenBalance {
  symbol: string;
  network: string;
  balance: string;
  balanceUsd: number;
  decimals: number;
}

// ── RPC clients ────────────────────────────────────────────────────
const clients = {
  ethereum: createPublicClient({ chain: mainnet,   transport: http("https://eth.llamarpc.com") }),
  bsc:      createPublicClient({ chain: bsc,       transport: http("https://bsc-dataseed.binance.org") }),
  polygon:  createPublicClient({ chain: polygon,   transport: http("https://polygon-rpc.com") }),
  arbitrum: createPublicClient({ chain: arbitrum,  transport: http("https://arb1.arbitrum.io/rpc") }),
};

// ── ERC-20 ABI (balanceOf only) ────────────────────────────────────
const ERC20_ABI = [{
  constant: true,
  inputs: [{ name: "_owner", type: "address" }],
  name: "balanceOf",
  outputs: [{ name: "balance", type: "uint256" }],
  type: "function",
}] as const;

// ── USDT contract addresses ────────────────────────────────────────
const USDT: Record<string, { address: `0x${string}`; decimals: number }> = {
  ethereum: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  bsc:      { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  polygon:  { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
  arbitrum: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
};

// ── localStorage helpers ────────────────────────────────────────────
export function loadWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveWallets(wallets: StoredWallet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

export function addWallet(address: string, label: string, chainId = 1): StoredWallet {
  const wallets = loadWallets();
  // Dedup by address (case-insensitive)
  const exists = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
  if (exists) return exists;

  const newWallet: StoredWallet = {
    id: crypto.randomUUID(),
    address: address.toLowerCase(),
    label: label || "My Wallet",
    chainId,
    addedAt: new Date().toISOString(),
  };
  wallets.push(newWallet);
  saveWallets(wallets);
  return newWallet;
}

export function removeWallet(id: string): void {
  const wallets = loadWallets().filter(w => w.id !== id);
  saveWallets(wallets);
}

export function renameWallet(id: string, label: string): void {
  const wallets = loadWallets().map(w => w.id === id ? { ...w, label } : w);
  saveWallets(wallets);
}

// ── Live balance fetch ─────────────────────────────────────────────
// Fetches native + USDT balance across all 4 chains for an address.
export async function fetchWalletBalances(
  address: `0x${string}`,
  ethPrice: number,
  bnbPrice: number,
  maticPrice: number
): Promise<TokenBalance[]> {
  const addr = address.toLowerCase() as `0x${string}`;
  const results: TokenBalance[] = [];

  const networkData = [
    { key: "ethereum", client: clients.ethereum, nativeSymbol: "ETH",  nativeDecimals: 18, nativePrice: ethPrice   },
    { key: "bsc",      client: clients.bsc,      nativeSymbol: "BNB",  nativeDecimals: 18, nativePrice: bnbPrice   },
    { key: "polygon",  client: clients.polygon,  nativeSymbol: "MATIC",nativeDecimals: 18, nativePrice: maticPrice },
    { key: "arbitrum", client: clients.arbitrum, nativeSymbol: "ETH",  nativeDecimals: 18, nativePrice: ethPrice   },
  ];

  await Promise.allSettled(networkData.map(async (net) => {
    try {
      // Native balance
      const nativeBal = await net.client.getBalance({ address: addr });
      const nativeFormatted = parseFloat(formatUnits(nativeBal, net.nativeDecimals));
      if (nativeFormatted > 0.00001) {
        results.push({
          symbol: net.nativeSymbol,
          network: net.key,
          balance: nativeFormatted.toFixed(6),
          balanceUsd: nativeFormatted * net.nativePrice,
          decimals: net.nativeDecimals,
        });
      }

      // USDT balance
      const usdt = USDT[net.key];
      const usdtBal = await (net.client.readContract as any)({
        address: usdt.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [addr],
      }) as bigint;
      const usdtFormatted = parseFloat(formatUnits(usdtBal, usdt.decimals));
      if (usdtFormatted > 0.01) {
        results.push({
          symbol: "USDT",
          network: net.key,
          balance: usdtFormatted.toFixed(2),
          balanceUsd: usdtFormatted, // USDT ≈ $1
          decimals: usdt.decimals,
        });
      }
    } catch {
      // Network unavailable — skip silently
    }
  }));

  return results;
}

// ── Price fetcher via CoinGecko public API ─────────────────────────
export async function fetchLivePrices(): Promise<{ eth: number; bnb: number; matic: number }> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,matic-network&vs_currencies=usd"
    );
    const data = await r.json();
    return {
      eth:   data?.ethereum?.usd   ?? 3200,
      bnb:   data?.binancecoin?.usd ?? 580,
      matic: data?.["matic-network"]?.usd ?? 0.85,
    };
  } catch {
    return { eth: 3200, bnb: 580, matic: 0.85 };
  }
}
