/**
 * notify.ts — Notifications tRPC router
 * Rebuilt with adminProcedure (uses built-in email whitelist check from trpc.ts)
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { eq, desc, or, isNull, and, count } from "drizzle-orm";

export const notifyRouter = router({
  // ── Get my notifications ─────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(notifications)
        .where(or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit);
    }),

  // ── Unread badge count ────────────────────────────────────────
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    const [row] = await db
      .select({ c: count() })
      .from(notifications)
      .where(
        and(
          or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)),
          eq(notifications.isRead, false)
        )
      );
    return { count: Number(row?.c ?? 0) };
  }),

  // ── Mark specific notifications read ─────────────────────────
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int()) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      for (const id of input.ids) {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(
            and(
              eq(notifications.id, id),
              or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId))
            )
          );
      }
      return { success: true };
    }),

  // ── Mark ALL notifications read ───────────────────────────────
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)));
    return { success: true };
  }),

  // ── Admin: broadcast to ALL users (NULL userId = global) ─────
  broadcast: adminProcedure
    .input(z.object({
      title:     z.string().min(3).max(255),
      body:      z.string().min(5),
      type:      z.enum(["SYSTEM", "BROADCAST", "PROMO"]).default("BROADCAST"),
      actionUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(notifications).values({
        userId:      null,
        title:       input.title,
        body:        input.body,
        type:        input.type,
        actionUrl:   input.actionUrl ?? null,
        sentByAdmin: ctx.user.id,
      });
      return { success: true };
    }),

  // ── Admin: send to a specific user ────────────────────────────
  sendToUser: adminProcedure
    .input(z.object({
      userId:    z.number().int().positive(),
      title:     z.string().min(3).max(255),
      body:      z.string().min(5),
      type:      z.enum(["SYSTEM", "BROADCAST", "TRANSACTION", "SUPPORT", "PROMO"]).default("SYSTEM"),
      actionUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(notifications).values({
        userId:      input.userId,
        title:       input.title,
        body:        input.body,
        type:        input.type,
        actionUrl:   input.actionUrl ?? null,
        sentByAdmin: ctx.user.id,
      });
      return { success: true };
    }),
});

