/**
 * admin.ts — tRPC admin router
 *
 * SECURITY: Uses adminProcedure — email whitelist OR DB role="admin".
 * DB role is only set by existing admins (setRole mutation).
 */
import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, transactions, accountAuditLogs, linkedWallets, notifications } from "../../drizzle/schema";
import { eq, desc, count, sql, and, ne, isNull, ilike, or } from "drizzle-orm";

export const adminRouter = router({

  // ── Platform stats ────────────────────────────────────────────────
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [[userRow], [txRow], [pendingKyc], [activeToday]] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(transactions),
      db.select({ count: count() }).from(users).where(eq(users.kycStatus, "PENDING")),
      db.select({ count: count() }).from(users)
        .where(sql`last_signed_in >= NOW() - INTERVAL '24 hours'`),
    ]);

    const [volume] = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(amount_raw AS DECIMAL(65,0))), 0)` })
      .from(transactions)
      .where(eq(transactions.state, "SETTLED"));

    return {
      totalUsers:        userRow?.count   ?? 0,
      totalTransactions: txRow?.count     ?? 0,
      pendingKyc:        pendingKyc?.count ?? 0,
      activeToday:       activeToday?.count ?? 0,
      settledVolume:     volume?.total    ?? "0",
    };
  }),

  // ── User list ─────────────────────────────────────────────────────
  listUsers: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select({
        id:           users.id,
        name:         users.name,
        email:        users.email,
        role:         users.role,
        kycStatus:    users.kycStatus,
        emailVerified: users.emailVerified,
        lastSignedIn: users.lastSignedIn,
        createdAt:    users.createdAt,
      })
        .from(users)
        .orderBy(desc(users.id))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ── Single user detail (wallets + tx count) ───────────────────────
  getUserDetail: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const [wallets, txCount, auditLogs] = await Promise.all([
        db.select().from(linkedWallets).where(eq(linkedWallets.userId, input.userId)),
        db.select({ count: count() }).from(transactions).where(eq(transactions.userId, input.userId)),
        db.select().from(accountAuditLogs)
          .where(eq(accountAuditLogs.userId, input.userId))
          .orderBy(desc((accountAuditLogs as any).createdAt))
          .limit(20),
      ]);

      return {
        user,
        wallets,
        txCount: txCount[0]?.count ?? 0,
        auditLogs,
      };
    }),

  // ── User transactions ─────────────────────────────────────────────
  getUserTransactions: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select()
        .from(transactions)
        .where(eq(transactions.userId, input.userId))
        .orderBy(desc(transactions.createdAt));
    }),

  // ── All transactions ──────────────────────────────────────────────
  listTransactions: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select()
        .from(transactions)
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // ── Flag user (audit log) ─────────────────────────────────────────
  flagUser: adminProcedure
    .input(z.object({ userId: z.number(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(accountAuditLogs).values({
        userId:  input.userId,
        action:  "USER_FLAGGED",
        details: { reason: input.reason, flaggedBy: ctx.user.id },
      });
      return { success: true };
    }),

  // ── Suspend user (kycStatus = SUSPENDED, role stays unchanged) ────
  suspendUser: adminProcedure
    .input(z.object({ userId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users)
        .set({ suspended: true })
        .where(eq(users.id, input.userId));
      await db.insert(accountAuditLogs).values({
        userId:  input.userId,
        action:  "USER_SUSPENDED",
        details: { reason: input.reason ?? "Admin action", suspendedBy: ctx.user.id },
      });
      return { success: true };
    }),

  // ── Unsuspend user ────────────────────────────────────────────────
  unsuspendUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users)
        .set({ suspended: false })
        .where(eq(users.id, input.userId));
      await db.insert(accountAuditLogs).values({
        userId:  input.userId,
        action:  "USER_UNSUSPENDED",
        details: { restoredBy: ctx.user.id },
      });
      return { success: true };
    }),

  // ── Approve KYC ───────────────────────────────────────────────────
  approveKyc: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users)
        .set({ kycStatus: "VERIFIED" })
        .where(eq(users.id, input.userId));
      await db.insert(accountAuditLogs).values({
        userId:  input.userId,
        action:  "KYC_APPROVED",
        details: { approvedBy: ctx.user.id },
      });
      return { success: true };
    }),

  // ── Reject KYC ────────────────────────────────────────────────────
  rejectKyc: adminProcedure
    .input(z.object({ userId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users)
        .set({ kycStatus: "REJECTED" })
        .where(eq(users.id, input.userId));
      await db.insert(accountAuditLogs).values({
        userId:  input.userId,
        action:  "KYC_REJECTED",
        details: { reason: input.reason ?? "Admin review", rejectedBy: ctx.user.id },
      });
      return { success: true };
    }),

  // ── Set role (promote / demote admin) ─────────────────────────────
  setRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));
      await db.insert(accountAuditLogs).values({
        userId:  input.userId,
        action:  "ROLE_CHANGED",
        details: { newRole: input.role, changedBy: ctx.user.id },
      });
      return { success: true };
    }),

  // ── Broadcast history ─────────────────────────────────────────────
  broadcastHistory: adminProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select()
        .from(notifications)
        .where(isNull(notifications.userId)) // broadcasts only
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit);
    }),

  // ── Search users ─────────────────────────────────────────────────
  searchUsers: adminProcedure
    .input(z.object({ q: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select({
        id: users.id, name: users.name, email: users.email,
        role: users.role, kycStatus: users.kycStatus, suspended: users.suspended,
      })
        .from(users)
        .where(or(
          ilike(users.name,  `%${input.q}%`),
          ilike(users.email, `%${input.q}%`),
        ))
        .limit(20);
    }),

});
