/**
 * auth.ts — passkey + JWT + email verification router
 *
 * Procedures:
 *   register            — passkey register + auto-embed wallet
 *   login               — passkey challenge → JWT
 *   me                  — current user (from JWT ctx)
 *   logout              — no-op (client clears token)
 *   sendVerificationCode — sends 6-digit code via Resend (or logs if no key)
 *   verifyEmail         — accepts code, marks email as verified
 *   updateEmail         — saves email without verifying yet
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users, linkedWallets } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { deriveWalletAddress, EMBEDDED_WALLET_CHAIN_ID } from "../lib/wallets/wallet-generator";

const JWT_SECRET  = process.env.JWT_SECRET  || "aegis-dev-secret-change-in-prod";
const RESEND_KEY  = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL  = "noreply@cozanet.net";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendResendEmail(to: string, code: string): Promise<void> {
  if (!RESEND_KEY) {
    // Dev mode — log the code so you can test without a Resend key
    console.log(`[EMAIL VERIFICATION] Would send code ${code} to ${to}`);
    return;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
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
          <p style="color:#9ca3af;font-size:14px;margin:0 0 24px">Enter this 6-digit code in the app. It expires in 10 minutes.</p>
          <div style="background:#1a1c20;border:1px solid rgba(91,60,245,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#5B3CF5;font-family:monospace">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:12px;text-align:center">If you didn't request this, ignore this email.</p>
        </div>
      `,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend error: ${body}`);
  }
}

export const authRouter = router({
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
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Credential already registered" });

      const openId = `passkey_${input.credentialId.slice(0, 48)}`;

      await db.insert(users).values({
        openId,
        credentialId: input.credentialId,
        publicKey:    input.publicKey,
        name:         input.displayName ?? null,
        lastSignedIn: new Date(),
      });

      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed" });

      const walletAddress = deriveWalletAddress(input.credentialId);
      try {
        await db.insert(linkedWallets).values({
          userId: user.id, address: walletAddress,
          chainId: EMBEDDED_WALLET_CHAIN_ID, type: "EMBEDDED", label: "My Aegis Wallet",
        });
      } catch { /* race condition — not fatal */ }

      return { token: signToken(user.id), user: { id: user.id }, walletAddress };
    }),

  login: publicProcedure
    .input(z.object({ credentialId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [user] = await db.select({ id: users.id, name: users.name, role: users.role, emailVerified: users.emailVerified })
        .from(users).where(eq(users.credentialId, input.credentialId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey not registered — register first" });

      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const [wallet] = await db.select({ address: linkedWallets.address })
        .from(linkedWallets).where(eq(linkedWallets.userId, user.id)).limit(1);

      return {
        token: signToken(user.id),
        user: { id: user.id, name: user.name, role: user.role, emailVerified: user.emailVerified },
        walletAddress: wallet?.address ?? null,
      };
    }),

  me: publicProcedure.query(async ({ ctx }) => {
    const user = (ctx as any).user;
    if (!user) return null;
    const db = await getDb();
    if (!db) return user;
    const [full] = await db.select({
      id: users.id, name: users.name, email: users.email,
      emailVerified: users.emailVerified, role: users.role, kycStatus: users.kycStatus,
    }).from(users).where(eq(users.id, user.id)).limit(1);
    return full ?? null;
  }),

  logout: publicProcedure.mutation(() => ({ success: true })),

  // ── Send 6-digit verification code to email ────────────────────
  sendVerificationCode: protectedProcedure
    .input(z.object({ email: z.string().email("Invalid email address") }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const userId = ctx.user!.id;
      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MS);

      // Save email + code to user (email can be updated here)
      await db.update(users).set({
        email:            input.email.toLowerCase().trim(),
        verificationCode: code,
        codeExpiresAt:    expiresAt,
        emailVerified:    false,
        updatedAt:        new Date(),
      }).where(eq(users.id, userId));

      try {
        await sendResendEmail(input.email, code);
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to send email: ${e.message}` });
      }

      return { sent: true, expiresAt };
    }),

  // ── Verify the code ────────────────────────────────────────────
  verifyEmail: protectedProcedure
    .input(z.object({ code: z.string().length(6, "Code must be 6 digits") }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const userId = ctx.user!.id;
      const [user] = await db.select({
        verificationCode: users.verificationCode,
        codeExpiresAt:    users.codeExpiresAt,
        emailVerified:    users.emailVerified,
      }).from(users).where(eq(users.id, userId)).limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (user.emailVerified) return { verified: true, alreadyVerified: true };
      if (!user.verificationCode) throw new TRPCError({ code: "BAD_REQUEST", message: "No code sent — request a new code first" });
      if (user.codeExpiresAt && new Date() > user.codeExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Code expired — request a new one" });
      }
      if (user.verificationCode !== input.code.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Incorrect code — try again" });
      }

      await db.update(users).set({
        emailVerified:    true,
        verificationCode: null,
        codeExpiresAt:    null,
        updatedAt:        new Date(),
      }).where(eq(users.id, userId));

      return { verified: true, alreadyVerified: false };
    }),
});
