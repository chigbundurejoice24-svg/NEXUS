/**
 * support.ts — Customer Care tRPC router
 * Fixed: notification inserts use raw SQL (avoids non-existent columns)
 * Fixed: isAdmin uses email whitelist (consistent with trpc.ts)
 * Fixed: added listMyTickets alias for frontend compatibility
 */
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { supportTickets, supportReplies, users } from "../../drizzle/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "info@cozanet.net,fassdavid722@gmail.com")
    .split(",").map(e => e.toLowerCase().trim()).filter(Boolean)
);

async function checkIsAdmin(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return !!u?.email && ADMIN_EMAILS.has(u.email.toLowerCase().trim());
}

// Safe notification insert — only touches columns that exist in the DB
async function insertNotification(db: any, userId: number | null, title: string, body: string, type: string) {
  try {
    await db.execute(
      sql`INSERT INTO notifications (user_id, title, body, type, is_read, created_at)
          VALUES (${userId}, ${title}, ${body}, ${type}, false, NOW())`
    );
  } catch (e) {
    // Non-fatal — ticket still created
    console.error("[support] notification insert failed:", e);
  }
}

export const supportRouter = router({
  // ── User: create a ticket ─────────────────────────────────────
  createTicket: protectedProcedure
    .input(z.object({
      subject:  z.string().min(5).max(255),
      message:  z.string().min(10),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ticket] = await db.insert(supportTickets).values({
        userId:   ctx.user.id,
        subject:  input.subject,
        message:  input.message,
        priority: input.priority,
      }).returning();

      // Notify support team (broadcast notification — admins see it)
      await insertNotification(db, null,
        `New Support Ticket #${ticket.id}`,
        `"${input.subject}" submitted`,
        "SUPPORT"
      );

      return ticket;
    }),

  // ── User: list own tickets ────────────────────────────────────
  listMyTickets: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(supportTickets)
        .where(eq(supportTickets.userId, ctx.user.id))
        .orderBy(desc(supportTickets.createdAt))
        .limit(input.limit).offset(input.offset);
    }),

  // Keep old name for any legacy callers
  listUserTickets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(supportTickets)
      .where(eq(supportTickets.userId, ctx.user.id))
      .orderBy(desc(supportTickets.createdAt));
  }),

  // ── User/Admin: get single ticket + replies ───────────────────
  getTicket: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const admin = await checkIsAdmin(ctx.user.id);
      const [ticket] = await db.select().from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (!admin && ticket.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const replies = await db.select().from(supportReplies)
        .where(eq(supportReplies.ticketId, input.ticketId))
        .orderBy(desc(supportReplies.createdAt));

      return { ticket, replies };
    }),

  // ── User/Admin: add reply ─────────────────────────────────────
  addReply: protectedProcedure
    .input(z.object({ ticketId: z.number(), message: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const admin = await checkIsAdmin(ctx.user.id);
      const [ticket] = await db.select().from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (!admin && ticket.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      await db.insert(supportReplies).values({
        ticketId: input.ticketId,
        userId:   ctx.user.id,
        message:  input.message,
        isAdmin:  admin,
      });

      // Auto-update status when admin first replies
      if (admin && ticket.status === "OPEN") {
        await db.update(supportTickets)
          .set({ status: "IN_PROGRESS", updatedAt: new Date() })
          .where(eq(supportTickets.id, input.ticketId));
      }

      // Notify ticket owner when admin replies
      if (admin && ticket.userId !== ctx.user.id) {
        await insertNotification(db, ticket.userId,
          `Reply on Ticket #${ticket.id}`,
          `Aegis Support replied to your request: "${ticket.subject}"`,
          "SUPPORT"
        );
      }

      return { success: true };
    }),

  // ── Admin: list ALL tickets ───────────────────────────────────
  listAllTickets: protectedProcedure
    .input(z.object({
      limit:  z.number().default(50),
      offset: z.number().default(0),
      status: z.enum(["OPEN","IN_PROGRESS","RESOLVED","CLOSED","ALL"]).default("ALL"),
    }))
    .query(async ({ input, ctx }) => {
      const admin = await checkIsAdmin(ctx.user.id);
      if (!admin) throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });

      const db = await getDb();
      if (!db) return [];

      return db.select({
        id:        supportTickets.id,
        userId:    supportTickets.userId,
        subject:   supportTickets.subject,
        status:    supportTickets.status,
        priority:  supportTickets.priority,
        createdAt: supportTickets.createdAt,
        userName:  users.name,
        userEmail: users.email,
      })
      .from(supportTickets)
      .leftJoin(users, eq(users.id, supportTickets.userId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(input.limit).offset(input.offset);
    }),

  // ── Admin: update ticket status ───────────────────────────────
  updateStatus: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      status:   z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const admin = await checkIsAdmin(ctx.user.id);
      if (!admin) throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ticket] = await db.select().from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(supportTickets)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(supportTickets.id, input.ticketId));

      // Notify user on resolution
      if (input.status === "RESOLVED" || input.status === "CLOSED") {
        await insertNotification(db, ticket.userId,
          `Ticket #${ticket.id} ${input.status === "RESOLVED" ? "Resolved" : "Closed"}`,
          `Your support request "${ticket.subject}" has been ${input.status.toLowerCase()}.`,
          "SUPPORT"
        );
      }

      return { success: true };
    }),

  // ── Open ticket count (badge) ─────────────────────────────────
  openCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { openCount: 0 };
    const admin = await checkIsAdmin(ctx.user.id);

    if (admin) {
      const [row] = await db.select({ c: count() }).from(supportTickets)
        .where(eq(supportTickets.status, "OPEN"));
      return { openCount: Number(row?.c ?? 0) };
    }
    const [row] = await db.select({ c: count() }).from(supportTickets)
      .where(and(eq(supportTickets.userId, ctx.user.id), eq(supportTickets.status, "OPEN")));
    return { openCount: Number(row?.c ?? 0) };
  }),
});
