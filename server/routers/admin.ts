/**
 * admin.ts — tRPC admin router
 * assertAdmin checks email whitelist — DB role cannot grant admin access.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, transactions, accountAuditLogs } from "../../drizzle/schema";
import { eq, desc, count, sql } from "drizzle-orm";

const ADMIN_EMAILS = new Set(["info@cozanet.net", "fassdavid722@gmail.com"]);

async function assertAdmin(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const email = u?.email?.toLowerCase().trim() ?? "";
  if (!ADMIN_EMAILS.has(email)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
}

export const adminRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.user!.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [[userRow], [txRow]] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(transactions),
    ]);
    const [volume] = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(amount_raw AS DECIMAL(65,0))), 0)` })
      .from(transactions).where(eq(transactions.state, "SETTLED"));
    return {
      totalUsers:        userRow?.count ?? 0,
      totalTransactions: txRow?.count  ?? 0,
      settledVolume:     volume?.total  ?? "0",
    };
  }),

  listUsers: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user!.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select({
        id: users.id, name: users.name, email: users.email,
        role: users.role, kycStatus: users.kycStatus, lastSignedIn: users.lastSignedIn,
      }).from(users).orderBy(desc(users.id)).limit(input.limit).offset(input.offset);
    }),

  getUserTransactions: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user!.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(transactions)
        .where(eq(transactions.userId, input.userId))
        .orderBy(desc(transactions.createdAt));
    }),

  listTransactions: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user!.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(transactions)
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit).offset(input.offset);
    }),

  flagUser: protectedProcedure
    .input(z.object({ userId: z.number(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user!.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(accountAuditLogs).values({
        userId: input.userId, action: "USER_FLAGGED",
        details: { reason: input.reason, flaggedBy: ctx.user!.id },
      });
      return { success: true };
    }),

  setRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user","admin"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user!.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
