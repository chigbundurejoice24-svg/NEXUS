/**
 * auth.ts — passkey + JWT authentication router
 *
 * On registration: generates a deterministic embedded wallet from the credentialId
 * and auto-links it to the new user's account on BSC.
 */
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, linkedWallets } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { deriveWalletAddress, EMBEDDED_WALLET_CHAIN_ID } from "../lib/wallets/wallet-generator";

const JWT_SECRET = process.env.JWT_SECRET || "aegis-dev-secret-change-in-prod";
const JWT_EXPIRES = "7d";

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export const authRouter = router({
  register: publicProcedure
    .input(z.object({
      credentialId: z.string().min(1),
      publicKey:    z.string().min(1),
      displayName:  z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check for existing credential
      const existing = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.credentialId, input.credentialId))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Credential already registered" });
      }

      const openId = `passkey_${input.credentialId.slice(0, 48)}`;

      // 1. Create user
      await db.insert(users).values({
        openId,
        credentialId: input.credentialId,
        publicKey:    input.publicKey,
        name:         input.displayName ?? null,
        lastSignedIn: new Date(),
      });

      const [user] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed" });

      // 2. Auto-generate embedded wallet (deterministic, no private key stored)
      const walletAddress = deriveWalletAddress(input.credentialId);

      try {
        await db.insert(linkedWallets).values({
          userId:  user.id,
          address: walletAddress,
          chainId: EMBEDDED_WALLET_CHAIN_ID, // BSC
          type:    "EMBEDDED",
          label:   "My Aegis Wallet",
        });
      } catch {
        // Wallet might already exist (rare race) — not fatal
      }

      const token = signToken(user.id);
      return {
        token,
        user:          { id: user.id },
        walletAddress, // return to client so it can display immediately
      };
    }),

  login: publicProcedure
    .input(z.object({ credentialId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db.select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.credentialId, input.credentialId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey not registered — register first" });

      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // Fetch the user's embedded wallet so client can display it
      const [wallet] = await db.select({ address: linkedWallets.address })
        .from(linkedWallets)
        .where(eq(linkedWallets.userId, user.id))
        .limit(1);

      const token = signToken(user.id);
      return {
        token,
        user:          { id: user.id, name: user.name, role: user.role },
        walletAddress: wallet?.address ?? null,
      };
    }),

  me: publicProcedure.query(({ ctx }) => (ctx as any).user ?? null),
  logout: publicProcedure.mutation(() => ({ success: true })),
});
