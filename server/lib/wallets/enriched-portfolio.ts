/**
 * Enriched Portfolio Module
 * Combines raw balances with live prices to create a complete portfolio view
 */

import { formatUnits } from 'viem';
import { fetchTokenPrices } from '../prices/fetch-prices';
import type { Portfolio, AggregatedAsset } from './portfolio-aggregator';

// ------------------------------------------------------------------
// Type Definitions
// ------------------------------------------------------------------
export interface EnrichedAsset extends AggregatedAsset {
  priceUsd: number;
  valueUsd: string; // formatted USD value
  valueUsdRaw: number; // unformatted for totals
}

export interface EnrichedWalletAssets {
  wallet: `0x${string}`;
  label?: string;
  assets: EnrichedAsset[];
  totalValueUsd: string;
}

export interface EnrichedPortfolio {
  aggregatedAssets: EnrichedAsset[];
  perWallet: EnrichedWalletAssets[];
  totalValueUsd: string;
  totalWallets: number;
}

// ------------------------------------------------------------------
// Calculate USD value from raw balance and price
// ------------------------------------------------------------------
function calculateUsdValue(
  rawBalance: bigint,
  decimals: number,
  priceUsd: number
): { valueUsd: number; formatted: string } {
  // Convert raw balance to decimal string, then to float
  const balanceDecimal = parseFloat(formatUnits(rawBalance, decimals));
  const value = balanceDecimal * priceUsd;
  return {
    valueUsd: value,
    formatted: value.toFixed(2),
  };
}

// ------------------------------------------------------------------
// Enrich portfolio with prices
// ------------------------------------------------------------------
export async function enrichPortfolio(portfolio: Portfolio): Promise<EnrichedPortfolio> {
  console.log('[EnrichedPortfolio] Starting enrichment process');

  // 1. Collect all unique asset keys across aggregated and per-wallet views
  const allKeys = new Set<string>();
  portfolio.aggregatedAssets.forEach((a) => allKeys.add(`${a.network}:${a.token}`));
  portfolio.perWallet.forEach((w) =>
    w.assets.forEach((a) => allKeys.add(`${a.network}:${a.token}`))
  );

  console.log(`[EnrichedPortfolio] Found ${allKeys.size} unique assets to price`);

  // 2. Fetch prices
  const prices = await fetchTokenPrices(Array.from(allKeys));
  console.log(`[EnrichedPortfolio] Fetched prices for ${Object.keys(prices).length} assets`);

  // 3. Enrich aggregated assets
  const enrichedAgg: EnrichedAsset[] = portfolio.aggregatedAssets.map((asset) => {
    const key = `${asset.network}:${asset.token}`;
    const price = prices[key] ?? 0;
    const { valueUsd, formatted } = calculateUsdValue(asset.rawTotal, asset.decimals, price);
    return { ...asset, priceUsd: price, valueUsd: formatted, valueUsdRaw: valueUsd };
  });

  // 4. Enrich per-wallet assets
  const enrichedPerWallet: EnrichedWalletAssets[] = portfolio.perWallet.map((wallet) => {
    const enrichedAssets = wallet.assets.map((asset) => {
      const key = `${asset.network}:${asset.token}`;
      const price = prices[key] ?? 0;
      const { valueUsd, formatted } = calculateUsdValue(asset.rawTotal, asset.decimals, price);
      return { ...asset, priceUsd: price, valueUsd: formatted, valueUsdRaw: valueUsd };
    });

    // Calculate wallet total
    const walletTotal = enrichedAssets.reduce((sum, a) => sum + a.valueUsdRaw, 0);

    return {
      wallet: wallet.wallet,
      label: wallet.label,
      assets: enrichedAssets,
      totalValueUsd: walletTotal.toFixed(2),
    };
  });

  // 5. Calculate total portfolio value
  const totalValue = enrichedAgg.reduce((sum, a) => sum + a.valueUsdRaw, 0);

  console.log(`[EnrichedPortfolio] Portfolio enrichment complete. Total value: $${totalValue.toFixed(2)}`);

  return {
    aggregatedAssets: enrichedAgg,
    perWallet: enrichedPerWallet,
    totalValueUsd: totalValue.toFixed(2),
    totalWallets: portfolio.totalWallets,
  };
}

// ------------------------------------------------------------------
// Get enriched portfolio for a list of wallets
// ------------------------------------------------------------------
export async function getEnrichedPortfolio(
  wallets: { address: `0x${string}`; label?: string }[]
): Promise<EnrichedPortfolio> {
  const { buildPortfolio } = await import('./portfolio-aggregator');
  const portfolio = await buildPortfolio(wallets);
  return enrichPortfolio(portfolio);
}
