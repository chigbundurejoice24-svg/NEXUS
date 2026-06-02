/**
 * wallets.ts — legacy router shim
 *
 * The primary wallet management is in accounts.ts (linkWallet, myWallets, etc.)
 * This router is kept for backward compatibility and re-exports via account-service.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  linkWallet,
  getUserWalletAddresses,
  removeWallet,
} from "../lib/accounts/account-service";
import { requireAuth } from "../lib/accounts/auth";

const EthAddressSchema = z
  .string()
  .toLowerCase()
  .refine((a) => /^0x[a-f0-9]{40}$/.test(a), "Invalid Ethereum address");

export const walletsRouter = router({
  /** Add a wallet address for the authenticated user */
  addWallet: protectedProcedure
    .input(z.object({
      address: EthAddressSchema,
      label:   z.string().max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      const wallet = await linkWallet({
        userId,
        address: input.address,
        chainId: 56,          // default BSC
        type: "EXTERNAL",
        label: input.label,
      });
      return { success: true, wallet };
    }),

  /** List wallet addresses for the authenticated user */
  getWallets: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      return getUserWalletAddresses(userId);
    }),

  /** Remove a wallet address */
  removeWallet: protectedProcedure
    .input(z.object({ walletId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      await removeWallet(userId, input.walletId);
      return { success: true };
    }),
});
