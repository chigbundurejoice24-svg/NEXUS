/**
 * support.ts — Customer Care tRPC router
 *
 * Users: create tickets, view own tickets, reply, track status
 * Admins: see all tickets, update status, reply with isAdmin=true
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { supportTickets, supportReplies, notifications, users } from "../../drizzle/schema";
import { eq, desc, and, count } from "drizzle-orm";

async function isAdmin(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.role === "admin";
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
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ticket] = await db.insert(supportTickets).values({
        userId:   ctx.user.id,
        subject:  input.subject,
        message:  input.message,
        priority: input.priority,
      }).returning();

      // Notify all admins (create a notification for admin users)
      await db.insert(notifications).values({
        userId:  null,   // NULL = broadcast — admins will filter
        title:   `New Support Ticket #${ticket.id}`,
        body:    `"${input.subject}" from user #${ctx.user.id}`,
        type:    "SUPPORT",
        actionUrl: `/admin?tab=support&ticket=${ticket.id}`,
        sentByAdmin: null,
      } as any);

      return ticket;
    }),

  // ── User: list own tickets ────────────────────────────────────
  listUserTickets: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(supportTickets)
      .where(eq(supportTickets.userId, ctx.user.id))
      .orderBy(desc(supportTickets.createdAt));
  }),

  // ── User/Admin: get single ticket + replies ───────────────────
  getTicket: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const admin = await isAdmin(ctx.user.id);
      const [ticket] = await db.select().from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (!admin && ticket.userId !== ctx.user.id) throw new TRPCError({ code: "UNAUTHORIZED" });

      const replies = await db.select().from(supportReplies)
        .where(eq(supportReplies.ticketId, input.ticketId))
        .orderBy(desc(supportReplies.createdAt));

      return { ticket, replies };
    }),

  // ── User/Admin: reply to ticket ───────────────────────────────
  addReply: protectedProcedure
    .input(z.object({ ticketId: z.number(), message: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const admin = await isAdmin(ctx.user.id);
      const [ticket] = await db.select().from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (!admin && ticket.userId !== ctx.user.id) throw new TRPCError({ code: "UNAUTHORIZED" });

      await db.insert(supportReplies).values({
        ticketId: input.ticketId,
        userId:   ctx.user.id,
        message:  input.message,
        isAdmin:  admin,
      });

      // Auto-update ticket status to IN_PROGRESS when admin replies
      if (admin && ticket.status === "OPEN") {
        await db.update(supportTickets)
          .set({ status: "IN_PROGRESS", updatedAt: new Date() })
          .where(eq(supportTickets.id, input.ticketId));
      }

      // Notify ticket owner if admin replied
      if (admin && ticket.userId !== ctx.user.id) {
        await db.insert(notifications).values({
          userId:      ticket.userId,
          title:       `Support reply on Ticket #${ticket.id}`,
          body:        `An admin replied to "${ticket.subject}"`,
          type:        "SUPPORT",
          actionUrl:   `/help?ticket=${ticket.id}`,
          sentByAdmin: ctx.user.id,
        } as any);
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
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const admin = await isAdmin(ctx.user.id);
      if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin only" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const q = db.select({
        id:       supportTickets.id,
        userId:   supportTickets.userId,
        subject:  supportTickets.subject,
        status:   supportTickets.status,
        priority: supportTickets.priority,
        createdAt:supportTickets.createdAt,
        userName: users.name,
        userEmail:users.email,
      })
      .from(supportTickets)
      .leftJoin(users, eq(users.id, supportTickets.userId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(input.limit)
      .offset(input.offset);

      return q;
    }),

  // ── Admin: update ticket status ───────────────────────────────
  updateStatus: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      status:   z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const admin = await isAdmin(ctx.user.id);
      if (!admin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin only" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, input.ticketId));
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(supportTickets)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(supportTickets.id, input.ticketId));

      // Notify user of resolution
      if (input.status === "RESOLVED") {
        await db.insert(notifications).values({
          userId:      ticket.userId,
          title:       `Ticket #${ticket.id} Resolved`,
          body:        `Your support request "${ticket.subject}" has been resolved.`,
          type:        "SUPPORT",
          actionUrl:   `/help?ticket=${ticket.id}`,
          sentByAdmin: ctx.user.id,
        } as any);
      }

      return { success: true };
    }),

  // ── Ticket count for badge ─────────────────────────────────────
  openCount: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const admin = await isAdmin(ctx.user.id);

    if (admin) {
      const [row] = await db.select({ c: count() }).from(supportTickets)
        .where(eq(supportTickets.status, "OPEN"));
      return { openCount: row?.c ?? 0 };
    }
    const [row] = await db.select({ c: count() }).from(supportTickets)
      .where(and(eq(supportTickets.userId, ctx.user.id), eq(supportTickets.status, "OPEN")));
    return { openCount: row?.c ?? 0 };
  }),
});
