/**
 * admin.ts — tRPC admin router
 *
 * SECURITY: Uses adminProcedure from trpc.ts — email whitelist only.
 * DB role cannot grant admin access. No privilege escalation possible.
 */
import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, transactions, accountAuditLogs } from "../../drizzle/schema";
import { eq, desc, count, sql } from "drizzle-orm";

export const adminRouter = router({

  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [[userRow], [txRow]] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(transactions),
    ]);
    const [volume] = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(amount_raw AS DECIMAL(65,0))), 0)` })
      .from(transactions)
      .where(eq(transactions.state, "SETTLED"));
    return {
      totalUsers:        userRow?.count ?? 0,
      totalTransactions: txRow?.count   ?? 0,
      settledVolume:     volume?.total  ?? "0",
    };
  }),

  listUsers: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select({
        id:          users.id,
        name:        users.name,
        email:       users.email,
        role:        users.role,
        kycStatus:   users.kycStatus,
        lastSignedIn: users.lastSignedIn,
      }).from(users).orderBy(desc(users.id)).limit(input.limit).offset(input.offset);
    }),

  getUserTransactions: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(transactions)
        .where(eq(transactions.userId, input.userId))
        .orderBy(desc(transactions.createdAt));
    }),

  listTransactions: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(transactions)
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

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

  setRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
