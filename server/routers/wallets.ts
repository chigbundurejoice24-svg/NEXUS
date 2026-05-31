/**
 * Wallets Router
 * Provides tRPC procedures for managing user wallet addresses
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { addUserWallet, getUserWallets, removeUserWallet, updateWalletLabel } from '../db';

// Input validation schema
const EthereumAddressSchema = z.string()
  .transform(s => s.toLowerCase())
  .refine(
    (addr) => /^0x[a-f0-9]{40}$/.test(addr),
    'Invalid Ethereum address format'
  );

export const walletsRouter = router({
  /**
   * Add a new wallet address for the authenticated user
   */
  addWallet: protectedProcedure
    .input(
      z.object({
        address: EthereumAddressSchema,
        label: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('User not authenticated');
      }

      try {
        const wallet = await addUserWallet(ctx.user.id, input.address, input.label);
        return {
          success: true,
          wallet,
        };
      } catch (error) {
        console.error('[WalletsRouter] Error adding wallet:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add wallet',
          wallet: null,
        };
      }
    }),

  /**
   * List all wallets for the authenticated user
   */
  listWallets: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new Error('User not authenticated');
      }

      try {
        const wallets = await getUserWallets(ctx.user.id);
        return {
          success: true,
          wallets,
        };
      } catch (error) {
        console.error('[WalletsRouter] Error listing wallets:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list wallets',
          wallets: [],
        };
      }
    }),

  /**
   * Remove a wallet address
   */
  removeWallet: protectedProcedure
    .input(
      z.object({
        walletId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('User not authenticated');
      }

      try {
        await removeUserWallet(input.walletId, ctx.user.id);
        return {
          success: true,
        };
      } catch (error) {
        console.error('[WalletsRouter] Error removing wallet:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove wallet',
        };
      }
    }),

  /**
   * Update wallet label
   */
  updateLabel: protectedProcedure
    .input(
      z.object({
        walletId: z.number(),
        label: z.string().max(255),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new Error('User not authenticated');
      }

      try {
        const wallet = await updateWalletLabel(input.walletId, ctx.user.id, input.label);
        return {
          success: true,
          wallet,
        };
      } catch (error) {
        console.error('[WalletsRouter] Error updating label:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update label',
          wallet: null,
        };
      }
    }),
});
