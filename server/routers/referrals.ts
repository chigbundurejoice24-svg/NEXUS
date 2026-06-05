/**
 * referrals.ts — Referral program tRPC router
 *
 * Each user gets a unique 8-char code at first request.
 * When a new user signs up with a referral code, a referrals record is created.
 * Monthly payout cron reads reward_paid=false and credits referrers.
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { referralCodes, referrals, users } from "../../drizzle/schema";
import { eq, count } from "drizzle-orm";
import crypto from "crypto";

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. A3F7B2C1
}

export const referralsRouter = router({
  // ── Get or create my referral code ─────────────────────────────
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [existing] = await db.select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, ctx.user.id))
      .limit(1);

    if (existing) return { code: existing.code, usedCount: existing.usedCount };

    // Create new code for this user
    let code = generateCode();
    // Retry on collision (astronomically unlikely but safe)
    for (let i = 0; i < 5; i++) {
      try {
        await db.insert(referralCodes).values({ userId: ctx.user.id, code });
        break;
      } catch {
        code = generateCode();
      }
    }
    return { code, usedCount: 0 };
  }),

  // ── My referral stats ───────────────────────────────────────────
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [myCode] = await db.select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, ctx.user.id))
      .limit(1);

    if (!myCode) return { code: null, totalReferrals: 0, pendingRewards: 0, paidRewards: 0 };

    const allReferrals = await db.select()
      .from(referrals)
      .where(eq(referrals.referrerId, ctx.user.id));

    const pendingRewards = allReferrals.filter(r => !r.rewardPaid).length;
    const paidRewards    = allReferrals.filter(r => r.rewardPaid).length;

    return {
      code:           myCode.code,
      totalReferrals: allReferrals.length,
      pendingRewards,
      paidRewards,
    };
  }),

  // ── Apply a referral code (called during/after registration) ───
  applyCode: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(16) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check code exists
      const [codeRow] = await db.select()
        .from(referralCodes)
        .where(eq(referralCodes.code, input.code.toUpperCase()))
        .limit(1);

      if (!codeRow) throw new TRPCError({ code: "NOT_FOUND", message: "Referral code not found" });
      if (codeRow.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You can't use your own referral code" });

      // Check user hasn't already been referred
      const [existingReferral] = await db.select()
        .from(referrals)
        .where(eq(referrals.refereeId, ctx.user.id))
        .limit(1);

      if (existingReferral) throw new TRPCError({ code: "CONFLICT", message: "A referral code has already been applied to your account" });

      // Create referral record
      await db.insert(referrals).values({
        referrerId: codeRow.userId,
        refereeId:  ctx.user.id,
        code:       input.code.toUpperCase(),
      });

      // Increment used count
      await db.update(referralCodes)
        .set({ usedCount: codeRow.usedCount + 1 })
        .where(eq(referralCodes.userId, codeRow.userId));

      return { success: true, referrerId: codeRow.userId };
    }),
});
