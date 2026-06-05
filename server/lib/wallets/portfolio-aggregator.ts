/**
 * portfolio-aggregator.ts — Institution-grade multi-chain balance engine
 *
 * Architecture:
 * - Multicall3 batching: ONE RPC call per chain fetches ALL token balances
 * - RPC failover: Primary (Alchemy/private) → Secondary → Tertiary public
 * - Per-chain timeout (3s): no chain blocks the others
 * - Parallel chain execution: all chains run simultaneously
 * - BigInt-safe: all arithmetic in raw wei until final formatting
 * - 15s server-side cache: snapshot system handles longer stale data
 */
import { createPublicClient, http, formatUnits, type PublicClient } from 'viem';
import { mainnet, bsc, polygon, arbitrum } from 'viem/chains';
import { getCache, setCache } from '../cache';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface AggregatedAsset {
  network:      string;
  token:        string;
  totalBalance: string;
  decimals:     number;
  type:         'native' | 'erc20';
  rawTotal:     bigint;
}

export interface WalletAssets {
  wallet: `0x${string}`;
  label?: string;
  assets: AggregatedAsset[];
}

export interface Portfolio {
  aggregatedAssets: AggregatedAsset[];
  perWallet:        WalletAssets[];
  totalWallets:     number;
  fetchedAt:        number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multicall3 — single call fetches ALL balances per chain
// Deployed on every major chain at the same address
// ─────────────────────────────────────────────────────────────────────────────
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

// ABI fragments — only what we need
const MULTICALL3_ABI = [{
  name: 'aggregate3',
  type: 'function',
  stateMutability: 'view',
  inputs: [{
    name: 'calls', type: 'tuple[]',
    components: [
      { name: 'target',       type: 'address' },
      { name: 'allowFailure', type: 'bool'    },
      { name: 'callData',     type: 'bytes'   },
    ]
  }],
  outputs: [{
    name: 'returnData', type: 'tuple[]',
    components: [
      { name: 'success',    type: 'bool'  },
      { name: 'returnData', type: 'bytes' },
    ]
  }],
}] as const;

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs:  [{ name: 'account', type: 'address' }],
  outputs: [{ name: '',        type: 'uint256' }],
}] as const;

const ETH_BALANCE_ABI = [{
  name: 'getEthBalance', type: 'function', stateMutability: 'view',
  inputs:  [{ name: 'addr', type: 'address' }],
  outputs: [{ name: '',     type: 'uint256' }],
}] as const;

// ─────────────────────────────────────────────────────────────────────────────
// RPC config — Primary (private/Alchemy) → Fallback chain
// Set ALCHEMY_ETH_URL etc in Vercel env for production grade
// Falls back to public nodes automatically
// ─────────────────────────────────────────────────────────────────────────────
const RPC_CHAINS = {
  ethereum: {
    chain: mainnet,
    nativeToken: 'ETH',
    nativeDecimals: 18,
    rpcs: [
      process.env.ETH_RPC_URL,
      process.env.ALCHEMY_ETH_URL,
      'https://eth.llamarpc.com',
      'https://cloudflare-eth.com',
      'https://rpc.ankr.com/eth',
    ].filter(Boolean) as string[],
  },
  bsc: {
    chain: bsc,
    nativeToken: 'BNB',
    nativeDecimals: 18,
    rpcs: [
      process.env.BSC_RPC_URL,
      process.env.ALCHEMY_BSC_URL,
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-rpc.publicnode.com',
      'https://rpc.ankr.com/bsc',
    ].filter(Boolean) as string[],
  },
  polygon: {
    chain: polygon,
    nativeToken: 'MATIC',
    nativeDecimals: 18,
    rpcs: [
      process.env.POLYGON_RPC_URL,
      process.env.ALCHEMY_POLYGON_URL,
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
    ].filter(Boolean) as string[],
  },
  arbitrum: {
    chain: arbitrum,
    nativeToken: 'ETH',
    nativeDecimals: 18,
    rpcs: [
      process.env.ARB_RPC_URL,
      process.env.ALCHEMY_ARB_URL,
      'https://arbitrum.llamarpc.com',
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
    ].filter(Boolean) as string[],
  },
} as const;

