/**
 * db.ts — Drizzle database client (Neon serverless PostgreSQL)
 *
 * getDb() returns the drizzle client, or null if DATABASE_URL is not set.
 * Uses @neondatabase/serverless for edge-compatible HTTP connections.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      _db = drizzle(sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── User helpers ──────────────────────────────────────────────────────────────
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

export async function upsertUser(params: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
}) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const role = params.role ?? (params.openId === ENV.ownerOpenId ? "admin" : "user");

  try {
    await db.insert(users).values({
      openId:       params.openId,
      name:         params.name ?? null,
      email:        params.email ?? null,
      loginMethod:  params.loginMethod ?? null,
      role,
      lastSignedIn: params.lastSignedIn ?? new Date(),
    }).onConflictDoUpdate({
      target: users.openId,
      set: {
        name:         params.name ?? undefined,
        email:        params.email ?? undefined,
        lastSignedIn: params.lastSignedIn ?? new Date(),
      },
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
