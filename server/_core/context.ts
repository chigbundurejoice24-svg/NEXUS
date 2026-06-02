/**
 * context.ts — tRPC request context
 *
 * Authentication strategy (Phase 1):
 *   1. Check Authorization header for "Bearer <jwt>"
 *   2. Verify JWT with JWT_SECRET
 *   3. Load the full user record from the DB by id
 *   4. Fallback: try the legacy Manus OAuth cookie (sdk.authenticateRequest)
 *      so the transition period doesn't break existing sessions.
 *
 * ctx.user is null for unauthenticated requests — publicProcedures handle this.
 */

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import type { User } from "../../drizzle/schema";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "aegis-dev-secret-change-in-prod";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function getUserFromJwt(authHeader: string | undefined): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const db = await getDb();
    if (!db) return null;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

async function getUserFromLegacyCookie(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  // Try the legacy Manus OAuth SDK — gracefully skip if env vars are missing
  try {
    if (!process.env.OAUTH_SERVER_URL) return null;
    const { sdk } = await import("./sdk");
    return await sdk.authenticateRequest(req as any);
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // 1. JWT (primary)
  let user = await getUserFromJwt(opts.req.headers.authorization);

  // 2. Legacy cookie (fallback for existing sessions during migration)
  if (!user) {
    user = await getUserFromLegacyCookie(opts.req);
  }

  return { req: opts.req, res: opts.res, user };
}
