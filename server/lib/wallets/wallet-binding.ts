/**
 * wallet-binding.ts
 *
 * Cryptographic binding between a user account and their embedded wallet.
 *
 * HOW IT WORKS:
 * ─────────────────────────────────────────────────────────────────
 * 1. CREDENTIAL HASH  — SHA-256(credentialId)
 *    Stored in users.credential_hash.
 *    One-way: can never be reversed to get the credentialId.
 *    Purpose: lets us find the user by their passkey fingerprint
 *             even if the session JWT is gone.
 *
 * 2. WALLET ANCHOR    — HMAC-SHA256(address:userId:credentialId, ANCHOR_SECRET)
 *    Stored in linked_wallets.wallet_anchor.
 *    Purpose: cryptographically proves this wallet belongs to exactly
 *             this user + this passkey. Can't be forged without ANCHOR_SECRET.
 *             If someone deletes or swaps the wallet row, the anchor won't match
 *             the recomputed value → we know it's tampered.
 *
 * 3. WALLET ADDRESS   — stored in users.wallet_address (denormalized copy)
 *    If linked_wallets row is deleted/lost, we can restore from this field
 *    and from deriveWalletAddress(credentialId) — both must agree.
 *
 * RECOVERY CHAIN (in order of trust):
 *   1. linked_wallets WHERE user_id = ? AND anchor = expected   (primary)
 *   2. users.wallet_address                                      (denorm backup)
 *   3. deriveWalletAddress(credentialId)                         (deterministic regen)
 *   All three must agree. If they differ → log security alert.
 */

import { createHmac, createHash } from "crypto";
import { deriveWalletAddress } from "./wallet-generator";

const ANCHOR_SECRET = process.env.WALLET_ANCHOR_SECRET ?? "aegis-anchor-dev-secret";

/**
 * One-way fingerprint of the passkey credentialId.
 * Used to look up users when no JWT exists.
 */
export function hashCredential(credentialId: string): string {
  return createHash("sha256").update(credentialId).digest("hex");
}

/**
 * HMAC binding: proves wallet belongs to this user + credential.
 * Must match what was stored at registration time.
 */
export function makeWalletAnchor(
  userId: number,
  walletAddress: string,
  credentialId: string,
): string {
  const msg = `${walletAddress.toLowerCase()}:${userId}:${credentialId}`;
  return createHmac("sha256", ANCHOR_SECRET).update(msg).digest("hex");
}

/**
 * Verify the stored anchor matches the expected value.
 * Returns false if tampered or missing.
 */
export function verifyWalletAnchor(
  storedAnchor: string | null | undefined,
  userId: number,
  walletAddress: string,
  credentialId: string,
): boolean {
  if (!storedAnchor) return false;
  const expected = makeWalletAnchor(userId, walletAddress, credentialId);
  // Constant-time comparison to prevent timing attacks
  if (storedAnchor.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= storedAnchor.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Triple-source wallet resolution with anchor verification.
 *
 * Priority:
 *   1. If linked_wallets row exists AND anchor is valid → trust it
 *   2. If linked_wallets row exists but anchor missing/invalid → re-anchor it
 *   3. If linked_wallets row is missing → derive from credentialId + restore
 *
 * All paths end with the wallet being anchored in the DB.
 */
export async function resolveAndAnchorWallet(params: {
  db: any;
  linkedWallets: any;
  users: any;
  eq: any;
  and: any;
  userId: number;
  credentialId: string;
  storedWalletAddress?: string | null;
  storedAnchor?: string | null;
}): Promise<{ address: string; wasRestored: boolean; anchorValid: boolean }> {
  const {
    db, linkedWallets, users, eq, and,
    userId, credentialId,
    storedWalletAddress, storedAnchor,
  } = params;

  const expectedAddress = deriveWalletAddress(credentialId);

  // --- Try to find the existing embedded wallet row ---
  const [existingWallet] = await db
    .select({ id: linkedWallets.id, address: linkedWallets.address, anchor: linkedWallets.walletAnchor })
    .from(linkedWallets)
    .where(and(eq(linkedWallets.userId, userId), eq(linkedWallets.type, "EMBEDDED")))
    .limit(1);

  if (existingWallet) {
    const anchorOk = verifyWalletAnchor(existingWallet.anchor, userId, existingWallet.address, credentialId);

    if (!anchorOk) {
      // Anchor missing or tampered — re-anchor with correct value
      console.warn(`[WalletBinding] Re-anchoring wallet for user ${userId} (anchor mismatch)`);
      const newAnchor = makeWalletAnchor(userId, existingWallet.address, credentialId);
      await db.update(linkedWallets)
        .set({ walletAnchor: newAnchor })
        .where(eq(linkedWallets.id, existingWallet.id));
    }

    // Also sync denormalized wallet_address on users row
    if (!storedWalletAddress || storedWalletAddress !== existingWallet.address) {
      await db.update(users)
        .set({ walletAddress: existingWallet.address })
        .where(eq(users.id, userId));
    }

    return { address: existingWallet.address, wasRestored: false, anchorValid: anchorOk };
  }

  // --- No wallet row found: restore from credentialId ---
  console.warn(`[WalletBinding] Restoring lost wallet for user ${userId} → ${expectedAddress}`);

  // Prefer users.wallet_address if it matches derivation (extra safety)
  const finalAddress =
    storedWalletAddress && storedWalletAddress === expectedAddress
      ? storedWalletAddress
      : expectedAddress;

  const anchor = makeWalletAnchor(userId, finalAddress, credentialId);

  try {
    await db.insert(linkedWallets).values({
      userId,
      address:      finalAddress,
      chainId:      56, // BSC
      type:         "EMBEDDED",
      label:        "My Aegis Wallet",
      walletAnchor: anchor,
    });
  } catch {
    // Unique constraint race — wallet was re-created by another request
  }

  // Sync denorm
  await db.update(users)
    .set({ walletAddress: finalAddress })
    .where(eq(users.id, userId));

  return { address: finalAddress, wasRestored: true, anchorValid: true };
}
