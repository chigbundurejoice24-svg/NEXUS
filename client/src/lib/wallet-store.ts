/**
 * wallet-store.ts — FAST parallel balance fetcher
 *
 * Speed strategy:
 * - ALL chains fire simultaneously (no await inside loop)
 * - 3-second per-chain timeout — slow chains don't block others
 * - 60-second balance cache keyed per address — instant re-renders
 * - 5-minute price cache — no repeated CoinGecko calls
 * - Graceful: any failing chain returns 0, never blocks the UI
 */
import { createPublicClient, http, formatUnits } from "viem";
import { mainnet, bsc, polygon, arbitrum } from "viem/chains";

const STORAGE_KEY_PREFIX = "aegis_wallets";
const LEGACY_KEY         = "aegis_wallets"; // unscoped — migrated on first login

// Returns the per-user storage key — scoped so different users never share wallets
function walletKey(userId?: string | number | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : LEGACY_KEY;
}

export interface StoredWallet {
  id: string; address: string; label: string; chainId: number; addedAt: string;
}
export interface WalletWithBalance extends StoredWallet {
  balanceUsd: number; assets: TokenBalance[]; loading: boolean; error: string | null;
}
export interface TokenBalance {
  symbol: string; network: string; balance: string; balanceUsd: number; decimals: number;
}

// ── Best public RPCs — chosen for latency from West Africa ────────
function timedTransport(url: string) {
  return http(url, { timeout: 3_000, retryCount: 1 });
}

const clients = {
  bsc:      createPublicClient({ chain: bsc,      transport: timedTransport("https://rpc.ankr.com/bsc") }),
  ethereum: createPublicClient({ chain: mainnet,  transport: timedTransport("https://rpc.ankr.com/eth") }),
  polygon:  createPublicClient({ chain: polygon,  transport: timedTransport("https://rpc.ankr.com/polygon") }),
  arbitrum: createPublicClient({ chain: arbitrum, transport: timedTransport("https://rpc.ankr.com/arbitrum") }),
};

const ERC20_ABI = [{
  constant: true, inputs: [{ name: "_owner", type: "address" }],
  name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function",
}] as const;

const TOKENS: Record<string, { symbol: string; address: `0x${string}`; decimals: number }[]> = {
  bsc: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d", decimals: 18 },
  ],
  ethereum: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  ],
  polygon: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
  ],
  arbitrum: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86", decimals: 6 },
  ],
};

// ── Caches ─────────────────────────────────────────────────────────
let _priceCache: { data: {eth:number;bnb:number;matic:number}; ts: number } | null = null;
const _balCache  = new Map<string, { data: TokenBalance[]; ts: number }>();
const PRICE_TTL  = 5 * 60_000;
const BAL_TTL    = 60_000; // 60 seconds

// ── localStorage (user-scoped) ─────────────────────────────────────
export function loadWallets(userId?: string | number | null): StoredWallet[] {
  try { return JSON.parse(localStorage.getItem(walletKey(userId)) ?? "[]"); } catch { return []; }
}
export function saveWallets(ws: StoredWallet[], userId?: string | number | null) {
  localStorage.setItem(walletKey(userId), JSON.stringify(ws));
}
export function addWallet(address: string, label: string, chainId = 56, userId?: string | number | null): StoredWallet {
  const wallets = loadWallets(userId);
  const exists = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
  if (exists) return exists;
  const w: StoredWallet = { id: crypto.randomUUID(), address: address.toLowerCase(), label: label || "My Wallet", chainId, addedAt: new Date().toISOString() };
  wallets.push(w); saveWallets(wallets, userId); return w;
}
export function removeWallet(id: string, userId?: string | number | null) {
  saveWallets(loadWallets(userId).filter(w => w.id !== id), userId);
}
export function renameWallet(id: string, label: string, userId?: string | number | null) {
  saveWallets(loadWallets(userId).map(w => w.id === id ? { ...w, label } : w), userId);
}

