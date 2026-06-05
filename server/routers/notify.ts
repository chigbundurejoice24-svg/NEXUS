/**
 * notify.ts — Notifications tRPC router
 *
 * sendToUser now accepts EITHER:
 *   - userId (numeric DB id) — for internal lookups
 *   - aegisId (AEG-XXXXXXXX string) — human-friendly, permanent
 *
 * Schema: id, user_id, title, body, type, is_read, created_at
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { notifications, users } from "../../drizzle/schema";
import { eq, desc, or, isNull, and, count, sql } from "drizzle-orm";

// ── resolve: userId number | aegisId string → DB user id ─────────────────────
async function resolveRecipient(input: { userId?: number; aegisId?: string }): Promise<number> {
  if (!input.userId && !input.aegisId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Provide userId or aegisId" });
  }
  if (input.userId) return input.userId;

  // look up by aegisId
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.aegisId, input.aegisId!.toUpperCase().trim()))
    .limit(1);

  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `No user found with Aegis ID ${input.aegisId}` });
  return row.id;
}

export const notifyRouter = router({

  // ── My notifications (personal + broadcasts) ──────────────────────────────
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
      } catch { return []; }
    }),

  // ── Unread count ──────────────────────────────────────────────────────────
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    const [row] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(
        or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId)),
        eq(notifications.isRead, false)
      ));
    return { count: row?.count ?? 0 };
  }),

  // ── Mark read ─────────────────────────────────────────────────────────────
  markRead: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        sql`UPDATE notifications SET is_read = true WHERE id = ${input.id}
            AND (user_id = ${ctx.user.id} OR user_id IS NULL)`
      );
      return { success: true };
    }),

  // ── Mark all read ─────────────────────────────────────────────────────────
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.execute(
      sql`UPDATE notifications SET is_read = true
          WHERE (user_id = ${ctx.user.id} OR user_id IS NULL) AND is_read = false`
    );
    return { success: true };
  }),

  // ── ADMIN: Broadcast to all users ─────────────────────────────────────────
  broadcast: adminProcedure
    .input(z.object({
      title: z.string().min(3).max(255),
      body:  z.string().min(5),
      type:  z.enum(["SYSTEM", "BROADCAST", "TRANSACTION", "SUPPORT", "PROMO"]).default("BROADCAST"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        sql`INSERT INTO notifications (user_id, title, body, type, is_read, created_at)
            VALUES (NULL, ${input.title}, ${input.body}, ${input.type}, false, NOW())`
      );
      return { success: true };
    }),

  // ── ADMIN: Send to specific user — accepts userId OR aegisId ─────────────
  sendToUser: adminProcedure
    .input(z.object({
      userId:  z.number().int().positive().optional(),
      aegisId: z.string().regex(/^AEG-[A-Z0-9]{8}$/, "Format: AEG-XXXXXXXX").optional(),
      title:   z.string().min(3).max(255),
      body:    z.string().min(5),
      type:    z.enum(["SYSTEM", "BROADCAST", "TRANSACTION", "SUPPORT", "PROMO"]).default("SYSTEM"),
    }))
    .mutation(async ({ input }) => {
      const targetId = await resolveRecipient({ userId: input.userId, aegisId: input.aegisId });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(
        sql`INSERT INTO notifications (user_id, title, body, type, is_read, created_at)
            VALUES (${targetId}, ${input.title}, ${input.body}, ${input.type}, false, NOW())`
      );
      return { success: true, deliveredTo: targetId };
    }),

  // ── ADMIN: Look up user by aegisId before sending ─────────────────────────
  lookupByAegisId: adminProcedure
    .input(z.object({ aegisId: z.string().min(4) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select({
          id:        users.id,
          name:      users.name,
          email:     users.email,
          aegisId:   users.aegisId,
          kycStatus: users.kycStatus,
        })
        .from(users)
        .where(eq(users.aegisId, input.aegisId.toUpperCase().trim()))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "No user with that Aegis ID" });
      return row;
    }),
});
