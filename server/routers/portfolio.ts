/**
 * Portfolio Router
 * Provides tRPC procedures for fetching wallet balances and live prices
 */

import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { getEnrichedPortfolio } from '../lib/wallets/enriched-portfolio';

// Input validation schema
const WalletInputSchema = z.object({
  address: z.string().transform(s => s.toLowerCase()).refine(
    (addr) => /^0x[a-f0-9]{40}$/.test(addr),
    'Invalid Ethereum address format'
  ),
  label: z.string().optional(),
});

const GetPortfolioInputSchema = z.object({
  wallets: z.array(WalletInputSchema).min(1, 'At least one wallet is required'),
});

export const portfolioRouter = router({
  /**
   * Get aggregated portfolio with live prices
   * Combines balances from multiple wallets and fetches live USD prices
   */
  getAggregated: publicProcedure
    .input(GetPortfolioInputSchema)
    .query(async ({ input }) => {
      console.log(`[PortfolioRouter] Getting aggregated portfolio for ${input.wallets.length} wallet(s)`);
      
      try {
        // Convert input to proper format
        const wallets = input.wallets.map((w) => ({
          address: w.address as `0x${string}`,
          label: w.label,
        }));

        const portfolio = await getEnrichedPortfolio(wallets);
        
        return {
          success: true,
          data: portfolio,
        };
      } catch (error) {
        console.error('[PortfolioRouter] Error getting portfolio:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch portfolio',
          data: null,
        };
      }
    }),

  /**
   * Get total portfolio value
   * Returns the total USD value across all wallets
   */
  getTotalValue: publicProcedure
    .input(GetPortfolioInputSchema)
    .query(async ({ input }) => {
      try {
        const wallets = input.wallets.map((w) => ({
          address: w.address as `0x${string}`,
          label: w.label,
        }));

        const portfolio = await getEnrichedPortfolio(wallets);
        
        return {
          success: true,
          totalValueUsd: portfolio.totalValueUsd,
          totalWallets: portfolio.totalWallets,
        };
      } catch (error) {
        console.error('[PortfolioRouter] Error getting total value:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch total value',
          totalValueUsd: '0',
          totalWallets: 0,
        };
      }
    }),

  /**
   * Get per-wallet breakdown
   * Returns asset details for each wallet separately
   */
  getByWallet: publicProcedure
    .input(GetPortfolioInputSchema)
    .query(async ({ input }) => {
      try {
        const wallets = input.wallets.map((w) => ({
          address: w.address as `0x${string}`,
          label: w.label,
        }));

        const portfolio = await getEnrichedPortfolio(wallets);
        
        return {
          success: true,
          wallets: portfolio.perWallet,
        };
      } catch (error) {
        console.error('[PortfolioRouter] Error getting per-wallet data:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch wallet data',
          wallets: [],
        };
      }
    }),

  /**
   * Get prices for specific assets
   * Useful for rate display and exchange calculations
   */
  getPrices: publicProcedure
    .input(
      z.object({
        assetKeys: z.array(z.string()).min(1, 'At least one asset key is required'),
      })
    )
    .query(async ({ input }) => {
      try {
        const { fetchTokenPrices } = await import('../lib/prices/fetch-prices');
        const prices = await fetchTokenPrices(input.assetKeys);
        
        return {
          success: true,
          prices,
        };
      } catch (error) {
        console.error('[PortfolioRouter] Error getting prices:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch prices',
          prices: {},
        };
      }
    }),
});