// ── Migration: move legacy unscoped wallets to user-scoped key ────
export function migrateWalletsToUser(userId: string | number): void {
  try {
    const scopedKey = walletKey(userId);
    // Only migrate if the scoped key is empty and legacy has data
    const legacy  = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]") as StoredWallet[];
    const scoped  = JSON.parse(localStorage.getItem(scopedKey)  ?? "[]") as StoredWallet[];
    if (legacy.length > 0 && scoped.length === 0) {
      localStorage.setItem(scopedKey, JSON.stringify(legacy));
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* silent */ }
}

// ── Price fetch — CoinGecko + Binance fallback ────────────────────
export async function fetchLivePrices(): Promise<{eth:number;bnb:number;matic:number}> {
  const now = Date.now();
  if (_priceCache && now - _priceCache.ts < PRICE_TTL) return _priceCache.data;
  const fallback = { eth: 3500, bnb: 620, matic: 0.85 };
  try {
    const r = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbols=[%22ETHUSDT%22,%22BNBUSDT%22,%22MATICUSDT%22]",
      { signal: AbortSignal.timeout(4000) }
    );
    const arr = await r.json() as { symbol: string; price: string }[];
    const find = (s: string) => parseFloat(arr.find(x => x.symbol === s)?.price ?? "0");
    const data = { eth: find("ETHUSDT") || fallback.eth, bnb: find("BNBUSDT") || fallback.bnb, matic: find("MATICUSDT") || fallback.matic };
    _priceCache = { data, ts: now };
    return data;
  } catch {
    if (_priceCache) return _priceCache.data;
    return fallback;
  }
}

// ── Balance fetch — ALL calls in parallel, per-chain 3s timeout ───
export async function fetchWalletBalances(
  address: `0x${string}`, ethPrice: number, bnbPrice: number, maticPrice: number
): Promise<TokenBalance[]> {
  const key = `${address.toLowerCase()}:${Math.floor(Date.now() / BAL_TTL)}`;
  const hit = _balCache.get(key);
  if (hit) return hit.data;

  const addr = address.toLowerCase() as `0x${string}`;
  const nativePrice: Record<string, {symbol:string;price:number}> = {
    bsc:      { symbol: "BNB",   price: bnbPrice   },
    ethereum: { symbol: "ETH",   price: ethPrice   },
    polygon:  { symbol: "MATIC", price: maticPrice },
    arbitrum: { symbol: "ETH",   price: ethPrice   },
  };

  const tasks = (Object.entries(clients) as [string, typeof clients.bsc][]).flatMap(([net, client]) => {
    const np = nativePrice[net];
    const nativeT = Promise.race([
      client.getBalance({ address: addr }),
      new Promise<bigint>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]).then(bal => {
      const f = parseFloat(formatUnits(bal as bigint, 18));
      if (f < 0.00001) return null;
      return { symbol: np.symbol, network: net, balance: f.toFixed(6), balanceUsd: f * np.price, decimals: 18 } as TokenBalance;
    }).catch(() => null);

    const tokenTs = (TOKENS[net] ?? []).map(tk =>
      Promise.race([
        (client.readContract as any)({ address: tk.address, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
      ]).then((raw: unknown) => {
        const f = parseFloat(formatUnits(raw as bigint, tk.decimals));
        if (f < 0.01) return null;
        return { symbol: tk.symbol, network: net, balance: f.toFixed(2), balanceUsd: f, decimals: tk.decimals } as TokenBalance;
      }).catch(() => null)
    );
    return [nativeT, ...tokenTs];
  });

  const settled = await Promise.allSettled(tasks);
  const data = settled
    .filter((r): r is PromiseFulfilledResult<TokenBalance|null> => r.status === "fulfilled")
    .map(r => r.value).filter((v): v is TokenBalance => v !== null);

  _balCache.set(key, { data, ts: Date.now() });
  return data;
}
