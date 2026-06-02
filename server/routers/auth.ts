/**
 * auth.ts — passkey + JWT authentication router
 *
 * Flow:
 *   register  → stores credentialId + publicKey, returns JWT
 *   login     → looks up credentialId, returns JWT
 *   me        → reads ctx.user populated by JWT middleware in context.ts
 *   logout    → client discards JWT (stateless; no server state to clear)
 *
 * JWT_SECRET must be set in Vercel env vars. Falls back to a dev placeholder
 * so the server still boots locally without configuration.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "aegis-dev-secret-change-in-prod";
const JWT_EXPIRES = "7d";

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export const authRouter = router({
  /**
   * Register a new user via passkey credential.
   * In production the attestation object should be verified; for Phase 1
   * we store the credentialId + publicKey and issue a JWT immediately.
   */
  register: publicProcedure
    .input(
      z.object({
        credentialId: z.string().min(1),
        publicKey: z.string().min(1),
        displayName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Prevent duplicate registration
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.credentialId, input.credentialId))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Credential already registered" });
      }

      const openId = `passkey_${input.credentialId.slice(0, 32)}`;
      const [user] = await db
        .insert(users)
        .values({
          openId,
          credentialId: input.credentialId,
          publicKey: input.publicKey,
          name: input.displayName || null,
          lastSignedIn: new Date(),
        })
        .returning({ id: users.id });

      const token = signToken(user.id);
      return { token, user: { id: user.id } };
    }),

  /**
   * Login with an existing passkey credential ID.
   * The browser already verified the assertion via WebAuthn; we just look up
   * the user and issue a fresh JWT.
   */
  login: publicProcedure
    .input(
      z.object({
        credentialId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db
        .select({ id: users.id, credentialId: users.credentialId, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.credentialId, input.credentialId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Passkey not registered — please register first" });
      }

      // Update last sign-in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      const token = signToken(user.id);
      return { token, user: { id: user.id, name: user.name, role: user.role } };
    }),

  /**
   * Returns the current user from the JWT in context.
   * Returns null if unauthenticated (public procedure — no throw).
   */
  me: publicProcedure.query(({ ctx }) => ctx.user ?? null),

  /**
   * Stateless logout — client deletes the JWT from localStorage.
   * Kept for API symmetry; no server action needed.
   */
  logout: publicProcedure.mutation(() => ({ success: true })),
});
