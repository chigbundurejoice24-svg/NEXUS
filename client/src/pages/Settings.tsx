/**
 * Settings.tsx — Complete user settings
 *
 * Key fixes:
 * 1. ALL hooks are called at top level before ANY conditional returns (Rules of Hooks)
 * 2. tRPC mutations only fire when isAuthenticated=true (no more "must be logged in")
 * 3. Email + Passkey shown as ONE unified identity section
 * 4. Proper Logout button that clears token and redirects to /auth
 * 5. usePreferences() for dark mode (no stale DOM reads)
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePreferences } from "@/hooks/usePreferences";
import {
  Shield, Wallet, Bell, Moon, Sun,
  BadgeCheck, KeyRound, Copy, Check,
  Mail, Loader2, CheckCircle2, XCircle,
  User, Phone, LogOut, Fingerprint, AlertCircle,
} from "lucide-react";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { useWallets } from "@/hooks/useWallets";
import { trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/queryClient";

// ── Helpers ───────────────────────────────────────────────────────────────────
function shorten(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors">
      {done ? <Check size={14} className="text-green-500"/> : <Copy size={14} className="text-aegis-tertiary-dark"/>}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-aegis-bg-elevated">
        <h3 className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-aegis-accent-purple" : "bg-border"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`}/>
    </button>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate();
  const logout   = useLogout();

  // ── ALL hooks at top — no early returns before this block ────────────────
  const { user, isLoading: authLoading, isAuthenticated } = useCurrentUser();
  const { currentTheme, setTheme } = usePreferences();
  const { linkedWallets } = useWallets();

  // Profile edit state
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaved,    setProfileSaved]  = useState(false);
  const [profileErr,      setProfileErr]    = useState<string|null>(null);

  // Email verification state
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [emailStep, setEmailStep] = useState<"idle"|"sent"|"verified">("idle");
  const [emailErr,  setEmailErr]  = useState<string|null>(null);
  const [timer,   setTimer]   = useState(0);

  // KYC state
  const [fullName,   setFullName]   = useState("");
  const [dob,        setDob]        = useState("");
  const [idType,     setIdType]     = useState("NIN");
  const [kycTier,    setKycTier]    = useState<"BASIC"|"ENHANCED">("BASIC");
  const [kycErr,     setKycErr]     = useState<string|null>(null);
  const [kycSubmitted, setKycSubmitted] = useState(false);

  // Notifications state
  const [notifTx,    setNotifTx]    = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);

  // ── tRPC mutations — only fire when authenticated ─────────────────────────
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      setProfileSaved(true); setProfileErr(null);
      queryClient.invalidateQueries();
      setTimeout(() => setProfileSaved(false), 2500);
    },
    onError: e => setProfileErr(e.message),
  });

  const sendCode = trpc.auth.sendVerificationCode.useMutation({
    onSuccess: () => { setEmailStep("sent"); setEmailErr(null); startTimer(); },
    onError:   e => setEmailErr(e.message),
  });
  const resend = trpc.auth.resendVerificationCode.useMutation({
    onSuccess: () => { setEmailErr(null); setCode(""); startTimer(); },
    onError:   e => setEmailErr(e.message),
  });
  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: d => {
      if ((d as any).verified) { setEmailStep("verified"); setEmailErr(null); queryClient.invalidateQueries(); }
    },
    onError: e => setEmailErr(e.message),
  });

  const submitKyc = trpc.auth.submitKyc.useMutation({
    onSuccess: () => { setKycSubmitted(true); setKycErr(null); queryClient.invalidateQueries(); },
    onError:   e => setKycErr(e.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const darkMode = currentTheme === "dark";
  function toggleDark() { setTheme(darkMode ? "light" : "dark"); }

  function startTimer() {
    setTimer(60);
    const iv = setInterval(() => setTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; }), 1000);
  }

  function handleLogout() {
    logout();
    navigate("/auth");
  }

  // ── Early returns AFTER all hooks ─────────────────────────────────────────
  if (authLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-aegis-tertiary-dark"/>
    </div>
  );

  if (!isAuthenticated || !user) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <AlertCircle size={32} className="text-red-400"/>
      <p className="text-sm text-aegis-tertiary-dark">Please log in to access settings.</p>
      <button onClick={() => navigate("/auth")}
        className="px-6 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-medium">
        Go to Login
      </button>
    </div>
  );

  // ── Derived state from user ───────────────────────────────────────────────
  const embeddedWallet    = linkedWallets[0];
  const isEmailVerified   = !!(user as any).emailVerified;
  const kycStatus         = (user as any).kycStatus ?? "NONE";
  const isKycVerified     = kycStatus === "VERIFIED";
  const isKycPending      = kycStatus === "PENDING";
  const displayEmail      = (user as any).email ?? email;
  const displayName       = (user as any).name ?? "";
  const aegisId           = (user as any).aegisId ?? null;

  // Sync email input with user's stored email on first load
  const emailToShow = displayEmail || email;

  return (
    <div className="max-w-2xl mx-auto pb-24 lg:pb-0 space-y-6">

      {/* ── Identity (Email + Passkey unified) ── */}
      <Section title="Your Identity">

        {/* Aegis ID */}
        {aegisId && (
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-[#5B3CF5]/10 flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-[#5B3CF5]"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium dark:text-white">Aegis ID</p>
              <p className="text-xs text-aegis-tertiary-dark font-mono">{aegisId}</p>
            </div>
            <CopyButton text={aegisId}/>
          </div>
        )}

        {/* Passkey — always shown, always active once logged in */}
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
            <Fingerprint size={16} className="text-green-500"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium dark:text-white">Passkey Authentication</p>
            <p className="text-xs text-aegis-tertiary-dark">Face ID / Fingerprint · secured by device</p>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium flex-shrink-0">
            Active ✓
          </span>
        </div>

        {/* Email — linked to same identity */}
        {isEmailVerified ? (
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-green-500"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium dark:text-white">Email Verified</p>
              <p className="text-xs text-aegis-tertiary-dark truncate">{displayEmail}</p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium flex-shrink-0">
              Verified ✓
            </span>
          </div>
        ) : emailStep === "idle" ? (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-aegis-accent-purple"/>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium dark:text-white">Link Your Email</p>
                <p className="text-xs text-aegis-tertiary-dark">Unlocks $10,000/day limits + account recovery</p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium flex-shrink-0">Unlinked</span>
            </div>
            <input type="email" placeholder="your@email.com"
              value={emailToShow} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
            {emailErr && <p className="flex items-center gap-1.5 text-xs text-red-500"><XCircle size={12}/>{emailErr}</p>}
            <button
              onClick={() => {
                const e = emailToShow.trim();
                if (e) sendCode.mutate({ email: e });
              }}
              disabled={sendCode.isPending || !emailToShow.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {sendCode.isPending ? <><Loader2 size={14} className="animate-spin"/>Sending…</> : "Send Verification Code"}
            </button>
          </div>
        ) : emailStep === "sent" ? (
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-aegis-secondary-dark">
              Code sent to <span className="font-medium dark:text-white">{emailToShow}</span> · check inbox + spam
            </p>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="Enter 6-digit code"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
              className="w-full px-3 py-2.5 text-sm font-mono tracking-[0.3em] text-center rounded-lg border border-border bg-aegis-bg-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
            {emailErr && <p className="flex items-center gap-1.5 text-xs text-red-500"><XCircle size={12}/>{emailErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setEmailStep("idle"); setCode(""); setEmailErr(null); }}
                className="flex-1 py-2.5 border border-border rounded-lg text-sm text-aegis-secondary-dark">
                Change Email
              </button>
              <button onClick={() => code.length === 6 && verify.mutate({ code })}
                disabled={verify.isPending || code.length < 6}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {verify.isPending ? <><Loader2 size={14} className="animate-spin"/>Verifying…</> : "Verify Code"}
              </button>
            </div>
            <button onClick={() => resend.mutate()} disabled={resend.isPending || timer > 0}
              className="text-xs text-aegis-accent-purple hover:opacity-80 disabled:opacity-40">
              {resend.isPending ? "Sending…" : timer > 0 ? `Resend in ${timer}s` : "Resend code"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 px-5 py-4">
            <CheckCircle2 size={20} className="text-green-500"/>
            <p className="text-sm font-medium dark:text-white">Email verified!</p>
          </div>
        )}

      </Section>

      {/* ── Profile ── */}
      <Section title="Profile">
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-aegis-accent-purple"/>
            </div>
            <p className="text-sm font-medium dark:text-white">Display Name</p>
          </div>
          <input placeholder={displayName || "Your name"}
            value={name || displayName}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
            <input placeholder="+234 800 000 0000" value={phone} onChange={e => setPhone(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
          </div>
          {profileErr && <p className="text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/>{profileErr}</p>}
          <button
            onClick={() => updateProfile.mutate({ name: (name || displayName).trim() || undefined, phone: phone.trim() || undefined })}
            disabled={updateProfile.isPending}
            className="w-full py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {updateProfile.isPending ? <><Loader2 size={14} className="animate-spin"/>Saving…</> :
             profileSaved ? <><Check size={14}/>Saved!</> : "Save Profile"}
          </button>
        </div>
      </Section>

      {/* ── KYC ── */}
      <Section title="Identity Verification (KYC)">
        {isKycVerified ? (
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
              <BadgeCheck size={18} className="text-green-500"/>
            </div>
            <div className="flex-1"><p className="text-sm font-medium dark:text-white">KYC Verified</p><p className="text-xs text-aegis-tertiary-dark">Identity confirmed</p></div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Verified ✓</span>
          </div>
        ) : (isKycPending || kycSubmitted) ? (
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center flex-shrink-0">
              <BadgeCheck size={18} className="text-yellow-500"/>
            </div>
            <div className="flex-1"><p className="text-sm font-medium dark:text-white">KYC Under Review</p><p className="text-xs text-aegis-tertiary-dark">Approval takes 1-2 days</p></div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Pending</span>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <div className="flex gap-2">
              {(["BASIC","ENHANCED"] as const).map(t => (
                <button key={t} onClick={() => setKycTier(t)}
                  className={`flex-1 py-2 text-xs rounded-lg border font-medium transition-colors ${kycTier===t ? "border-aegis-accent-purple bg-aegis-accent-purple/10 text-aegis-accent-purple" : "border-border text-aegis-tertiary-dark"}`}>
                  {t === "BASIC" ? "Basic ($1k/day)" : "Enhanced ($10k/day)"}
                </button>
              ))}
            </div>
            <input placeholder="Full legal name" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
            <select value={idType} onChange={e => setIdType(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30">
              <option value="NIN">NIN (National ID)</option>
              <option value="BVN">BVN (Bank Verification)</option>
              <option value="PASSPORT">International Passport</option>
              <option value="DRIVERS_LICENSE">Driver's License</option>
            </select>
            {kycErr && <p className="text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/>{kycErr}</p>}
            <button
              onClick={() => fullName.trim() && submitKyc.mutate({ tier: kycTier, fullName: fullName.trim(), dateOfBirth: dob, country: "Nigeria", idType })}
              disabled={submitKyc.isPending || !fullName.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {submitKyc.isPending ? <><Loader2 size={14} className="animate-spin"/>Submitting…</> : "Submit for Review"}
            </button>
          </div>
        )}
      </Section>

      {/* ── Wallet ── */}
      <Section title="Wallet">
        {embeddedWallet ? (
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
              <Wallet size={16} className="text-aegis-accent-purple"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium dark:text-white">Aegis Wallet</p>
              <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{shorten(embeddedWallet.address)}</p>
            </div>
            <CopyButton text={embeddedWallet.address}/>
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-xs text-aegis-tertiary-dark">Wallet auto-generated on login. Try logging out and back in.</p>
          </div>
        )}
      </Section>

      {/* ── Appearance ── */}
      <Section title="Appearance">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
            {darkMode ? <Moon size={16} className="text-aegis-accent-purple"/> : <Sun size={16} className="text-aegis-accent-purple"/>}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium dark:text-white">Dark Mode</p>
            <p className="text-xs text-aegis-tertiary-dark">Follows system by default</p>
          </div>
          <Toggle on={darkMode} onToggle={toggleDark}/>
        </div>
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-aegis-accent-purple"/>
          </div>
          <div className="flex-1"><p className="text-sm font-medium dark:text-white">Transaction Alerts</p><p className="text-xs text-aegis-tertiary-dark">Sends, receives, and failures</p></div>
          <Toggle on={notifTx} onToggle={() => setNotifTx(!notifTx)}/>
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-aegis-accent-purple"/>
          </div>
          <div className="flex-1"><p className="text-sm font-medium dark:text-white">Promotions & Updates</p><p className="text-xs text-aegis-tertiary-dark">New features and offers</p></div>
          <Toggle on={notifPromo} onToggle={() => setNotifPromo(!notifPromo)}/>
        </div>
      </Section>

      {/* ── Account / Logout ── */}
      <Section title="Account">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-500/5 transition-colors group">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <LogOut size={16} className="text-red-400"/>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-red-500">Log Out</p>
            <p className="text-xs text-aegis-tertiary-dark">Clears session · your wallet stays safe</p>
          </div>
        </button>
      </Section>

    </div>
  );
}
