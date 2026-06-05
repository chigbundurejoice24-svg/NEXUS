/**
 * auth.ts — passkey + JWT + email verification
 *
 * WALLET LOCK:
 *   Every auth operation that touches users also ensures the embedded wallet
 *   exists in linked_wallets. If it's ever missing (e.g. after a DB migration
 *   or admin action), it is silently re-created from the deterministic
 *   deriveWalletAddress(credentialId) — the address is always the same.
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, linkedWallets } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { deriveWalletAddress, EMBEDDED_WALLET_CHAIN_ID } from "../lib/wallets/wallet-generator";

const JWT_SECRET  = process.env.JWT_SECRET  || "aegis-dev-secret-change-in-prod";
const RESEND_KEY  = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL  = "noreply@aegis.cozanet.net";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Admin emails — only these can access Admin Console ────────────
const ADMIN_EMAILS = new Set([
  "info@cozanet.net",
  "fassdavid722@gmail.com",
]);

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * WALLET LOCK — ensures the user always has an embedded wallet record.
 * Called after register and on every me() fetch.
 * Idempotent: does nothing if the wallet already exists.
 */
async function ensureEmbeddedWallet(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
  credentialId: string,
): Promise<string> {
  if (!db) return "";

  // Check if wallet already exists
  const [existing] = await db.select({ address: linkedWallets.address })
    .from(linkedWallets)
    .where(and(eq(linkedWallets.userId, userId), eq(linkedWallets.type, "EMBEDDED")))
    .limit(1);

  if (existing) return existing.address;

  // Deterministically derive the address — same credentialId always gives same address
  const walletAddress = deriveWalletAddress(credentialId);
  try {
    await db.insert(linkedWallets).values({
      userId,
      address:  walletAddress,
      chainId:  EMBEDDED_WALLET_CHAIN_ID,
      type:     "EMBEDDED",
      label:    "My Aegis Wallet",
    });
    console.log(`[WalletLock] Re-created embedded wallet for user ${userId}: ${walletAddress}`);
  } catch (e: any) {
    // Unique constraint: wallet already created by a concurrent request — fine
    if (!e?.message?.includes("unique")) console.error("[WalletLock] insert failed:", e?.message);
  }
  return walletAddress;
}

async function sendResendEmail(to: string, code: string): Promise<void> {
  if (!RESEND_KEY) {
    console.log(`[EMAIL VERIFICATION] Code ${code} → ${to}`);
    return;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Aegis <${FROM_EMAIL}>`,
      to:   [to],
      subject: "Your Aegis verification code",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0B0C10;color:#fff;border-radius:16px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="width:56px;height:56px;background:linear-gradient(135deg,#5B3CF5,#3B5BDB);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
              <span style="font-size:28px">🛡️</span>
            </div>
            <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0">Aegis</h1>
          </div>
          <h2 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 8px">Verify your email</h2>
          <p style="color:#9ca3af;font-size:14px;margin:0 0 24px">Enter this 6-digit code in the app. Expires in 10 minutes.</p>
          <div style="background:#1a1c20;border:1px solid rgba(91,60,245,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#5B3CF5;font-family:monospace">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:12px;text-align:center">If you did not request this, ignore this email.</p>
        </div>
      `,
    }),
  });
  if (!resp.ok) throw new Error(`Resend error: ${await resp.text()}`);
}

