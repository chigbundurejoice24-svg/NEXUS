/**
 * accounts.ts — tRPC router
 * Exposes account-service methods as typed tRPC procedures.
 * Personal wallet operations use protectedProcedure (auth required).
 * Business operations also require auth + role enforcement inside the service.
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createUser,
  getUser,
  linkWallet,
  removeWallet,
  getUserWalletAddresses,
  createBusiness,
  addBusinessWallet,
  getBusinessWalletAddresses,
  setRecovery,
} from "../lib/accounts/account-service";
import { getConsolidatedWalletList } from "../lib/accounts/wallet-list";
import { requireAuth } from "../lib/accounts/auth";

const EthAddressSchema = z
  .string()
  .toLowerCase()
  .refine((a) => /^0x[a-f0-9]{40}$/.test(a), "Invalid Ethereum address");

export const accountsRouter = router({
  // ── User ────────────────────────────────────
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireAuth(ctx.user?.id);
    return getUser(userId);
  }),

  // ── Personal wallets ────────────────────────
  linkWallet: protectedProcedure
    .input(
      z.object({
        address: EthAddressSchema,
        chainId: z.number().int().positive(),
        type: z.enum(["EMBEDDED", "EXTERNAL"]),
        label: z.string().max(255).optional(),
        // Required only for EXTERNAL wallets
        signature: z.string().optional(),
        signedMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      const wallet = await linkWallet({
        userId,
        address: input.address!,
        chainId: input.chainId!,
        type: input.type!,
        label: input.label,
        signature: input.signature,
        signedMessage: input.signedMessage,
      });
      return { success: true, wallet };
    }),

  removeWallet: protectedProcedure
    .input(z.object({ walletId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      await removeWallet(userId, input.walletId);
      return { success: true };
    }),

  myWallets: protectedProcedure.query(async ({ ctx }) => {
    const userId = requireAuth(ctx.user?.id);
    return getUserWalletAddresses(userId);
  }),

  consolidatedWallets: protectedProcedure
    .input(z.object({ businessIds: z.array(z.number()).optional() }))
    .query(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      return getConsolidatedWalletList(userId, input.businessIds);
    }),

  // ── Recovery ────────────────────────────────
  setRecovery: protectedProcedure
    .input(
      z.object({
        recoveryCredentialId: z.string().optional(),
        recoveryWallet: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      await setRecovery(userId, input.recoveryCredentialId, input.recoveryWallet);
      return { success: true };
    }),

  // ── Businesses ──────────────────────────────
  createBusiness: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      const business = await createBusiness(input.name, userId);
      return { success: true, business };
    }),

  addBusinessWallet: protectedProcedure
    .input(
      z.object({
        businessId: z.number().int().positive(),
        address: EthAddressSchema,
        chainId: z.number().int().positive(),
        type: z.enum(["EMBEDDED", "EXTERNAL"]),
        label: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = requireAuth(ctx.user?.id);
      const wallet = await addBusinessWallet({ ...input, requesterUserId: userId });
      return { success: true, wallet };
    }),

  businessWallets: protectedProcedure
    .input(z.object({ businessId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return getBusinessWalletAddresses(input.businessId);
    }),
});
