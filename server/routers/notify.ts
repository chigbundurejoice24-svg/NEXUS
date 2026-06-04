/**
 * notify.ts — Notifications tRPC router
 *
 * Admin broadcasts a message → creates one notification per user (or a global one)
 * Users fetch their unread count + notification list
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { notifications, users } from "../../drizzle/schema";
import { eq, desc, or, isNull, and, count } from "drizzle-orm";

async function isAdmin(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.role === "admin";
}

export const notifyRouter = router({
  // ── Get my notifications (personal + broadcast) ───────────────
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(30) }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Return notifications addressed to this user OR broadcast (userId = NULL)
      return db.select().from(notifications)
        .where(or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit);
    }),

  // ── Unread count (for bell badge) ─────────────────────────────
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [row] = await db.select({ c: count() }).from(notifications)
      .where(and(
        or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)),
        eq(notifications.isRead, false)
      ));
    return { count: row?.c ?? 0 };
  }),

  // ── Mark notification(s) as read ──────────────────────────────
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Only mark notifications that belong to this user or are broadcasts
      for (const id of input.ids) {
        await db.update(notifications)
          .set({ isRead: true })
          .where(and(
            eq(notifications.id, id),
            or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId))
          ));
      }
      return { success: true };
    }),

  // ── Mark ALL as read ──────────────────────────────────────────
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // For broadcasts: mark them read by inserting a "read receipt" is complex — 
    // Instead we track per-user: update notifications for this user
    await db.update(notifications)
      .set({ isRead: true })
      .where(or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)));

    return { success: true };
  }),

  // ── Admin: broadcast to ALL users ─────────────────────────────
  broadcast: protectedProcedure
    .input(z.object({
      title:     z.string().min(3).max(255),
      body:      z.string().min(5),
      type:      z.enum(["SYSTEM","BROADCAST","PROMO"]).default("BROADCAST"),
      actionUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const admin = await isAdmin(ctx.user.id);
      if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin only" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Insert as userId=NULL (global broadcast — all users see it)
      await db.insert(notifications).values({
        userId:      null,
        title:       input.title,
        body:        input.body,
        type:        input.type,
        actionUrl:   input.actionUrl ?? null,
        sentByAdmin: ctx.user.id,
      } as any);

      return { success: true };
    }),

  // ── Admin: send to a specific user ───────────────────────────
  sendToUser: protectedProcedure
    .input(z.object({
      userId:    z.number(),
      title:     z.string().min(3).max(255),
      body:      z.string().min(5),
      type:      z.enum(["SYSTEM","BROADCAST","TRANSACTION","SUPPORT","PROMO"]).default("SYSTEM"),
      actionUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const admin = await isAdmin(ctx.user.id);
      if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin only" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(notifications).values({
        userId:      input.userId,
        title:       input.title,
        body:        input.body,
        type:        input.type,
        actionUrl:   input.actionUrl ?? null,
        sentByAdmin: ctx.user.id,
      } as any);

      return { success: true };
    }),
});
