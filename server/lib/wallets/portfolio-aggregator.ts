/**
 * Portfolio Aggregator Module
 * Fetches raw balances from multiple blockchains and aggregates them
 * Supports Ethereum, BSC, Polygon, and Arbitrum
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { mainnet, bsc, polygon, arbitrum } from 'viem/chains';

// ------------------------------------------------------------------
// Type Definitions
// ------------------------------------------------------------------
export interface AggregatedAsset {
  network: string;
  token: string;
  totalBalance: string; // formatted decimal string
  decimals: number;
  type: 'native' | 'erc20';
  rawTotal: bigint; // raw balance for precise calculations
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
// Chain Configuration
// ------------------------------------------------------------------
const CHAINS = {
  ethereum: {
    name: 'ethereum',
    client: createPublicClient({
      chain: mainnet,
      transport: http('https://eth.llamarpc.com'),
    }),
    nativeToken: 'ETH',
  },
  bsc: {
    name: 'bsc',
    client: createPublicClient({
      chain: bsc,
      transport: http('https://bsc-rpc.publicnode.com'),
    }),
    nativeToken: 'BNB',
  },
  polygon: {
    name: 'polygon',
    client: createPublicClient({
      chain: polygon,
      transport: http('https://polygon-rpc.com'),
    }),
    nativeToken: 'MATIC',
  },
  arbitrum: {
    name: 'arbitrum',
    client: createPublicClient({
      chain: arbitrum,
      transport: http('https://arbitrum.llamarpc.com'),
    }),
    nativeToken: 'ETH',
  },
};

// ------------------------------------------------------------------
// Token Configurations (ERC20 tokens)
// ------------------------------------------------------------------
interface TokenConfig {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
}

const TOKEN_CONFIGS: Record<string, Record<string, TokenConfig>> = {
  ethereum: {
    USDT: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
      symbol: 'USDT',
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      symbol: 'USDC',
    },
    BTC: {
      address: '0x2260fac5e5542a773aa44fbcff022c5ad373b40d',
      decimals: 8,
      symbol: 'BTC',
    },
  },
  bsc: {
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      decimals: 18,
      symbol: 'USDT',
    },
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
      decimals: 18,
      symbol: 'USDC',
    },
    BTC: {
      address: '0x7130d2A12B9BCbFdd356A9f62dF9F7B651B06823',
      decimals: 18,
      symbol: 'BTC',
    },
  },
  polygon: {
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      decimals: 6,
      symbol: 'USDT',
    },
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      decimals: 6,
      symbol: 'USDC',
    },
    BTC: {
      address: '0x1bfd67037b42cf73acF2047067bd4303cb8b0740',
      decimals: 8,
      symbol: 'BTC',
    },
  },
  arbitrum: {
    USDT: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      decimals: 6,
      symbol: 'USDT',
    },
    USDC: {
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86',
      decimals: 6,
      symbol: 'USDC',
    },
    BTC: {
      address: '0x2f2a2540d6a7ab70dd38cEa4c4f0F2548D93A23b',
      decimals: 8,
      symbol: 'BTC',
    },
  },
};

// ------------------------------------------------------------------
// ERC20 ABI (minimal - only balanceOf)
// ------------------------------------------------------------------
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
// Fetch native token balance
// ------------------------------------------------------------------
async function fetchNativeBalance(
  chainName: string,
  address: `0x${string}`
): Promise<bigint> {
  const chain = CHAINS[chainName as keyof typeof CHAINS];
  if (!chain) {
    console.warn(`[PortfolioAgg] Unknown chain: ${chainName}`);
    return 0n;
  }

  try {
    const balance = await chain.client.getBalance({ address });
    return balance;
  } catch (error) {
    console.error(`[PortfolioAgg] Error fetching native balance on ${chainName}:`, error);
    return 0n;
  }
}

// ------------------------------------------------------------------
// Fetch ERC20 token balance
// ------------------------------------------------------------------
async function fetchERC20Balance(
  chainName: string,
  address: `0x${string}`,
  tokenConfig: TokenConfig
): Promise<bigint> {
  const chain = CHAINS[chainName as keyof typeof CHAINS];
  if (!chain) {
    console.warn(`[PortfolioAgg] Unknown chain: ${chainName}`);
    return 0n;
  }

  try {
    const balance = await (chain.client.readContract as any)({
      address: tokenConfig.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    return BigInt(balance as string);
  } catch (error) {
    console.error(
      `[PortfolioAgg] Error fetching ${tokenConfig.symbol} balance on ${chainName}:`,
      error
    );
    return 0n;
  }
}

// ------------------------------------------------------------------
// Build portfolio for a single wallet across all chains
// ------------------------------------------------------------------
async function buildWalletPortfolio(
  wallet: `0x${string}`,
  label?: string
): Promise<WalletAssets> {
  const assets: AggregatedAsset[] = [];

  // Fetch native tokens
  for (const [chainName, chainConfig] of Object.entries(CHAINS)) {
    const rawBalance = await fetchNativeBalance(chainName, wallet);
    if (rawBalance > 0n) {
      assets.push({
        network: chainName,
        token: chainConfig.nativeToken,
        totalBalance: formatUnits(rawBalance, 18), // Most native tokens use 18 decimals
        decimals: 18,
        type: 'native',
        rawTotal: rawBalance,
      });
    }
  }

  // Fetch ERC20 tokens
  for (const [chainName, tokens] of Object.entries(TOKEN_CONFIGS)) {
    for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
      const rawBalance = await fetchERC20Balance(chainName, wallet, tokenConfig);
      if (rawBalance > 0n) {
        assets.push({
          network: chainName,
          token: tokenSymbol,
          totalBalance: formatUnits(rawBalance, tokenConfig.decimals),
          decimals: tokenConfig.decimals,
          type: 'erc20',
          rawTotal: rawBalance,
        });
      }
    }
  }

  return {
    wallet,
    label,
    assets,
  };
}

// ------------------------------------------------------------------
// Aggregate multiple wallets
// ------------------------------------------------------------------
export async function buildPortfolio(
  wallets: { address: `0x${string}`; label?: string }[]
): Promise<Portfolio> {
  console.log(`[PortfolioAgg] Building portfolio for ${wallets.length} wallet(s)`);

  // Fetch per-wallet data
  const perWallet = await Promise.all(
    wallets.map((w) => buildWalletPortfolio(w.address, w.label))
  );

  // Aggregate assets across all wallets
  const aggregatedMap = new Map<string, AggregatedAsset>();

  for (const wallet of perWallet) {
    for (const asset of wallet.assets) {
      const key = `${asset.network}:${asset.token}`;
      const existing = aggregatedMap.get(key);

      if (existing) {
        // Sum the raw totals
        const newRawTotal = existing.rawTotal + asset.rawTotal;
        aggregatedMap.set(key, {
          ...existing,
          rawTotal: newRawTotal,
          totalBalance: formatUnits(newRawTotal, existing.decimals),
        });
      } else {
        aggregatedMap.set(key, asset);
      }
    }
  }

  const aggregatedAssets = Array.from(aggregatedMap.values());

  console.log(`[PortfolioAgg] Portfolio built with ${aggregatedAssets.length} unique assets`);

  return {
    aggregatedAssets,
    perWallet,
    totalWallets: wallets.length,
  };
}
