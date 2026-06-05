/**
 * preferences.ts — User preferences tRPC router
 *
 * Persists theme, country, currency, notifications to DB.
 * Survives: deployments, browser clears, device switches.
 *
 * Client strategy:
 *   - On login: fetch prefs → apply to localStorage + document
 *   - On change: write localStorage immediately (instant) + call this endpoint
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { userPreferences } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export const preferencesRouter = router({

  // ── Get preferences (called right after login) ────────────────────────────
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);
    return row ?? null;
  }),

  // ── Save / upsert preferences ─────────────────────────────────────────────
  save: protectedProcedure
    .input(z.object({
      theme:         z.enum(["light", "dark"]).optional(),
      country:       z.string().max(8).optional(),
      currency:      z.string().max(8).optional(),
      language:      z.string().max(16).optional(),
      notifications: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Try update first, then insert if not exists
      const existing = await db
        .select({ userId: userPreferences.userId })
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (input.theme         !== undefined) updates.theme         = input.theme;
        if (input.country       !== undefined) updates.country       = input.country;
        if (input.currency      !== undefined) updates.currency      = input.currency;
        if (input.language      !== undefined) updates.language      = input.language;
        if (input.notifications !== undefined) updates.notifications = input.notifications;
        await db.update(userPreferences).set(updates).where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({
          userId:        ctx.user.id,
          theme:         input.theme         ?? "light",
          country:       input.country       ?? null,
          currency:      input.currency      ?? null,
          language:      input.language      ?? "en",
          notifications: input.notifications ?? true,
          updatedAt:     new Date(),
        });
      }

      return { success: true };
    }),
});
