/**
 * Portfolio Aggregator Module
 * Fetches raw balances from multiple blockchains and aggregates them
 * Supports Ethereum, BSC, Polygon, and Arbitrum
 *
 * NOTE: Clients are created lazily (not at module load time) to avoid
 * cold-start crashes in Vercel serverless environments.
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { mainnet, bsc, polygon, arbitrum } from 'viem/chains';

// ------------------------------------------------------------------
// Type Definitions
// ------------------------------------------------------------------
export interface AggregatedAsset {
  network: string;
  token: string;
  totalBalance: string;
  decimals: number;
  type: 'native' | 'erc20';
  rawTotal: bigint;
}

export interface WalletAssets {
  wallet: `0x${string}`;
  label?: string;
  assets: AggregatedAsset[];
}

export interface Portfolio {
  aggregatedAssets: AggregatedAsset[];
  perWallet: WalletAssets[];
  totalWallets: number;
}

// ------------------------------------------------------------------
// Chain Configuration — lazy clients
// ------------------------------------------------------------------
const CHAIN_CONFIGS = {
  ethereum: { chain: mainnet, rpc: 'https://eth.llamarpc.com',         nativeToken: 'ETH'  },
  bsc:      { chain: bsc,     rpc: 'https://bsc-rpc.publicnode.com',   nativeToken: 'BNB'  },
  polygon:  { chain: polygon, rpc: 'https://polygon-rpc.com',          nativeToken: 'MATIC' },
  arbitrum: { chain: arbitrum, rpc: 'https://arbitrum.llamarpc.com',   nativeToken: 'ETH'  },
} as const;

type ChainName = keyof typeof CHAIN_CONFIGS;

const _clients: Partial<Record<ChainName, ReturnType<typeof createPublicClient>>> = {};

function getClient(chainName: ChainName) {
  if (!_clients[chainName]) {
    const cfg = CHAIN_CONFIGS[chainName];
    _clients[chainName] = createPublicClient({
      chain: cfg.chain,
      transport: http(cfg.rpc),
    });
  }
  return _clients[chainName]!;
}

// ------------------------------------------------------------------
// Token Configurations
// ------------------------------------------------------------------
interface TokenConfig {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
}

const TOKEN_CONFIGS: Record<string, Record<string, TokenConfig>> = {
  ethereum: {
    USDT: { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6,  symbol: 'USDT' },
    USDC: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6,  symbol: 'USDC' },
    BTC:  { address: '0x2260fac5e5542a773aa44fbcff022c5ad373b40d', decimals: 8,  symbol: 'BTC'  },
  },
  bsc: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' },
    USDC: { address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d', decimals: 18, symbol: 'USDC' },
    BTC:  { address: '0x7130d2A12B9BCbFdd356A9f62dF9F7B651B06823', decimals: 18, symbol: 'BTC'  },
  },
  polygon: {
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6,  symbol: 'USDT' },
    USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6,  symbol: 'USDC' },
    BTC:  { address: '0x1bfd67037b42cf73acF2047067bd4303cb8b0740', decimals: 8,  symbol: 'BTC'  },
  },
  arbitrum: {
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6,  symbol: 'USDT' },
    USDC: { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86', decimals: 6,  symbol: 'USDC' },
    BTC:  { address: '0x2f2a2540d6a7ab70dd38cEa4c4f0F2548D93A23b', decimals: 8,  symbol: 'BTC'  },
  },
};

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
] as const;

// ------------------------------------------------------------------
// Balance helpers
// ------------------------------------------------------------------
async function fetchNativeBalance(chainName: ChainName, address: `0x${string}`): Promise<bigint> {
  try {
    return await getClient(chainName).getBalance({ address });
  } catch {
    return 0n;
  }
}

async function fetchERC20Balance(chainName: ChainName, address: `0x${string}`, token: TokenConfig): Promise<bigint> {
  try {
    const balance = await (getClient(chainName).readContract as any)({
      address: token.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    return BigInt(balance as string);
  } catch {
    return 0n;
  }
}

async function buildWalletPortfolio(wallet: `0x${string}`, label?: string): Promise<WalletAssets> {
  const assets: AggregatedAsset[] = [];

  for (const [chainName, cfg] of Object.entries(CHAIN_CONFIGS) as [ChainName, typeof CHAIN_CONFIGS[ChainName]][]) {
    const rawBalance = await fetchNativeBalance(chainName, wallet);
    if (rawBalance > 0n) {
      assets.push({ network: chainName, token: cfg.nativeToken, totalBalance: formatUnits(rawBalance, 18), decimals: 18, type: 'native', rawTotal: rawBalance });
    }
  }

  for (const [chainName, tokens] of Object.entries(TOKEN_CONFIGS)) {
    for (const [, tokenConfig] of Object.entries(tokens)) {
      const rawBalance = await fetchERC20Balance(chainName as ChainName, wallet, tokenConfig);
      if (rawBalance > 0n) {
        assets.push({ network: chainName, token: tokenConfig.symbol, totalBalance: formatUnits(rawBalance, tokenConfig.decimals), decimals: tokenConfig.decimals, type: 'erc20', rawTotal: rawBalance });
      }
    }
  }

  return { wallet, label, assets };
}

export async function buildPortfolio(wallets: { address: `0x${string}`; label?: string }[]): Promise<Portfolio> {
  const perWallet = await Promise.all(wallets.map((w) => buildWalletPortfolio(w.address, w.label)));

  const aggregatedMap = new Map<string, AggregatedAsset>();
  for (const wallet of perWallet) {
    for (const asset of wallet.assets) {
      const key = `${asset.network}:${asset.token}`;
      const existing = aggregatedMap.get(key);
      if (existing) {
        const newRawTotal = existing.rawTotal + asset.rawTotal;
        aggregatedMap.set(key, { ...existing, rawTotal: newRawTotal, totalBalance: formatUnits(newRawTotal, existing.decimals) });
      } else {
        aggregatedMap.set(key, asset);
      }
    }
  }

  return { aggregatedAssets: Array.from(aggregatedMap.values()), perWallet, totalWallets: wallets.length };
}
