/**
 * db.ts — Drizzle database client (lazy connection)
 *
 * getDb() returns the drizzle client, or null if DATABASE_URL is not set.
 * All DB operations are lazy so the server boots without a DB configured.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── User helpers used by sdk.ts ───────────────────────────────────────────────
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
    }).onDuplicateKeyUpdate({
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
