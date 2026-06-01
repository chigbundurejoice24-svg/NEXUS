/**
 * AccountService
 * Handles user creation, passkey metadata, wallet linking (with sig verify),
 * business management (with role enforcement), recovery setup, and audit logging.
 *
 * Written for Drizzle ORM + MySQL — no Prisma dependency.
 */

import { eq, and } from "drizzle-orm";
import { isAddress, verifyMessage } from "viem";
import { getDb } from "../../db";
import {
  users,
  linkedWallets,
  businesses,
  businessMembers,
  businessWallets,
  accountAuditLogs,
  type LinkedWallet,
  type Business,
  type BusinessWallet,
} from "../../../drizzle/schema";

// ─────────────────────────────────────────────
// Internal audit helper
// ─────────────────────────────────────────────
async function audit(userId: number, action: string, details?: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.insert(accountAuditLogs).values({
    userId,
    action,
    details: details ?? {},
  });
}

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

export async function createUser(params: {
  email?: string;
  phone?: string;
  credentialId?: string;
  publicKey?: string;
  openId: string;
  name?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(users).values({
    openId: params.openId,
    email: params.email,
    phone: params.phone,
    credentialId: params.credentialId,
    publicKey: params.publicKey,
    name: params.name,
    counter: 0,
    kycStatus: "NONE",
    lastSignedIn: new Date(),
  });

  const [user] = await db.select().from(users).where(eq(users.openId, params.openId)).limit(1);
  await audit(user.id, "USER_CREATED");
  return user;
}

export async function getUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export async function updatePasskeyCounter(userId: number, newCounter: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ counter: newCounter }).where(eq(users.id, userId));
  await audit(userId, "PASSKEY_COUNTER_UPDATED", { newCounter });
}

// ─────────────────────────────────────────────
// WALLET LINKING
// ─────────────────────────────────────────────

export async function linkWallet(params: {
  userId: number;
  address: string;
  chainId: number;
  type: "EMBEDDED" | "EXTERNAL";
  label?: string;
  /** Required for EXTERNAL wallets — proves ownership */
  signature?: string;
  signedMessage?: string;
}): Promise<LinkedWallet> {
  if (!isAddress(params.address)) throw new Error("Invalid wallet address");

  // External wallets must prove ownership via a signed message
  if (params.type === "EXTERNAL") {
    if (!params.signature || !params.signedMessage) {
      throw new Error("Signature and signedMessage required to link external wallet");
    }
    const valid = await verifyMessage({
      address: params.address as `0x${string}`,
      message: params.signedMessage,
      signature: params.signature as `0x${string}`,
    });
    if (!valid) throw new Error("Signature verification failed — you do not control this wallet");
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check for duplicate (same user, address, chainId)
  const existing = await db
    .select()
    .from(linkedWallets)
    .where(
      and(
        eq(linkedWallets.userId, params.userId),
        eq(linkedWallets.address, params.address.toLowerCase()),
        eq(linkedWallets.chainId, params.chainId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Wallet already linked for this chain");
  }

  await db.insert(linkedWallets).values({
    userId: params.userId,
    address: params.address.toLowerCase(),
    chainId: params.chainId,
    type: params.type,
    label: params.label,
  });

  const [wallet] = await db
    .select()
    .from(linkedWallets)
    .where(
      and(
        eq(linkedWallets.userId, params.userId),
        eq(linkedWallets.address, params.address.toLowerCase()),
        eq(linkedWallets.chainId, params.chainId)
      )
    )
    .limit(1);

  await audit(params.userId, "WALLET_LINKED", {
    address: params.address,
    chainId: params.chainId,
    type: params.type,
  });

  return wallet;
}

export async function removeWallet(userId: number, walletId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [wallet] = await db
    .select()
    .from(linkedWallets)
    .where(and(eq(linkedWallets.id, walletId), eq(linkedWallets.userId, userId)))
    .limit(1);

  if (!wallet) throw new Error("Wallet not found or does not belong to this user");

  await db.delete(linkedWallets).where(eq(linkedWallets.id, walletId));
  await audit(userId, "WALLET_REMOVED", { address: wallet.address, chainId: wallet.chainId });
}

export async function getUserWalletAddresses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ address: linkedWallets.address, chainId: linkedWallets.chainId, label: linkedWallets.label })
    .from(linkedWallets)
    .where(eq(linkedWallets.userId, userId));
  return rows;
}

// ─────────────────────────────────────────────
// BUSINESSES
// ─────────────────────────────────────────────

export async function createBusiness(name: string, creatorUserId: number): Promise<Business> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(businesses).values({ name });

  // Get the newly created business
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.name, name))
    .orderBy(businesses.createdAt)
    .limit(1);

  // Auto-assign creator as ADMIN
  await db.insert(businessMembers).values({
    businessId: business.id,
    userId: creatorUserId,
    role: "ADMIN",
  });

  await audit(creatorUserId, "BUSINESS_CREATED", { businessId: business.id, name });
  return business;
}

export async function addBusinessWallet(params: {
  businessId: number;
  address: string;
  chainId: number;
  type: "EMBEDDED" | "EXTERNAL";
  label?: string;
  requesterUserId: number;
}): Promise<BusinessWallet> {
  if (!isAddress(params.address)) throw new Error("Invalid wallet address");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Enforce role — only ADMIN or TREASURER can add wallets
  const [membership] = await db
    .select()
    .from(businessMembers)
    .where(
      and(
        eq(businessMembers.businessId, params.businessId),
        eq(businessMembers.userId, params.requesterUserId)
      )
    )
    .limit(1);

  if (!membership || (membership.role !== "ADMIN" && membership.role !== "TREASURER")) {
    throw new Error("You do not have permission to add a wallet to this business");
  }

  // Check for duplicate
  const existing = await db
    .select()
    .from(businessWallets)
    .where(
      and(
        eq(businessWallets.businessId, params.businessId),
        eq(businessWallets.address, params.address.toLowerCase()),
        eq(businessWallets.chainId, params.chainId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Wallet already linked to this business on this chain");
  }

  await db.insert(businessWallets).values({
    businessId: params.businessId,
    address: params.address.toLowerCase(),
    chainId: params.chainId,
    type: params.type,
    label: params.label,
  });

  const [wallet] = await db
    .select()
    .from(businessWallets)
    .where(
      and(
        eq(businessWallets.businessId, params.businessId),
        eq(businessWallets.address, params.address.toLowerCase()),
        eq(businessWallets.chainId, params.chainId)
      )
    )
    .limit(1);

  await audit(params.requesterUserId, "BUSINESS_WALLET_ADDED", {
    businessId: params.businessId,
    address: params.address,
    chainId: params.chainId,
  });

  return wallet;
}

export async function getBusinessWalletAddresses(businessId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ address: businessWallets.address, chainId: businessWallets.chainId, label: businessWallets.label })
    .from(businessWallets)
    .where(eq(businessWallets.businessId, businessId));
  return rows;
}

// ─────────────────────────────────────────────
// RECOVERY
// ─────────────────────────────────────────────

export async function setRecovery(
  userId: number,
  recoveryCredentialId?: string,
  recoveryWallet?: string
) {
  if (recoveryWallet && !isAddress(recoveryWallet)) {
    throw new Error("Invalid recovery wallet address");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ recoveryCredentialId, recoveryWallet })
    .where(eq(users.id, userId));

  await audit(userId, "RECOVERY_SET", { recoveryCredentialId, recoveryWallet });
}
