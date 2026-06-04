/**
 * Auth.tsx — Login & Sign-Up with legal consent gate
 * Flow: country → choice → register → LEGAL CONSENT → email → verify → dashboard
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Fingerprint, Globe, ChevronDown, Loader2,
  AlertCircle, Sparkles, Mail, CheckCircle2, RefreshCw,
  FileText, Check, ExternalLink,
} from "lucide-react";
import { trpc, setToken } from "@/lib/trpc";
import { CONSENT_ITEMS } from "@/lib/legal-policies";

const CONSENT_STORAGE_KEY = "aegis_legal_consent_v1";

const COUNTRIES = [
  { name: "Nigeria",      code: "NG", flag: "🇳🇬", currency: "NGN" },
  { name: "Ghana",        code: "GH", flag: "🇬🇭", currency: "GHS" },
  { name: "Kenya",        code: "KE", flag: "🇰🇪", currency: "KES" },
  { name: "South Africa", code: "ZA", flag: "🇿🇦", currency: "ZAR" },
  { name: "Tanzania",     code: "TZ", flag: "🇹🇿", currency: "TZS" },
  { name: "Uganda",       code: "UG", flag: "🇺🇬", currency: "UGX" },
  { name: "Senegal",      code: "SN", flag: "🇸🇳", currency: "XOF" },
  { name: "Cameroon",     code: "CM", flag: "🇨🇲", currency: "XAF" },
];

type Step = "country" | "choice" | "register" | "legal" | "login" | "email" | "verify";

// 6-digit OTP input
function OtpInput({ onComplete }: { onComplete: (code: string) => void }) {
  const [digits, setDigits] = useState(["","","","","",""]);
  const refs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ];

  function handleChange(i: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < 5) refs[i + 1]?.current?.focus();
    if (next.every(d => d)) onComplete(next.join(""));
  }
  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs[i - 1]?.current?.focus();
  }
  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) { setDigits(text.split("")); onComplete(text); }
  }

  return (
    <div className="flex gap-2 justify-center my-4" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1} value={d} autoFocus={i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-14 text-center text-xl font-bold rounded-xl border-2 border-border bg-aegis-bg-elevated text-aegis-primary-dark dark:text-white focus:outline-none focus:border-aegis-accent-purple transition-colors" />
      ))}
    </div>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const [step, setStep]           = useState<Step>("country");
  const [country, setCountry]     = useState(COUNTRIES[0]);
  const [showDrop, setShowDrop]   = useState(false);
  const [displayName, setName]    = useState("");
  const [email, setEmail]         = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  // Legal consent state — all unchecked initially
  const [consented, setConsented] = useState<Record<string, boolean>>(
    () => Object.fromEntries(CONSENT_ITEMS.map(item => [item.id, false]))
  );

  const registerMutation    = trpc.auth.register.useMutation();
  const loginMutation       = trpc.auth.login.useMutation();
  const sendCodeMutation    = trpc.auth.sendVerificationCode.useMutation();
  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation();

  useEffect(() => {
    const saved = localStorage.getItem("aegis_country");
    if (saved) {
      const found = COUNTRIES.find(c => c.code === saved);
      if (found) { setCountry(found); setStep("choice"); }
    }
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const allConsented = CONSENT_ITEMS.filter(i => i.required).every(i => consented[i.id]);

  function acceptAll() {
    setConsented(Object.fromEntries(CONSENT_ITEMS.map(item => [item.id, true])));
  }

  function saveConsentRecord() {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      timestamp: new Date().toISOString(),
      version: "v1-june-2026",
      items: CONSENT_ITEMS.map(i => ({ id: i.id, accepted: true })),
    }));
  }

  const handleCountrySelect = (c: typeof COUNTRIES[0]) => {
    setCountry(c); setShowDrop(false);
    localStorage.setItem("aegis_country", c.code);
    localStorage.setItem("aegis_currency", c.currency);
  };

  const handleRegister = async () => {
    if (!displayName.trim()) { setError("Please enter your name"); return; }
    setError(""); setLoading(true);
    try {
      const userId     = crypto.getRandomValues(new Uint8Array(16));
      const name       = displayName.trim();
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Aegis", id: window.location.hostname },
          user: { id: userId, name, displayName: name },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "preferred", residentKey: "preferred" },
          timeout: 60_000,
        },
      }) as PublicKeyCredential | null;
      if (!credential) throw new Error("Passkey creation cancelled");
      const response     = credential.response as AuthenticatorAttestationResponse;
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      const publicKey    = btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey?.() ?? new ArrayBuffer(0))));
      const result       = await registerMutation.mutateAsync({ credentialId, publicKey, displayName: name });
      setToken(result.token);
      // After passkey creation, show legal consent
      setStep("legal");
    } catch (e: any) {
      setError(e.message?.includes("already") ? "This device is already registered. Try logging in." : e.message ?? "Registration failed");
    } finally { setLoading(false); }
  };

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          userVerification: "preferred",
          timeout: 60_000,
        },
      }) as PublicKeyCredential | null;
      if (!assertion) throw new Error("No passkey selected");
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
      const result       = await loginMutation.mutateAsync({ credentialId });
      setToken(result.token);
      navigate("/");
    } catch (e: any) {
      setError(e.message?.includes("NOT_FOUND") || e.message?.includes("not registered")
        ? "Passkey not found. Create an account first."
        : e.message ?? "Login failed");
    } finally { setLoading(false); }
  };

  const handleConsentContinue = () => {
    if (!allConsented) return;
    saveConsentRecord();
    setStep("email");
  };

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email address"); return; }
    setError(""); setLoading(true);
    try {
      await sendCodeMutation.mutateAsync({ email: email.trim() });
      setStep("verify");
      setResendTimer(60);
    } catch (e: any) {
      setError(e.message ?? "Failed to send code");
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async (code: string) => {
    setError(""); setLoading(true);
    try {
      await verifyEmailMutation.mutateAsync({ code });
      navigate("/");
    } catch (e: any) {
      setError(e.message ?? "Invalid code — try again");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || !email) return;
    setError(""); setLoading(true);
    try {
      await sendCodeMutation.mutateAsync({ email });
      setResendTimer(60);
    } catch (e: any) {
      setError(e.message ?? "Failed to resend");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5B3CF5] via-[#6B4CF5] to-[#3B5BDB] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AEGIS</h1>
          <p className="text-white/70 text-sm mt-1">Move value across Africa instantly</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* STEP 1: Country */}
            {step === "country" && (
              <motion.div key="country" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={20} className="text-aegis-accent-purple" />
                  <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Select your country</h2>
                </div>
                <p className="text-sm text-aegis-secondary-dark mb-6">We'll set your default currency and payment methods</p>
                <div className="relative mb-6">
                  <button onClick={() => setShowDrop(!showDrop)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-border rounded-xl bg-card hover:border-aegis-accent-purple transition-all">
                    <span className="flex items-center gap-3 text-sm font-medium">
                      <span className="text-2xl">{country.flag}</span>
                      <span>{country.name}</span>
                      <span className="text-aegis-tertiary-dark">({country.currency})</span>
                    </span>
                    <ChevronDown size={16} className={`text-aegis-tertiary-dark transition-transform ${showDrop ? "rotate-180" : ""}`} />
                  </button>
                  {showDrop && (
                    <motion.div initial={{ opacity:0,y:-5 }} animate={{ opacity:1,y:0 }}
                      className="absolute z-20 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                      {COUNTRIES.map(c => (
                        <button key={c.code} onClick={() => handleCountrySelect(c)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-aegis-bg-elevated transition-colors ${c.code === country.code ? "bg-aegis-bg-elevated font-medium" : ""}`}>
                          <span className="text-xl">{c.flag}</span>
                          <span className="flex-1 text-left">{c.name}</span>
                          <span className="text-aegis-tertiary-dark text-xs">{c.currency}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
                <button onClick={() => { localStorage.setItem("aegis_country", country.code); localStorage.setItem("aegis_currency", country.currency); setStep("choice"); }}
                  className="w-full py-3.5 bg-gradient-to-r from-aegis-accent-purple to-aegis-accent-blue text-white rounded-xl font-semibold hover:opacity-90 transition-opacity">
                  Continue
                </button>
              </motion.div>
            )}

            {/* STEP 2: Choice */}
            {step === "choice" && (
              <motion.div key="choice" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="text-center mb-6">
                  <span className="text-3xl">{country.flag}</span>
                  <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white mt-2">Welcome to Aegis</h2>
                  <p className="text-sm text-aegis-secondary-dark mt-1">Your secure crypto wallet for Africa</p>
                </div>
                <div className="space-y-3">
                  <button onClick={() => setStep("register")}
                    className="w-full flex items-center gap-4 p-4 border-2 border-aegis-accent-purple rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-aegis-accent-purple/10 flex items-center justify-center group-hover:bg-aegis-accent-purple/20">
                      <Sparkles size={20} className="text-aegis-accent-purple" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-aegis-primary-dark dark:text-white text-sm">Create Account</div>
                      <div className="text-xs text-aegis-tertiary-dark">Secure with Face ID or fingerprint</div>
                    </div>
                  </button>
                  <button onClick={() => setStep("login")}
                    className="w-full flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-aegis-bg-elevated transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center">
                      <Fingerprint size={20} className="text-aegis-accent-purple" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-aegis-primary-dark dark:text-white text-sm">I Have an Account</div>
                      <div className="text-xs text-aegis-tertiary-dark">Sign in with your passkey</div>
                    </div>
                  </button>
                </div>
                <button onClick={() => setStep("country")} className="w-full text-center text-xs text-aegis-tertiary-dark mt-4 hover:text-aegis-accent-purple">
                  ← Change country
                </button>
              </motion.div>
            )}

            {/* STEP 3: Register */}
            {step === "register" && (
              <motion.div key="register" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={20} className="text-aegis-accent-purple" />
                  <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Create Account</h2>
                </div>
                <p className="text-sm text-aegis-secondary-dark mb-6">Your biometric will secure your account — no password needed</p>
                <div className="space-y-3 mb-6">
                  <input type="text" placeholder="Your name" value={displayName} onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-card text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:border-aegis-accent-purple" />
                </div>
                {error && <div className="flex items-center gap-2 text-red-500 text-sm mb-4"><AlertCircle size={16} />{error}</div>}
                <button onClick={handleRegister} disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-aegis-accent-purple to-aegis-accent-blue text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : <><Fingerprint size={18} /> Register with Face ID</>}
                </button>
                <button onClick={() => setStep("choice")} className="w-full text-center text-xs text-aegis-tertiary-dark mt-4 hover:text-aegis-accent-purple">← Back</button>
              </motion.div>
            )}

            {/* STEP 4: LEGAL CONSENT (NEW) */}
            {step === "legal" && (
              <motion.div key="legal" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={20} className="text-aegis-accent-purple" />
                  <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Terms & Agreements</h2>
                </div>
                <p className="text-sm text-aegis-secondary-dark mb-5">
                  Please review and accept the following before continuing.
                </p>

                {/* Accept All shortcut */}
                {!allConsented && (
                  <button
                    onClick={acceptAll}
                    className="w-full mb-4 py-2.5 border border-[#5B3CF5] rounded-xl text-sm font-semibold text-[#5B3CF5] hover:bg-[#5B3CF5]/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    Accept All
                  </button>
                )}

                {/* Consent checklist */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1 mb-5">
                  {CONSENT_ITEMS.map(item => (
                    <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
                      <div
                        onClick={() => setConsented(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                          consented[item.id]
                            ? "bg-[#5B3CF5] border-[#5B3CF5]"
                            : "border-border bg-card group-hover:border-[#5B3CF5]/60"
                        }`}
                      >
                        {consented[item.id] && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-sm text-aegis-secondary-dark leading-snug select-none">
                        {item.text}
                        {item.linkedPolicyId && (
                          <a
                            href={`/legal?doc=${item.linkedPolicyId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="ml-1 text-[#5B3CF5] hover:underline inline-flex items-center gap-0.5 text-xs"
                          >
                            Read <ExternalLink size={10} />
                          </a>
                        )}
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleConsentContinue}
                  disabled={!allConsented}
                  className="w-full py-3.5 bg-gradient-to-r from-aegis-accent-purple to-aegis-accent-blue text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  Continue
                </button>

                <p className="text-center text-xs text-aegis-tertiary-dark mt-3">
                  By continuing, you confirm you have read and accepted all policies above.
                </p>
              </motion.div>
            )}

            {/* STEP 5: Login */}
            {step === "login" && (
              <motion.div key="login" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Fingerprint size={20} className="text-aegis-accent-purple" />
                  <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Welcome Back</h2>
                </div>
                <p className="text-sm text-aegis-secondary-dark mb-8">Touch your fingerprint sensor or use Face ID</p>
                {error && <div className="flex items-center gap-2 text-red-500 text-sm mb-4"><AlertCircle size={16} />{error}</div>}
                <button onClick={handleLogin} disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-aegis-accent-purple to-aegis-accent-blue text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Signing In…</> : <><Fingerprint size={18} /> Sign In with Passkey</>}
                </button>
                <button onClick={() => setStep("choice")} className="w-full text-center text-xs text-aegis-tertiary-dark mt-4 hover:text-aegis-accent-purple">← Back</button>
              </motion.div>
            )}

            {/* STEP 6: Email */}
            {step === "email" && (
              <motion.div key="email" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={20} className="text-aegis-accent-purple" />
                  <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Add your email</h2>
                </div>
                <p className="text-sm text-aegis-secondary-dark mb-6">For account recovery and important notifications</p>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendCode()}
                  className="w-full px-4 py-3 border border-border rounded-xl text-sm bg-card text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:border-aegis-accent-purple mb-4" />
                {error && <div className="flex items-center gap-2 text-red-500 text-sm mb-4"><AlertCircle size={16} />{error}</div>}
                <button onClick={handleSendCode} disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-aegis-accent-purple to-aegis-accent-blue text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : "Send Verification Code"}
                </button>
                <button onClick={() => navigate("/")} className="w-full text-center text-xs text-aegis-tertiary-dark mt-4 hover:text-aegis-accent-purple">
                  Skip for now →
                </button>
              </motion.div>
            )}

            {/* STEP 7: Verify */}
            {step === "verify" && (
              <motion.div key="verify" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-aegis-accent-purple/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={28} className="text-aegis-accent-purple" />
                  </div>
                  <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Check your email</h2>
                  <p className="text-sm text-aegis-secondary-dark mt-2">
                    We sent a 6-digit code to<br />
                    <span className="font-medium text-aegis-primary-dark dark:text-white">{email}</span>
                  </p>
                </div>
                {error && <div className="flex items-center gap-2 text-red-500 text-sm mb-4 justify-center"><AlertCircle size={16} />{error}</div>}
                {loading && <div className="flex justify-center mb-4"><Loader2 size={20} className="animate-spin text-aegis-accent-purple" /></div>}
                <OtpInput onComplete={handleVerifyCode} />
                <div className="text-center mt-4">
                  {resendTimer > 0 ? (
                    <p className="text-xs text-aegis-tertiary-dark">Resend in {resendTimer}s</p>
                  ) : (
                    <button onClick={handleResend} disabled={loading}
                      className="text-xs text-aegis-accent-purple hover:underline flex items-center gap-1 mx-auto disabled:opacity-60">
                      <RefreshCw size={12} /> Resend code
                    </button>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer legal links */}
        {(step === "choice" || step === "country") && (
          <p className="text-center text-white/50 text-xs mt-6">
            By using Aegis you agree to our{" "}
            <a href="/legal?doc=terms" target="_blank" rel="noopener noreferrer" className="text-white/80 underline">Terms</a>
            {" & "}
            <a href="/legal?doc=privacy" target="_blank" rel="noopener noreferrer" className="text-white/80 underline">Privacy Policy</a>
            . © 2026 Cozanet.
          </p>
        )}
      </motion.div>
    </div>
  );
}
