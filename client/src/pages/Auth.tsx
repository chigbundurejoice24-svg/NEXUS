/**
 * Auth.tsx — NEXUS v2 Auth
 * Email-first OTP auth. Works on ALL devices — no passkeys, no biometrics.
 * Flow: Landing → Enter Email → OTP → Done
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Mail, Loader2, AlertCircle, CheckCircle2,
  RefreshCw, Shield, Zap, Globe, Lock, ChevronLeft, Sparkles
} from "lucide-react";
import { trpc, setToken } from "@/lib/trpc";
import { queryClient } from "@/lib/queryClient";

// ── OTP 6-box input ────────────────────────────────────────────────────────
function OtpInput({ onComplete, disabled }: { onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState(["","","","","",""]);
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const r5 = useRef<HTMLInputElement>(null);
  const refs = [r0,r1,r2,r3,r4,r5];

  function handleChange(i: number, val: string) {
    const digit = val.replace(/\D/g,"").slice(-1);
    const next = [...digits]; next[i] = digit; setDigits(next);
    if (digit && i < 5) refs[i+1]?.current?.focus();
    if (next.every(d => d)) onComplete(next.join(""));
  }
  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i-1]?.current?.focus();
      const next = [...digits]; next[i-1] = ""; setDigits(next);
    }
  }
  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if (text.length === 6) { setDigits(text.split("")); onComplete(text); }
    e.preventDefault();
  }

  useEffect(() => { r0.current?.focus(); }, []);

  return (
    <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i} ref={refs[i]}
          type="text" inputMode="numeric" maxLength={1} value={d} disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className={`w-12 h-14 text-center text-2xl font-bold rounded-2xl border-2 transition-all outline-none
            ${d ? "border-violet-500 bg-violet-500/10 text-violet-400 dark:text-violet-300" : "border-white/20 bg-white/5 text-white"}
            focus:border-violet-400 focus:bg-violet-500/10 disabled:opacity-50`}
        />
      ))}
    </div>
  );
}

// ── Animated feature pill ──────────────────────────────────────────────────
function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-white/80 text-xs font-medium">
      {icon} {text}
    </div>
  );
}

type Step = "landing" | "email" | "otp" | "name";

export default function Auth() {
  const navigate = useNavigate();
  const [step, setStep]       = useState<Step>("landing");
  const [email, setEmail]     = useState("");
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCount] = useState(0);
  const [isNew, setIsNew]     = useState(false);

  // tRPC mutations
  const sendCodeMutation    = trpc.auth.sendVerificationCode.useMutation();
  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation();
  const registerMutation    = trpc.auth.register.useMutation();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCount(c => c-1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Step 1: send OTP ────────────────────────────────────────────────────
  async function handleSendOtp() {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@") || !e.includes(".")) {
      setError("Enter a valid email address"); return;
    }
    setError(""); setLoading(true);
    try {
      const res = await sendCodeMutation.mutateAsync({ email: e });
      setIsNew(!!(res as any)?.isNewUser);
      setStep("otp");
      setCount(60);
    } catch (err: any) {
      setError(err?.message ?? "Failed to send code. Check your email and try again.");
    } finally { setLoading(false); }
  }

  // ── Step 2: verify OTP ──────────────────────────────────────────────────
  async function handleVerifyOtp(code: string) {
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const res: any = await verifyEmailMutation.mutateAsync({ code });
      if (res?.token) {
        setToken(res.token);
        queryClient.clear();
      }
      if (isNew) {
        setStep("name");
        setLoading(false);
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err?.message ?? "Wrong code — check your email and try again.");
      setLoading(false);
    }
  }

  // ── Step 3: set display name (new users only) ───────────────────────────
  async function handleSetName() {
    if (!name.trim()) { setError("Enter your name"); return; }
    setError(""); setLoading(true);
    try {
      // Use email prefix as credentialId for the register mutation
      const credentialId = btoa(email.trim().toLowerCase());
      const publicKey = btoa("email_auth");
      await registerMutation.mutateAsync({
        credentialId,
        publicKey,
        displayName: name.trim(),
      });
      navigate("/");
    } catch (err: any) {
      // If already registered, just navigate
      navigate("/");
    } finally { setLoading(false); }
  }

  // ── Resend ──────────────────────────────────────────────────────────────
  async function handleResend() {
    if (countdown > 0) return;
    setError(""); setLoading(true);
    try {
      await sendCodeMutation.mutateAsync({ email: email.trim().toLowerCase() });
      setCount(60);
    } catch (err: any) {
      setError(err?.message ?? "Failed to resend");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#0D0E16] flex flex-col">
      {/* Gradient background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">

          {/* ── LANDING ── */}
          {step === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-sm text-center space-y-8"
            >
              {/* Logo */}
              <div className="space-y-4">
                <div className="relative inline-block">
                  <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-violet-500/40">
                    <Shield size={36} className="text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-[#0D0E16] flex items-center justify-center">
                    <Sparkles size={10} className="text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white tracking-tight">NEXUS</h1>
                  <p className="text-white/50 text-sm mt-1">Move value across Africa instantly</p>
                </div>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 justify-center">
                <FeaturePill icon={<Zap size={12} />} text="Instant swaps" />
                <FeaturePill icon={<Globe size={12} />} text="8+ African countries" />
                <FeaturePill icon={<Lock size={12} />} text="Non-custodial" />
                <FeaturePill icon={<Shield size={12} />} text="Secure by default" />
              </div>

              {/* CTA */}
              <div className="space-y-3">
                <button
                  onClick={() => setStep("email")}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-2 hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/30 active:scale-[0.98]"
                >
                  Get Started <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => setStep("email")}
                  className="w-full py-3.5 bg-white/5 border border-white/10 text-white/70 font-medium rounded-2xl hover:bg-white/10 transition-all text-sm"
                >
                  Already have an account? Sign in
                </button>
              </div>

              {/* Trust line */}
              <p className="text-white/30 text-xs">
                No password needed · Secured by email verification
              </p>
            </motion.div>
          )}

          {/* ── EMAIL ENTRY ── */}
          {step === "email" && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm space-y-6"
            >
              <button onClick={() => setStep("landing")} className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm transition-colors">
                <ChevronLeft size={16} /> Back
              </button>

              <div>
                <h2 className="text-2xl font-bold text-white">Enter your email</h2>
                <p className="text-white/50 text-sm mt-1.5">We'll send you a 6-digit code to sign in</p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                    autoFocus
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 text-base focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-all"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
                  >
                    <AlertCircle size={14} /> {error}
                  </motion.div>
                )}

                <button
                  onClick={handleSendOtp}
                  disabled={loading || !email.trim()}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:from-violet-500 hover:to-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 active:scale-[0.98]"
                >
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : <>Continue <ArrowRight size={18} /></>}
                </button>
              </div>

              <p className="text-white/25 text-xs text-center">
                By continuing you agree to our Terms of Service and Privacy Policy
              </p>
            </motion.div>
          )}

          {/* ── OTP VERIFY ── */}
          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm space-y-6"
            >
              <button onClick={() => { setStep("email"); setError(""); }} className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm transition-colors">
                <ChevronLeft size={16} /> Back
              </button>

              <div>
                <div className="w-14 h-14 bg-violet-500/20 rounded-2xl flex items-center justify-center mb-4">
                  <Mail size={24} className="text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Check your email</h2>
                <p className="text-white/50 text-sm mt-1.5">
                  We sent a 6-digit code to <span className="text-violet-400 font-medium">{email}</span>
                </p>
              </div>

              <OtpInput onComplete={handleVerifyOtp} disabled={loading} />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
                >
                  <AlertCircle size={14} /> {error}
                </motion.div>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 text-violet-400 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Verifying...
                </div>
              )}

              {/* Resend */}
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-white/30 text-sm">Resend code in <span className="text-white/60 font-medium">{countdown}s</span></p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-violet-400 text-sm mx-auto hover:text-violet-300 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={14} /> Resend code
                  </button>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-2.5">
                <Shield size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-white/40 text-xs">
                  This code expires in 10 minutes and can only be used once.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── NAME ENTRY (new users) ── */}
          {step === "name" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm space-y-6 text-center"
            >
              <div>
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} className="text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Email verified!</h2>
                <p className="text-white/50 text-sm mt-1.5">What should we call you?</p>
              </div>

              <div className="space-y-3 text-left">
                <input
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleSetName()}
                  autoFocus
                  autoComplete="name"
                  className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 text-base focus:outline-none focus:border-violet-500/60 transition-all"
                />

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}

                <button
                  onClick={handleSetName}
                  disabled={loading || !name.trim()}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/20"
                >
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Setting up...</> : <>Enter NEXUS <ArrowRight size={18} /></>}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
