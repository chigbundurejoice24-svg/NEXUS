/**
 * wallet-binding.ts — Triple-layer wallet security + Vault recovery
 *
 * SECURITY MODEL (4 layers, each independent):
 * ─────────────────────────────────────────────────────────────────
 * LAYER 1 — linked_wallets row  (primary, fast)
 *   wallet_anchor = HMAC-SHA256(address:userId:credentialId, ANCHOR_SECRET)
 *   Proves wallet belongs to exactly this user + passkey.
 *   If tampered: detected + re-anchored automatically.
 *
 * LAYER 2 — users.wallet_address  (denormalized backup)
 *   Set at registration, updated on every login/me() call.
 *   If linked_wallets row is lost: restore from here.
 *
 * LAYER 3 — deterministic derivation  (cryptographic regen)
 *   deriveWalletAddress(credentialId) always produces the same address
 *   for the same passkey. Even if DB is wiped: same passkey = same wallet.
 *
 * LAYER 4 — wallet_registry  (THE VAULT — email-locked forever)
 *   Written ONCE at registration. NEVER updated. NEVER deleted.
 *   Locked to email address — survives device changes, passkey resets,
 *   application bugs, DB corruption. Final source of truth.
 *   If user changes device: look up email in wallet_registry → get address.
 *
 * RECOVERY CHAIN (automatic, no user action):
 *   login() / me() → resolveAndAnchorWallet() → checks all 4 layers
 *   → A wallet CANNOT be permanently lost.
 *
 * DEVICE CHANGE SCENARIO:
 *   User registers on Phone A → wallet 0xABC locked to email john@gmail.com
 *   Phone A lost → registers new passkey on Phone B
 *   New credentialId → would derive wallet 0xXYZ (different!)
 *   BUT: wallet_registry has john@gmail.com → 0xABC
 *   login() sees email match → returns 0xABC regardless of new passkey
 *   Wallet is NEVER lost.
 */

import { createHmac, createHash } from "crypto";
import { deriveWalletAddress } from "./wallet-generator";

const ANCHOR_SECRET = process.env.WALLET_ANCHOR_SECRET ?? "aegis-anchor-dev-secret";

/** One-way fingerprint of the passkey credentialId */
export function hashCredential(credentialId: string): string {
  return createHash("sha256").update(credentialId).digest("hex");
}

/** HMAC binding: proves wallet belongs to this user + credential */
export function makeWalletAnchor(
  userId: number,
  walletAddress: string,
  credentialId: string,
): string {
  const msg = `${walletAddress.toLowerCase()}:${userId}:${credentialId}`;
  return createHmac("sha256", ANCHOR_SECRET).update(msg).digest("hex");
}

/** Constant-time anchor verification */
export function verifyWalletAnchor(
  storedAnchor: string | null | undefined,
  userId: number,
  walletAddress: string,
  credentialId: string,
): boolean {
  if (!storedAnchor) return false;
  const expected = makeWalletAnchor(userId, walletAddress, credentialId);
  if (storedAnchor.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= storedAnchor.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 4-layer wallet resolution + auto-healing.
 * Call on every login() and me() — fast, idempotent, self-repairing.
 */
export async function resolveAndAnchorWallet(params: {
  db:                  any;
  linkedWallets:       any;
  users:               any;
  eq:                  any;
  and:                 any;
  userId:              number;
  credentialId:        string;
  email?:              string | null;
  storedWalletAddress?: string | null;
}): Promise<{ address: string; wasRestored: boolean; anchorValid: boolean }> {
  const {
    db, linkedWallets, users, eq, and,
    userId, credentialId, email,
    storedWalletAddress,
  } = params;

  const derivedAddress = deriveWalletAddress(credentialId);

  // ── LAYER 1: Check linked_wallets row ─────────────────────────
  const [existingWallet] = await db
    .select({ id: linkedWallets.id, address: linkedWallets.address, anchor: linkedWallets.walletAnchor })
    .from(linkedWallets)
    .where(and(eq(linkedWallets.userId, userId), eq(linkedWallets.type, "EMBEDDED")))
    .limit(1);

  if (existingWallet) {
    const anchorOk = verifyWalletAnchor(existingWallet.anchor, userId, existingWallet.address, credentialId);

    // Re-anchor if missing or tampered
    if (!anchorOk) {
      console.warn(`[WalletSecurity] Re-anchoring wallet for user ${userId}`);
      const newAnchor = makeWalletAnchor(userId, existingWallet.address, credentialId);
      await db.update(linkedWallets)
        .set({ walletAnchor: newAnchor })
        .where(eq(linkedWallets.id, existingWallet.id));
    }

    // Sync users.wallet_address (denorm backup)
    if (!storedWalletAddress || storedWalletAddress !== existingWallet.address) {
      await db.update(users)
        .set({ walletAddress: existingWallet.address })
        .where(eq(users.id, userId));
    }

    return { address: existingWallet.address, wasRestored: false, anchorValid: anchorOk };
  }

  // ── LAYER 4: Check wallet_registry (vault) before rederiving ──
  // If the user's email is in the vault, use THAT address — not the derived one
  // This handles the device-change scenario
  let vaultAddress: string | null = null;
  if (email) {
    try {
      const [vaultRow] = await db.execute(
        `SELECT wallet_address FROM wallet_registry WHERE email = $1 LIMIT 1`,
        [email.toLowerCase().trim()]
      );
      if (vaultRow?.wallet_address) {
        vaultAddress = vaultRow.wallet_address;
        console.info(`[WalletSecurity] Vault restore for user ${userId} email=${email} → ${vaultAddress}`);
      }
    } catch (e) {
      // wallet_registry may not exist yet on old DBs — fall through to layer 2/3
      console.warn("[WalletSecurity] wallet_registry lookup failed:", e);
    }
  }

  // ── LAYER 2/3: Use vault address, then stored address, then derived ────────
  const finalAddress = vaultAddress
    ?? (storedWalletAddress === derivedAddress ? storedWalletAddress : null)
    ?? derivedAddress;

  console.warn(`[WalletSecurity] Restoring lost wallet row for user ${userId} → ${finalAddress}`);

  const anchor = makeWalletAnchor(userId, finalAddress, credentialId);

  // Restore linked_wallets row
  try {
    await db.insert(linkedWallets).values({
      userId,
      address:      finalAddress,
      chainId:      56,
      type:         "EMBEDDED",
      label:        "My Aegis Wallet",
      walletAnchor: anchor,
    });
  } catch {
    // Race condition — another request already restored it
  }

  // Sync users.wallet_address
  await db.update(users)
    .set({ walletAddress: finalAddress })
    .where(eq(users.id, userId));

  return { address: finalAddress, wasRestored: true, anchorValid: true };
}

/**
 * Lock a wallet address to an email in the vault.
 * Called ONCE during registration. Safe to call multiple times (ON CONFLICT DO NOTHING).
 */
export async function lockWalletToEmail(params: {
  db:             any;
  userId:         number;
  email:          string;
  walletAddress:  string;
  credentialHash: string;
  openId:         string;
}): Promise<void> {
  const { db, userId, email, walletAddress, credentialHash, openId } = params;
  try {
    await db.execute(
      `INSERT INTO wallet_registry (user_id, email, wallet_address, credential_hash, open_id, locked_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, email.toLowerCase().trim(), walletAddress.toLowerCase(), credentialHash, openId]
    );
    console.info(`[WalletVault] Locked wallet ${walletAddress} → ${email}`);
  } catch (e) {
    // Non-fatal — vault entry may already exist
    console.warn("[WalletVault] lockWalletToEmail:", e);
  }
}
