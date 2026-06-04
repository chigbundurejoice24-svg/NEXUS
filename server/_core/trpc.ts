import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const UNAUTHED_ERR_MSG = "You must be logged in to access this resource.";
const NOT_ADMIN_ERR_MSG = "You do not have permission to perform this action.";

// ── ADMIN EMAILS — single source of truth ────────────────────────────────────
// Reads from ADMIN_EMAILS env var (comma-separated) in production.
// Falls back to the hardcoded set for local dev and CI.
// To add an admin: set ADMIN_EMAILS="info@cozanet.net,new@email.com" on Vercel.
function buildAdminSet(): Set<string> {
  const env = process.env.ADMIN_EMAILS;
  if (env) {
    return new Set(env.split(",").map(e => e.toLowerCase().trim()).filter(Boolean));
  }
  // Hard-coded fallback — these two accounts always have admin access
  return new Set([
    "info@cozanet.net",
    "fassdavid722@gmail.com",
  ]);
}

const ADMIN_EMAILS = buildAdminSet();

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

// ── adminProcedure: verified against email whitelist, not DB role ─────────────
// Even if someone sets role="admin" in the DB, this check will STILL
// reject them unless their email is in ADMIN_EMAILS above.
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Fetch email from DB fresh on every admin request — not from JWT
    const db = await getDb();
    let isAdmin = false;
    if (db) {
      try {
        const [row] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        isAdmin = !!row?.email && ADMIN_EMAILS.has(row.email.toLowerCase().trim());
      } catch { /* non-fatal — fail closed */ }
    }

    if (!isAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);
