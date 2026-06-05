/**
 * Settings.tsx — User settings
 * Fixed: email/kyc tRPC calls match router names
 * Added: profile name/phone edit
 * Removed: credentialId exposure
 */
import { useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import {
  Shield, Wallet, Bell, Moon, Sun,
  BadgeCheck, KeyRound, Copy, Check,
  Mail, Loader2, CheckCircle2, XCircle,
  User, FileText, Phone, Edit3, Save,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWallets } from "@/hooks/useWallets";
import { trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/queryClient";

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

// ── Email Verification ────────────────────────────────────────────
function EmailVerification() {
  const { user, isLoading } = useCurrentUser();
  if (isLoading) return <div className="px-5 py-4"><Loader2 size={18} className="animate-spin text-aegis-tertiary-dark"/></div>;
  const [email, setEmail]       = useState(user?.email ?? "");
  const [code, setCode]         = useState("");
  const [step, setStep]         = useState<"idle"|"sent"|"verified">(user?.emailVerified ? "verified" : "idle");
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const [timer, setTimer]       = useState(0);

  function startTimer() {
    setTimer(60);
    const iv = setInterval(() => setTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; }), 1000);
  }

  // sendVerificationCode — correct router name
  const sendCode = trpc.auth.sendVerificationCode.useMutation({
    onSuccess: () => { setStep("sent"); setErrorMsg(null); startTimer(); },
    onError:   e => setErrorMsg(e.message),
  });
  // resendVerificationCode — now exists in router
  const resend = trpc.auth.resendVerificationCode.useMutation({
    onSuccess: () => { setErrorMsg(null); setCode(""); startTimer(); },
    onError:   e => setErrorMsg(e.message),
  });
  // verifyEmail — now exists in router
  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: d => { if (d.verified) { setStep("verified"); setErrorMsg(null); queryClient.invalidateQueries(); } },
    onError:   e => setErrorMsg(e.message),
  });

  if (step === "verified" || user?.emailVerified) {
    return (
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={18} className="text-green-500"/>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium dark:text-white">Email Verified</p>
          <p className="text-xs text-aegis-tertiary-dark">{user?.email ?? email}</p>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Verified ✓</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
          <Mail size={16} className="text-aegis-accent-purple"/>
        </div>
        <div>
          <p className="text-sm font-medium dark:text-white">Email Verification</p>
          <p className="text-xs text-aegis-tertiary-dark">Unlock $10,000/day limits</p>
        </div>
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Unverified</span>
      </div>

      {step === "idle" && (
        <>
          <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
          {errorMsg && <p className="flex items-center gap-1.5 text-xs text-red-500"><XCircle size={12}/>{errorMsg}</p>}
          <button onClick={() => email.trim() && sendCode.mutate({ email: email.trim() })}
            disabled={sendCode.isPending || !email.trim()}
            className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {sendCode.isPending ? <><Loader2 size={14} className="animate-spin"/>Sending…</> : "Send Verification Code"}
          </button>
        </>
      )}

      {step === "sent" && (
        <>
          <p className="text-xs text-aegis-secondary-dark">Code sent to <span className="font-medium dark:text-white">{email}</span>. Check inbox + spam.</p>
          <input type="text" inputMode="numeric" maxLength={6} placeholder="• • • • • •" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
            className="w-full px-3 py-2.5 text-sm font-mono tracking-[0.3em] text-center rounded-lg border border-border bg-aegis-bg-elevated dark:text-white focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
          {errorMsg && <p className="flex items-center gap-1.5 text-xs text-red-500"><XCircle size={12}/>{errorMsg}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setStep("idle"); setCode(""); setErrorMsg(null); }}
              className="flex-1 py-2.5 border border-border rounded-lg text-sm text-aegis-secondary-dark hover:bg-aegis-bg-elevated">Change Email</button>
            <button onClick={() => code.length === 6 && verify.mutate({ code })}
              disabled={verify.isPending || code.length < 6}
              className="flex-1 py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {verify.isPending ? <><Loader2 size={14} className="animate-spin"/>Verifying…</> : "Verify Code"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => resend.mutate()} disabled={resend.isPending || timer > 0}
              className="text-xs text-aegis-accent-purple hover:opacity-80 disabled:opacity-40">
              {resend.isPending ? "Sending…" : timer > 0 ? `Resend in ${timer}s` : "Resend code"}
            </button>
            <button onClick={() => { setStep("idle"); setCode(""); setErrorMsg(null); }}
              className="text-xs text-aegis-tertiary-dark hover:text-aegis-secondary-dark">Different email</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Profile Edit ──────────────────────────────────────────────────
function ProfileEdit() {
  const { user } = useCurrentUser();
  const [name, setName]   = useState(user?.name ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [err, setErr]     = useState<string|null>(null);

  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      setSaved(true);
      setErr(null);
      queryClient.invalidateQueries();
      setTimeout(() => setSaved(false), 2500);
    },
    onError: e => setErr(e.message),
  });

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
          <User size={16} className="text-aegis-accent-purple"/>
        </div>
        <p className="text-sm font-medium dark:text-white">Profile Information</p>
      </div>
      <input placeholder="Display name" value={name} onChange={e => setName(e.target.value)}
        className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
      <input placeholder="+234 800 000 0000" value={phone} onChange={e => setPhone(e.target.value)}
        className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"/>
      {err && <p className="text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/>{err}</p>}
      <button onClick={() => update.mutate({ name: name.trim() || undefined, phone: phone.trim() || undefined })}
        disabled={update.isPending}
        className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
        {update.isPending ? <><Loader2 size={14} className="animate-spin"/>Saving…</> : saved ? <><Check size={14}/>Saved!</> : <><Save size={14}/>Save Changes</>}
      </button>
    </div>
  );
}

// ── KYC Section ───────────────────────────────────────────────────
function KycSection() {
  const { user } = useCurrentUser();
  const [fullName, setFullName]   = useState(user?.name ?? "");
  const [dob, setDob]             = useState("");
  const [country, setCountry]     = useState("Nigeria");
  const [idType, setIdType]       = useState("NIN");
  const [tier, setTier]           = useState<"BASIC"|"ENHANCED">("BASIC");
  const [submitted, setSubmitted] = useState(user?.kycStatus === "PENDING" || user?.kycStatus === "VERIFIED");
  const [err, setErr]             = useState<string|null>(null);

  const submit = trpc.auth.submitKyc.useMutation({
    onSuccess: () => { setSubmitted(true); queryClient.invalidateQueries(); },
    onError:   e => setErr(e.message),
  });

  if (user?.kycStatus === "VERIFIED") {
    return (
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
          <BadgeCheck size={18} className="text-green-500"/>
        </div>
        <div className="flex-1"><p className="text-sm font-medium dark:text-white">KYC Verified</p><p className="text-xs text-aegis-tertiary-dark">Identity confirmed</p></div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Verified ✓</span>
      </div>
    );
  }

  if (submitted || user?.kycStatus === "PENDING") {
    return (
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center flex-shrink-0">
          <BadgeCheck size={18} className="text-yellow-500"/>
        </div>
        <div className="flex-1"><p className="text-sm font-medium dark:text-white">KYC Under Review</p><p className="text-xs text-aegis-tertiary-dark">We'll notify you when it's approved (1-2 days)</p></div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Pending</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
          <BadgeCheck size={16} className="text-aegis-accent-purple"/>
        </div>
        <div>
          <p className="text-sm font-medium dark:text-white">Identity Verification (KYC)</p>
          <p className="text-xs text-aegis-tertiary-dark">Required to send money</p>
        </div>
      </div>
      <div className="flex gap-2">
        {(["BASIC","ENHANCED"] as const).map(t => (
          <button key={t} onClick={() => setTier(t)}
            className={`flex-1 py-2 text-xs rounded-lg border font-medium transition-colors ${tier===t ? "border-aegis-accent-purple bg-aegis-accent-purple/10 text-aegis-accent-purple" : "border-border text-aegis-tertiary-dark"}`}>
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
      {err && <p className="text-xs text-red-500 flex items-center gap-1"><XCircle size={12}/>{err}</p>}
      <button onClick={() => fullName.trim() && submit.mutate({ tier, fullName: fullName.trim(), dateOfBirth: dob, country, idType })}
        disabled={submit.isPending || !fullName.trim()}
        className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
        {submit.isPending ? <><Loader2 size={14} className="animate-spin"/>Submitting…</> : "Submit for Review"}
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function Settings() {
  const { user, isLoading: authLoading } = useCurrentUser();
  // Wait for auth to resolve before rendering any tRPC-dependent sections
  if (authLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-aegis-tertiary-dark"/>
    </div>
  );
  const { linkedWallets } = useWallets();
  const [notifTx, setNotifTx]     = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);

  const darkMode = document.documentElement.classList.contains("dark");
  function toggleDark() {
    const next = !darkMode;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("aegis_theme", next ? "dark" : "light");
    // force re-render
    window.dispatchEvent(new Event("aegis-theme-change"));
  }

  const embeddedWallet = linkedWallets[0];

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0 space-y-6">

      {/* Profile */}
      <Section title="Profile">
        <ProfileEdit/>
      </Section>

      {/* Security */}
      <Section title="Security & Verification">
        <EmailVerification/>
        <KycSection/>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
            <KeyRound size={16} className="text-aegis-accent-purple"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium dark:text-white">Passkey Authentication</p>
            <p className="text-xs text-aegis-tertiary-dark">Secured with Face ID or fingerprint</p>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Active ✓</span>
        </div>
      </Section>

      {/* Wallet */}
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
            <p className="text-xs text-aegis-tertiary-dark">No wallet linked yet — log in to auto-generate.</p>
          </div>
        )}
      </Section>

      {/* Appearance */}
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

      {/* Notifications */}
      <Section title="Notifications">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-aegis-accent-purple"/>
          </div>
          <div className="flex-1"><p className="text-sm font-medium dark:text-white">Transaction Alerts</p><p className="text-xs text-aegis-tertiary-dark">Notify on sends, receives, and failures</p></div>
          <Toggle on={notifTx} onToggle={() => setNotifTx(!notifTx)}/>
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-aegis-accent-purple"/>
          </div>
          <div className="flex-1"><p className="text-sm font-medium dark:text-white">Promotions</p><p className="text-xs text-aegis-tertiary-dark">Cozanet rewards and feature updates</p></div>
          <Toggle on={notifPromo} onToggle={() => setNotifPromo(!notifPromo)}/>
        </div>
      </Section>

      {/* Account info — NO credentialId exposed */}
      <Section title="Account">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-aegis-accent-purple"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium dark:text-white">Account ID</p>
            <p className="text-xs text-aegis-tertiary-dark font-mono">aegis_user_{user?.id ?? "—"}</p>
          </div>
          <CopyButton text={`aegis_user_${user?.id ?? ""}`}/>
        </div>
        {user?.email && (
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-aegis-accent-purple"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium dark:text-white">Email</p>
              <p className="text-xs text-aegis-tertiary-dark truncate">{user.email}</p>
            </div>
            {user.emailVerified
              ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Verified</span>
              : <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Unverified</span>}
          </div>
        )}
      </Section>
    </div>
  );
}
