/**
 * notify.ts — Notifications tRPC router
 * Uses columns that actually exist in the DB:
 *   id, user_id, title, body, type (varchar), is_read, created_at
 * Does NOT reference: action_url, sent_by_admin (add those via migration first)
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { eq, desc, or, isNull, and, count, sql } from "drizzle-orm";

export const notifyRouter = router({
  // ── Get my notifications (personal + broadcasts) ──────────────
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db
          .select({
            id:        notifications.id,
            userId:    notifications.userId,
            title:     notifications.title,
            body:      notifications.body,
            type:      notifications.type,
            isRead:    notifications.isRead,
            createdAt: notifications.createdAt,
          })
          .from(notifications)
          .where(or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)))
          .orderBy(desc(notifications.createdAt))
          .limit(input.limit);
      } catch (e) {
        console.error("[notify.list]", e);
        return [];
      }
    }),

  // ── Unread badge count ─────────────────────────────────────────
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    try {
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
    } catch { return { count: 0 }; }
  }),

  // ── Mark specific notifications read ──────────────────────────
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int()) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      try {
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
      } catch { return { success: false }; }
    }),

  // ── Mark ALL notifications read ────────────────────────────────
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)));
      return { success: true };
    } catch { return { success: false }; }
  }),

  // ── Admin: broadcast to ALL users (userId = NULL) ─────────────
  broadcast: adminProcedure
    .input(z.object({
      title: z.string().min(3).max(255),
      body:  z.string().min(5),
      type:  z.enum(["SYSTEM", "BROADCAST", "PROMO"]).default("BROADCAST"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try {
        // Use raw SQL to avoid ORM column mapping issues
        await db.execute(
          sql`INSERT INTO notifications (user_id, title, body, type, is_read, created_at)
              VALUES (NULL, ${input.title}, ${input.body}, ${input.type}, false, NOW())`
        );
        return { success: true };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e?.message });
      }
    }),

  // ── Admin: send to a specific user ────────────────────────────
  sendToUser: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      title:  z.string().min(3).max(255),
      body:   z.string().min(5),
      type:   z.enum(["SYSTEM", "BROADCAST", "TRANSACTION", "SUPPORT", "PROMO"]).default("SYSTEM"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      try {
        await db.execute(
          sql`INSERT INTO notifications (user_id, title, body, type, is_read, created_at)
              VALUES (${input.userId}, ${input.title}, ${input.body}, ${input.type}, false, NOW())`
        );
        return { success: true };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e?.message });
      }
    }),
});
