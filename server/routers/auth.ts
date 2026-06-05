/**
 * auth.ts — Aegis passkey authentication + wallet binding
 *
 * WALLET SECURITY MODEL (4 layers):
 * ─────────────────────────────────────────────
 * LAYER 1 — linked_wallets + wallet_anchor (primary)
 * LAYER 2 — users.wallet_address (denorm backup)
 * LAYER 3 — deriveWalletAddress(credentialId) (deterministic regen)
 * LAYER 4 — wallet_registry VAULT (email-locked forever, written ONCE)
 *
 * A wallet CANNOT be permanently lost.
 * Device change? vault_registry has email → wallet_address → restored automatically.
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, linkedWallets } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { deriveWalletAddress, EMBEDDED_WALLET_CHAIN_ID } from "../lib/wallets/wallet-generator";
import { hashCredential, makeWalletAnchor, resolveAndAnchorWallet, lockWalletToEmail } from "../lib/wallets/wallet-binding";

const JWT_SECRET  = process.env.JWT_SECRET  || "aegis-dev-secret-change-in-prod";
const RESEND_KEY  = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL  = "noreply@aegis.cozanet.net";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
          <p style="color:#9ca3af;font-size:14px;margin:0 0 24px">Enter this code in the app. It expires in 10 minutes.</p>
          <div style="background:#1a1c20;border:1px solid rgba(91,60,245,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#5B3CF5;font-family:monospace">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:12px;text-align:center">If you didn't request this, ignore this email.</p>
        </div>
      `,
    }),
  });
  if (!resp.ok) throw new Error(`Resend error: ${await resp.text()}`);
}

export const authRouter = router({

  // ── Register ────────────────────────────────────────────────────
  register: publicProcedure
    .input(z.object({
      credentialId: z.string().min(1),
      publicKey:    z.string().min(1),
      displayName:  z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await db.select({ id: users.id })
        .from(users).where(eq(users.credentialId, input.credentialId)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Credential already registered — try logging in instead" });
      }

      const safeSlice    = input.credentialId.replace(/[^a-zA-Z0-9+/=_-]/g, "").slice(0, 48);
      const openId       = `passkey_${safeSlice}`;
      const credentialHash = hashCredential(input.credentialId);
      const walletAddress  = deriveWalletAddress(input.credentialId);

      await db.insert(users).values({
        openId,
        credentialId:    input.credentialId,
        publicKey:       input.publicKey,
        name:            input.displayName?.trim() ?? null,
        credentialHash,
        walletAddress,
        lastSignedIn:    new Date(),
      });

      const [user] = await db.select({ id: users.id })
        .from(users).where(eq(users.openId, openId)).limit(1);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed — please retry" });

      const walletAnchor = makeWalletAnchor(user.id, walletAddress, input.credentialId);

      try {
        await db.insert(linkedWallets).values({
          userId:       user.id,
          address:      walletAddress,
          chainId:      EMBEDDED_WALLET_CHAIN_ID,
          type:         "EMBEDDED",
          label:        "My Aegis Wallet",
          walletAnchor,
        });
      } catch { /* unique constraint race — already exists */ }

      return {
        token:         signToken(user.id),
        user:          { id: user.id, name: input.displayName ?? null },
        walletAddress,
      };
    }),

  // ── Login ───────────────────────────────────────────────────────
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
        walletAddress: users.walletAddress,
      }).from(users).where(eq(users.credentialId, input.credentialId)).limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey not registered — please create an account first" });

      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // 🔒 4-layer wallet resolution — vault-aware, device-change safe
      const { address: walletAddress } = await resolveAndAnchorWallet({
        db, linkedWallets, users, eq, and,
        userId:              user.id,
        credentialId:        user.credentialId ?? input.credentialId,
        email:               user.email ?? null,
        storedWalletAddress: user.walletAddress,
      });

      return {
        token:         signToken(user.id),
        user:          { id: user.id, name: user.name, emailVerified: user.emailVerified },
        walletAddress,
      };
    }),

  // ── Current user ────────────────────────────────────────────────
  me: publicProcedure.query(async ({ ctx }) => {
    const ctxUser = (ctx as any).user;
    if (!ctxUser) return null;

    const db = await getDb();
    if (!db) return null;

    const [full] = await db.select({
      id:             users.id,
      name:           users.name,
      email:          users.email,
      emailVerified:  users.emailVerified,
      kycStatus:      users.kycStatus,
      credentialId:   users.credentialId,
      credentialHash: users.credentialHash,
      walletAddress:  users.walletAddress,
      role:           users.role,
    }).from(users).where(eq(users.id, ctxUser.id)).limit(1);

    if (!full) return null;

    // 🔒 Vault-aware wallet resolution on every page load
    let walletAddress: string | null = null;
    if (full.credentialId) {
      const result = await resolveAndAnchorWallet({
        db, linkedWallets, users, eq, and,
        userId:              full.id,
        credentialId:        full.credentialId,
        email:               full.email ?? null,
        storedWalletAddress: full.walletAddress,
      });
      walletAddress = result.address;
    } else {
      walletAddress = full.walletAddress ?? null;
    }

    const isAdmin = full.role === "admin"
      || (!!full.email && ADMIN_EMAILS.has(full.email.toLowerCase().trim()));

    return {
      id:             full.id,
      name:           full.name,
      email:          full.email,
      emailVerified:  full.emailVerified,
      kycStatus:      full.kycStatus,
      isAdmin,
      walletAddress,
      credentialHash: full.credentialHash,
    };
  }),

  logout: publicProcedure.mutation(() => ({ success: true })),

  // ── Send verification code ──────────────────────────────────────
  sendVerificationCode: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check email not taken by another user
      const [existing] = await db.select({ id: users.id })
        .from(users).where(eq(users.email, input.email)).limit(1);
      if (existing && existing.id !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
      }

      const code      = generateCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await db.update(users).set({
        email:            input.email,
        verificationCode: code,
        codeExpiresAt:    expiresAt,
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
        email:            users.email,
        walletAddress:    users.walletAddress,
        credentialHash:   users.credentialHash,
        openId:           users.openId,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);

      if (!u?.verificationCode) throw new TRPCError({ code: "BAD_REQUEST", message: "No verification code found — request a new one" });
      if (u.codeExpiresAt && u.codeExpiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Code expired — request a new one" });
      if (u.verificationCode !== input.code) throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect code" });

      await db.update(users).set({
        emailVerified:    true,
        verificationCode: null,
        codeExpiresAt:    null,
      }).where(eq(users.id, ctx.user.id));

      // 🔒 VAULT LOCK — bind this email to wallet address permanently
      if (u.email && u.walletAddress) {
        await lockWalletToEmail({
          db,
          userId:         ctx.user.id,
          email:          u.email,
          walletAddress:  u.walletAddress,
          credentialHash: u.credentialHash ?? "",
          openId:         u.openId ?? "",
        });
      }

      return { verified: true };
    }),

  // ── Resend verification code ────────────────────────────────────
  resendVerificationCode: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!u?.email) throw new TRPCError({ code: "BAD_REQUEST", message: "No email set — add your email first" });
      const code      = generateCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await db.update(users).set({ verificationCode: code, codeExpiresAt: expiresAt }).where(eq(users.id, ctx.user.id));
      await sendResendEmail(u.email, code);
      return { sent: true };
    }),

  // ── verifyEmail alias for verifyCode ────────────────────────────
  verifyEmail: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [u] = await db.select({
        verificationCode: users.verificationCode,
        codeExpiresAt:    users.codeExpiresAt,
        email:            users.email,
        walletAddress:    users.walletAddress,
        credentialHash:   users.credentialHash,
        openId:           users.openId,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);

      if (!u?.verificationCode) throw new TRPCError({ code: "BAD_REQUEST", message: "No code found — request a new one" });
      if (u.codeExpiresAt && u.codeExpiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Code expired — request a new one" });
      if (u.verificationCode !== input.code) throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect code" });

      await db.update(users).set({ emailVerified: true, verificationCode: null, codeExpiresAt: null })
        .where(eq(users.id, ctx.user.id));

      // 🔒 VAULT LOCK — email verified = wallet locked to email permanently
      if (u.email && u.walletAddress) {
        await lockWalletToEmail({
          db,
          userId:         ctx.user.id,
          email:          u.email,
          walletAddress:  u.walletAddress,
          credentialHash: u.credentialHash ?? "",
          openId:         u.openId ?? "",
        });
      }

      return { verified: true };
    }),

  // ── Update name + phone ─────────────────────────────────────────
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80).optional(), phone: z.string().max(20).optional() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const update: Record<string, any> = {};
      if (input.name  !== undefined) update.name  = input.name.trim();
      if (input.phone !== undefined) update.phone = input.phone.trim();
      if (Object.keys(update).length === 0) return { updated: false };
      await db.update(users).set(update).where(eq(users.id, ctx.user.id));
      return { updated: true };
    }),

  // ── KYC submission ──────────────────────────────────────────────
  submitKyc: protectedProcedure
    .input(z.object({
      tier:        z.enum(["BASIC", "ENHANCED"]),
      fullName:    z.string().min(2),
      dateOfBirth: z.string().optional(),
      country:     z.string().optional(),
      idType:      z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ kycStatus: "PENDING", name: input.fullName }).where(eq(users.id, ctx.user.id));
      console.log(`[KYC] User ${ctx.user.id} submitted ${input.tier} KYC:`, input);
      return { submitted: true };
    }),
});
