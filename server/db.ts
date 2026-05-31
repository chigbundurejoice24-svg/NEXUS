import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, userWallets, type UserWallet } from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ------------------------------------------------------------------
// Wallet Management Queries
// ------------------------------------------------------------------

export async function addUserWallet(userId: number, address: string, label?: string): Promise<UserWallet> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Normalize address to lowercase
  const normalizedAddress = address.toLowerCase();

  await db.insert(userWallets).values({
    userId,
    address: normalizedAddress,
    label: label || null,
    isActive: 'true',
  });

  // Return the inserted wallet by querying the most recent entry
  const inserted = await db
    .select()
    .from(userWallets)
    .where(eq(userWallets.userId, userId))
    .orderBy(userWallets.createdAt)
    .limit(1);

  if (!inserted.length) {
    throw new Error("Failed to retrieve inserted wallet");
  }

  return inserted[0];
}

export async function getUserWallets(userId: number): Promise<UserWallet[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get wallets: database not available");
    return [];
  }

  return db
    .select()
    .from(userWallets)
    .where(eq(userWallets.userId, userId));
}

export async function removeUserWallet(walletId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Ensure user owns this wallet
  const wallet = await db
    .select()
    .from(userWallets)
    .where(eq(userWallets.id, walletId))
    .limit(1);

  if (!wallet.length || wallet[0].userId !== userId) {
    throw new Error("Wallet not found or unauthorized");
  }

  await db.delete(userWallets).where(eq(userWallets.id, walletId));
  return true;
}

export async function updateWalletLabel(walletId: number, userId: number, label: string): Promise<UserWallet> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Ensure user owns this wallet
  const wallet = await db
    .select()
    .from(userWallets)
    .where(eq(userWallets.id, walletId))
    .limit(1);

  if (!wallet.length || wallet[0].userId !== userId) {
    throw new Error("Wallet not found or unauthorized");
  }

  await db.update(userWallets).set({ label }).where(eq(userWallets.id, walletId));

  const updated = await db
    .select()
    .from(userWallets)
    .where(eq(userWallets.id, walletId))
    .limit(1);

  return updated[0];
}
