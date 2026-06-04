/**
 * wallet-store.ts
 * localStorage-backed wallet manager + FAST live balance fetcher.
 *
 * Performance design:
 * - All RPC calls fire in a single flat Promise.allSettled (true parallel)
 * - In-memory price cache: 5 min TTL — CoinGecko called once per session
 * - In-memory balance cache: 30 sec TTL — re-renders are instant
 * - Fast, reliable RPC endpoints prioritised (Ankr public, Cloudflare)
 * - BSC-first ordering — fastest for USDT/Africa use case
 */
import { createPublicClient, http, formatUnits } from "viem";
import { mainnet, bsc, polygon, arbitrum } from "viem/chains";

const STORAGE_KEY = "aegis_wallets";

export interface StoredWallet {
  id: string;
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

// ── Fast RPC endpoints — Ankr public is most reliable globally ─────
const clients = {
  bsc:      createPublicClient({ chain: bsc,      transport: http("https://rpc.ankr.com/bsc") }),
  ethereum: createPublicClient({ chain: mainnet,  transport: http("https://rpc.ankr.com/eth") }),
  polygon:  createPublicClient({ chain: polygon,  transport: http("https://rpc.ankr.com/polygon") }),
  arbitrum: createPublicClient({ chain: arbitrum, transport: http("https://rpc.ankr.com/arbitrum") }),
};

const ERC20_ABI = [{
  constant: true,
  inputs: [{ name: "_owner", type: "address" }],
  name: "balanceOf",
  outputs: [{ name: "balance", type: "uint256" }],
  type: "function",
}] as const;

// ── USDT + USDC contracts (skip low-value tokens) ─────────────────
const STABLECOINS: Record<string, { symbol: string; address: `0x${string}`; decimals: number }[]> = {
  bsc:      [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d", decimals: 18 },
  ],
  ethereum: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  ],
  polygon:  [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
  ],
  arbitrum: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86", decimals: 6 },
  ],
};

// ── In-memory caches ───────────────────────────────────────────────
interface PriceCache { data: { eth: number; bnb: number; matic: number }; ts: number; }
interface BalanceCache { data: TokenBalance[]; ts: number; }
let _priceCache: PriceCache | null = null;
const _balanceCache = new Map<string, BalanceCache>();
const PRICE_TTL   = 5 * 60 * 1000;  // 5 minutes
const BALANCE_TTL = 30 * 1000;       // 30 seconds

// ── localStorage helpers ────────────────────────────────────────────
export function loadWallets(): StoredWallet[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}
export function saveWallets(ws: StoredWallet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
}
export function addWallet(address: string, label: string, chainId = 56): StoredWallet {
  const wallets = loadWallets();
  const exists = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
  if (exists) return exists;
  const w: StoredWallet = { id: crypto.randomUUID(), address: address.toLowerCase(), label: label || "My Wallet", chainId, addedAt: new Date().toISOString() };
  wallets.push(w);
  saveWallets(wallets);
  return w;
}
export function removeWallet(id: string): void { saveWallets(loadWallets().filter(w => w.id !== id)); }
export function renameWallet(id: string, label: string): void {
  saveWallets(loadWallets().map(w => w.id === id ? { ...w, label } : w));
}

// ── Price fetcher — with 5-min cache ──────────────────────────────
export async function fetchLivePrices(): Promise<{ eth: number; bnb: number; matic: number }> {
  const now = Date.now();
  if (_priceCache && now - _priceCache.ts < PRICE_TTL) return _priceCache.data;

  try {
    // Use CoinGecko + Binance as fallback (Binance doesn't rate-limit as hard)
    const [cgRes, bnbRes] = await Promise.allSettled([
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,matic-network&vs_currencies=usd", { signal: AbortSignal.timeout(4000) })
        .then(r => r.json()),
      fetch("https://api.binance.com/api/v3/ticker/price?symbols=[%22ETHUSDT%22,%22BNBUSDT%22,%22MATICUSDT%22]", { signal: AbortSignal.timeout(4000) })
        .then(r => r.json()),
    ]);

    let eth = 3500, bnb = 620, matic = 0.85;

    if (cgRes.status === "fulfilled") {
      const d = cgRes.value;
      eth   = d?.ethereum?.usd        ?? eth;
      bnb   = d?.binancecoin?.usd      ?? bnb;
      matic = d?.["matic-network"]?.usd ?? matic;
    } else if (bnbRes.status === "fulfilled" && Array.isArray(bnbRes.value)) {
      // Fallback: Binance
      const prices = bnbRes.value as { symbol: string; price: string }[];
      eth   = parseFloat(prices.find(p => p.symbol === "ETHUSDT")?.price  ?? `${eth}`);
      bnb   = parseFloat(prices.find(p => p.symbol === "BNBUSDT")?.price  ?? `${bnb}`);
      matic = parseFloat(prices.find(p => p.symbol === "MATICUSDT")?.price ?? `${matic}`);
    }

    const data = { eth, bnb, matic };
    _priceCache = { data, ts: now };
    return data;
  } catch {
    return _priceCache?.data ?? { eth: 3500, bnb: 620, matic: 0.85 };
  }
}

// ── Balance fetcher — fully parallel, with 30s cache ─────────────
export async function fetchWalletBalances(
  address: `0x${string}`,
  ethPrice: number,
  bnbPrice: number,
  maticPrice: number
): Promise<TokenBalance[]> {
  const cacheKey = `${address.toLowerCase()}:${Math.floor(Date.now() / BALANCE_TTL)}`;
  const cached = _balanceCache.get(cacheKey);
  if (cached) return cached.data;

  const addr = address.toLowerCase() as `0x${string}`;

  const nativePrices: Record<string, { symbol: string; price: number }> = {
    bsc:      { symbol: "BNB",   price: bnbPrice   },
    ethereum: { symbol: "ETH",   price: ethPrice   },
    polygon:  { symbol: "MATIC", price: maticPrice },
    arbitrum: { symbol: "ETH",   price: ethPrice   },
  };

  // Fire ALL calls at once — native + all stablecoins across all chains
  const allTasks = (Object.entries(clients) as [string, typeof clients.bsc][]).flatMap(([net, client]) => {
    const native = nativePrices[net];

    // Native balance task
    const nativeTask = client.getBalance({ address: addr })
      .then(bal => {
        const formatted = parseFloat(formatUnits(bal, 18));
        if (formatted < 0.00001) return null;
        return {
          symbol: native.symbol,
          network: net,
          balance: formatted.toFixed(6),
          balanceUsd: formatted * native.price,
          decimals: 18,
        } as TokenBalance;
      })
      .catch(() => null);

    // Stablecoin tasks
    const stableTasks = (STABLECOINS[net] ?? []).map(token =>
      (client.readContract as any)({
        address: token.address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [addr],
      })
        .then((raw: bigint) => {
          const formatted = parseFloat(formatUnits(raw, token.decimals));
          if (formatted < 0.01) return null;
          return {
            symbol: token.symbol,
            network: net,
            balance: formatted.toFixed(2),
            balanceUsd: formatted, // stablecoins ≈ $1
            decimals: token.decimals,
          } as TokenBalance;
        })
        .catch(() => null)
    );

    return [nativeTask, ...stableTasks];
  });

  // All tasks in parallel — typically completes in ~1-2s on Ankr
  const results = await Promise.allSettled(allTasks);
  const data: TokenBalance[] = results
    .filter((r): r is PromiseFulfilledResult<TokenBalance | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((v): v is TokenBalance => v !== null);

  _balanceCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}
