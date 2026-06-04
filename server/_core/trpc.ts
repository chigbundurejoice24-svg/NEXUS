import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const UNAUTHED_ERR_MSG = "You must be logged in to access this resource.";
const NOT_ADMIN_ERR_MSG = "You do not have permission to perform this action.";

// ── ADMIN IDENTITY — three layers, all checked ───────────────────────────────
// Layer 1: ADMIN_EMAILS env var (comma-separated) — production accounts by email
// Layer 2: Hardcoded fallback (only used when ADMIN_EMAILS env is NOT set)
// Layer 3: DB role = "admin" (set via admin.setRole mutation)
//
// All three are OR'd — any one passing grants access.
// To add a new admin: set ADMIN_EMAILS env on Vercel (preferred) OR call setRole.

function buildAdminEmailSet(): Set<string> {
  const env = process.env.ADMIN_EMAILS;
  if (env && env.trim()) {
    const parsed = env.split(",").map(e => e.toLowerCase().trim()).filter(Boolean);
    if (parsed.length > 0) return new Set(parsed);
  }
  // Hard-coded fallback — only used in dev / when env var is missing
  return new Set([
    "info@cozanet.net",
    "fassdavid722@gmail.com",
  ]);
}

const ADMIN_EMAIL_SET = buildAdminEmailSet();

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

// ── adminProcedure: 3-layer check, fresh DB read every request ────────────────
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    const db = await getDb();
    let isAdmin = false;

    if (db) {
      try {
        const [row] = await db
          .select({ email: users.email, role: users.role })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        if (row) {
          // Layer 1: email whitelist
          const emailMatch = !!row.email && ADMIN_EMAIL_SET.has(row.email.toLowerCase().trim());
          // Layer 2: DB role (set via admin.setRole)
          const roleMatch = row.role === "admin";
          isAdmin = emailMatch || roleMatch;
        }
      } catch (err) {
        console.error("[adminProcedure] DB check failed:", err);
        // fail closed — no access on DB error
      }
    }

    if (!isAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

// ── Helper exported for accounts.me and other places ─────────────────────────
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAIL_SET.has(email.toLowerCase().trim());
}