type ChainName = keyof typeof RPC_CHAINS;

// ─────────────────────────────────────────────────────────────────────────────
// Token registry — all tokens we track per chain
// ─────────────────────────────────────────────────────────────────────────────
interface TokenDef {
  address:  `0x${string}`;
  symbol:   string;
  decimals: number;
}

const TOKENS: Record<ChainName, TokenDef[]> = {
  ethereum: [
    { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', decimals: 6  },
    { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6  },
    { address: '0x2260fac5e5542a773aa44fbcff022c5ad373b40d', symbol: 'WBTC', decimals: 8  },
    { address: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI',  decimals: 18 },
  ],
  bsc: [
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
    { address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
    { address: '0x7130d2A12B9BCbFdd356A9f62dF9F7B651B06823', symbol: 'BTCB', decimals: 18 },
    { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', decimals: 18 },
    { address: '0xe470e53147e199e6a6c02a50473ff8e84bd2d2ca', symbol: 'CZN',  decimals: 9  },
  ],
  polygon: [
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6  },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', decimals: 6  },
    { address: '0x1bfd67037b42cf73acF2047067bd4303cb8b0740', symbol: 'WBTC', decimals: 8  },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI',  decimals: 18 },
  ],
  arbitrum: [
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6  },
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86', symbol: 'USDC', decimals: 6  },
    { address: '0x2f2a2540d6a7ab70dd38cEa4c4f0F2548D93A23b', symbol: 'WBTC', decimals: 8  },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI',  decimals: 18 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Client pool with failover
// ─────────────────────────────────────────────────────────────────────────────
const _clients: Map<string, PublicClient> = new Map();

function makeClient(chain: typeof RPC_CHAINS[ChainName]['chain'], rpc: string): PublicClient {
  const key = `${chain.id}:${rpc}`;
  if (!_clients.has(key)) {
    _clients.set(key, createPublicClient({
      chain,
      transport: http(rpc, { timeout: 5_000, retryCount: 0 }),
    }));
  }
  return _clients.get(key)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multicall3-based batch fetcher — ONE call gets all balances for a wallet
// ─────────────────────────────────────────────────────────────────────────────
async function fetchChainBalances(
  chainName: ChainName,
  wallet: `0x${string}`,
): Promise<AggregatedAsset[]> {
  const cfg    = RPC_CHAINS[chainName];
  const tokens = TOKENS[chainName];

  // Build multicall calls: native ETH balance + each ERC20
  const calls = [
    // Native balance via Multicall3.getEthBalance
    { target: MULTICALL3, allowFailure: true, callData: encodeGetEthBalance(wallet) },
    // ERC20 balances
    ...tokens.map(t => ({
      target:       t.address,
      allowFailure: true,
      callData:     encodeBalanceOf(wallet),
    })),
  ];

  // Try each RPC in order until one succeeds
  let lastErr: Error | null = null;
  for (const rpc of cfg.rpcs) {
    try {
      const client = makeClient(cfg.chain as any, rpc);
      const results = await Promise.race([
        client.readContract({
          address:      MULTICALL3,
          abi:          MULTICALL3_ABI,
          functionName: 'aggregate3',
          args:         [calls],
        }) as Promise<Array<{ success: boolean; returnData: `0x${string}` }>>,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 4_000)),
      ]);

      const assets: AggregatedAsset[] = [];

      // Native
      const nativeResult = results[0];
      if (nativeResult?.success && nativeResult.returnData !== '0x') {
        const raw = decodeBigInt(nativeResult.returnData);
        if (raw > 0n) {
          assets.push({
            network:      chainName,
            token:        cfg.nativeToken,
            totalBalance: formatUnits(raw, cfg.nativeDecimals),
            decimals:     cfg.nativeDecimals,
            type:         'native',
            rawTotal:     raw,
          });
        }
      }

      // ERC20s
      tokens.forEach((token, i) => {
        const r = results[i + 1];
        if (!r?.success || r.returnData === '0x' || r.returnData === '0x' + '0'.repeat(64)) return;
        try {
          const raw = decodeBigInt(r.returnData);
          if (raw > 0n) {
            assets.push({
              network:      chainName,
              token:        token.symbol,
              totalBalance: formatUnits(raw, token.decimals),
              decimals:     token.decimals,
              type:         'erc20',
              rawTotal:     raw,
            });
          }
        } catch { /* skip malformed */ }
      });

      return assets;
    } catch (e) {
      lastErr = e as Error;
      continue; // try next RPC
    }
  }

  // All RPCs failed — return empty (non-fatal, logged)
  console.warn(`[Portfolio] ${chainName} all RPCs failed: ${lastErr?.message?.slice(0, 60)}`);
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// ABI encoding helpers (no viem encodeAbi needed — raw hex is faster)
// ─────────────────────────────────────────────────────────────────────────────
function encodeBalanceOf(addr: `0x${string}`): `0x${string}` {
  // balanceOf(address) = selector 0x70a08231 + address padded to 32 bytes
  return `0x70a08231000000000000000000000000${addr.slice(2).toLowerCase()}`;
}

function encodeGetEthBalance(addr: `0x${string}`): `0x${string}` {
  // getEthBalance(address) = selector 0x4d2301cc + address padded
  return `0x4d2301cc000000000000000000000000${addr.slice(2).toLowerCase()}`;
}

function decodeBigInt(hex: `0x${string}`): bigint {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!clean || clean === '0'.repeat(64)) return 0n;
  return BigInt('0x' + clean.slice(0, 64));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
async function buildWalletPortfolio(wallet: `0x${string}`, label?: string): Promise<WalletAssets> {
  // All chains in parallel — no chain waits for another
  const chainResults = await Promise.allSettled(
    (Object.keys(RPC_CHAINS) as ChainName[]).map(chain => fetchChainBalances(chain, wallet))
  );

  const assets: AggregatedAsset[] = chainResults.flatMap(r =>
    r.status === 'fulfilled' ? r.value : []
  );

  return { wallet, label, assets };
}

export async function buildPortfolio(
  wallets: { address: `0x${string}`; label?: string }[]
): Promise<Portfolio> {
  if (!wallets.length) {
    return { aggregatedAssets: [], perWallet: [], totalWallets: 0, fetchedAt: Date.now() };
  }

  const cacheKey = `portfolio:v3:${wallets.map(w => w.address.toLowerCase()).sort().join(':')}`;
  const cached = getCache<Portfolio>(cacheKey);
  if (cached) return cached;

  // All wallets in parallel
  const perWallet = await Promise.all(wallets.map(w => buildWalletPortfolio(w.address as `0x${string}`, w.label)));

  // Aggregate across wallets (bigint-safe)
  const aggMap = new Map<string, AggregatedAsset>();
  for (const w of perWallet) {
    for (const asset of w.assets) {
      const key = `${asset.network}:${asset.token}`;
      const existing = aggMap.get(key);
      if (existing) {
        const newRaw = existing.rawTotal + asset.rawTotal;
        aggMap.set(key, { ...existing, rawTotal: newRaw, totalBalance: formatUnits(newRaw, existing.decimals) });
      } else {
        aggMap.set(key, { ...asset });
      }
    }
  }

  const result: Portfolio = {
    aggregatedAssets: Array.from(aggMap.values()),
    perWallet,
    totalWallets: wallets.length,
    fetchedAt:    Date.now(),
  };

  setCache(cacheKey, result, 15_000); // 15s live cache
  return result;
}