export const authRouter = router({
  // ── Register new passkey account ────────────────────────────────
  register: publicProcedure
    .input(z.object({
      credentialId: z.string().min(1),
      publicKey:    z.string().min(1),
      displayName:  z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check for existing credential
      const existing = await db.select({ id: users.id })
        .from(users).where(eq(users.credentialId, input.credentialId)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Credential already registered — try logging in instead" });
      }

      // Build openId — safe slice of credentialId
      const safeCredSlice = input.credentialId.replace(/[^a-zA-Z0-9+/=_-]/g, "").slice(0, 48);
      const openId = `passkey_${safeCredSlice}`;

      // Insert user — only columns that actually exist in the DB
      await db.insert(users).values({
        openId,
        credentialId: input.credentialId,
        publicKey:    input.publicKey,
        name:         input.displayName?.trim() ?? null,
        lastSignedIn: new Date(),
      });

      const [user] = await db.select({ id: users.id })
        .from(users).where(eq(users.openId, openId)).limit(1);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed — please retry" });

      // 🔒 WALLET LOCK — create embedded wallet immediately
      const walletAddress = await ensureEmbeddedWallet(db, user.id, input.credentialId);

      return {
        token:         signToken(user.id),
        user:          { id: user.id, name: input.displayName ?? null },
        walletAddress,
      };
    }),

  // ── Login with existing passkey ─────────────────────────────────
  login: publicProcedure
    .input(z.object({ credentialId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db.select({
        id:            users.id,
        name:          users.name,
        email:         users.email,
        emailVerified: users.emailVerified,
        credentialId:  users.credentialId,
      }).from(users).where(eq(users.credentialId, input.credentialId)).limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey not registered — please register first" });

      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // 🔒 WALLET LOCK — restore wallet if it was lost
      const walletAddress = await ensureEmbeddedWallet(db, user.id, user.credentialId ?? input.credentialId);

      return {
        token:         signToken(user.id),
        user:          { id: user.id, name: user.name, emailVerified: user.emailVerified },
        walletAddress,
      };
    }),

  // ── Current authenticated user ──────────────────────────────────
  me: publicProcedure.query(async ({ ctx }) => {
    const ctxUser = (ctx as any).user;
    if (!ctxUser) return null;

    const db = await getDb();
    if (!db) return null;

    const [full] = await db.select({
      id:            users.id,
      name:          users.name,
      email:         users.email,
      emailVerified: users.emailVerified,
      kycStatus:     users.kycStatus,
      credentialId:  users.credentialId,
      role:          users.role,
    }).from(users).where(eq(users.id, ctxUser.id)).limit(1);

    if (!full) return null;

    // 🔒 WALLET LOCK — heal missing wallet on every me() call
    let walletAddress: string | null = null;
    if (full.credentialId) {
      walletAddress = await ensureEmbeddedWallet(db, full.id, full.credentialId);
    } else {
      // Fallback: just read existing wallet
      const [w] = await db.select({ address: linkedWallets.address })
        .from(linkedWallets).where(eq(linkedWallets.userId, full.id)).limit(1);
      walletAddress = w?.address ?? null;
    }

    const isAdmin = full.role === "admin" || (!!full.email && ADMIN_EMAILS.has(full.email.toLowerCase().trim()));

    return {
      id:            full.id,
      name:          full.name,
      email:         full.email,
      emailVerified: full.emailVerified,
      kycStatus:     full.kycStatus,
      isAdmin,
      walletAddress,
    };
  }),

  logout: publicProcedure.mutation(() => ({ success: true })),

  // ── Send / resend email verification code ──────────────────────
  sendVerificationCode: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if email is already taken by another user
      const [taken] = await db.select({ id: users.id })
        .from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
      if (taken && taken.id !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already in use by another account" });
      }

      const code      = generateCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MS);

      await db.update(users).set({
        email:              input.email.toLowerCase(),
        verificationCode:   code,
        codeExpiresAt:      expiresAt,
        emailVerified:      false,
      }).where(eq(users.id, ctx.user.id));

      await sendResendEmail(input.email, code);
      return { sent: true };
    }),

  // ── Verify code ─────────────────────────────────────────────────
  verifyCode: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [u] = await db.select({
        verificationCode: users.verificationCode,
        codeExpiresAt:    users.codeExpiresAt,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);

      if (!u?.verificationCode) throw new TRPCError({ code: "BAD_REQUEST", message: "No verification code found" });
      if (u.codeExpiresAt && u.codeExpiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Code expired — request a new one" });
      if (u.verificationCode !== input.code) throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect code" });

      await db.update(users).set({
        emailVerified:    true,
        verificationCode: null,
        codeExpiresAt:    null,
      }).where(eq(users.id, ctx.user.id));

      return { verified: true };
    }),
});
