import { useState } from "react";
import {
  Shield, Wallet, Bell, Moon, Sun,
  BadgeCheck, KeyRound, Copy, Check, ExternalLink,
  Mail, Loader2, CheckCircle2, XCircle, AlertTriangle,
  User, FileText, ChevronDown,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWallets } from "@/hooks/useWallets";
import { trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/queryClient";

// ── helpers ──────────────────────────────────────────────────────
function shorten(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }
  return (
    <button onClick={copy} className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors">
      {done
        ? <Check size={14} className="text-green-500" />
        : <Copy size={14} className="text-aegis-tertiary-dark" />}
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

function SettingRow({
  icon: Icon, label, description, action, badge, badgeColor = "gray",
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  action?: React.ReactNode;
  badge?: string;
  badgeColor?: "green" | "gray" | "yellow";
}) {
  const badgeCls = {
    green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    gray:   "bg-aegis-bg-elevated text-aegis-tertiary-dark",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  }[badgeColor];

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-aegis-accent-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{label}</p>
        {description && <p className="text-xs text-aegis-tertiary-dark mt-0.5 truncate">{description}</p>}
      </div>
      {badge && (
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badgeCls}`}>
          {badge}
        </span>
      )}
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-aegis-accent-purple" : "bg-border"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

// ── Email Verification Section ────────────────────────────────────
function EmailVerification() {
  const { user } = useCurrentUser();
  const [email, setEmail]       = useState(user?.email ?? "");
  const [code, setCode]         = useState("");
  const [step, setStep]         = useState<"idle" | "sent" | "verified">(
    user?.emailVerified ? "verified" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const sendCode = trpc.auth.sendVerificationCode.useMutation({
    onSuccess: () => {
      setStep("sent");
      setErrorMsg(null);
      setResendTimer(60);
      const iv = setInterval(() => {
        setResendTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; });
      }, 1000);
    },
    onError: (e) => setErrorMsg(e.message),
  });

  const resendCode = trpc.auth.resendVerificationCode.useMutation({
    onSuccess: () => {
      setErrorMsg(null);
      setCode("");
      setResendTimer(60);
      const iv = setInterval(() => {
        setResendTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; });
      }, 1000);
    },
    onError: (e) => setErrorMsg(e.message),
  });

  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        setStep("verified");
        setErrorMsg(null);
        queryClient.invalidateQueries();
      }
    },
    onError: (e) => setErrorMsg(e.message),
  });

  if (step === "verified" || user?.emailVerified) {
    return (
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={18} className="text-green-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Email Verified</p>
          <p className="text-xs text-aegis-tertiary-dark mt-0.5">{user?.email ?? email}</p>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Verified ✓
        </span>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
          <Mail size={16} className="text-aegis-accent-purple" />
        </div>
        <div>
          <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Email Verification</p>
          <p className="text-xs text-aegis-tertiary-dark">Unlock $10,000/day transfer limit</p>
        </div>
        <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          Unverified
        </span>
      </div>

      {step === "idle" && (
        <>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-aegis-bg-elevated text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          {errorMsg && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <XCircle size={12} /> {errorMsg}
            </p>
          )}
          <button
            onClick={() => { if (email.trim()) sendCode.mutate({ email: email.trim() }); }}
            disabled={sendCode.isPending || !email.trim()}
            className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sendCode.isPending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : "Send Verification Code"}
          </button>
        </>
      )}

      {step === "sent" && (
        <>
          <p className="text-xs text-aegis-secondary-dark">
            A 6-digit code was sent to <span className="font-medium text-aegis-primary-dark dark:text-white">{email}</span>. Check your inbox (and spam folder).
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="• • • • • •"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full px-3 py-2.5 text-sm font-mono tracking-[0.3em] text-center rounded-lg border border-border bg-aegis-bg-elevated text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          {errorMsg && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <XCircle size={12} /> {errorMsg}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setStep("idle"); setCode(""); setErrorMsg(null); }}
              className="flex-1 py-2.5 border border-border rounded-lg text-sm text-aegis-secondary-dark hover:bg-aegis-bg-elevated"
            >
              Change Email
            </button>
            <button
              onClick={() => { if (code.length === 6) verify.mutate({ code }); }}
              disabled={verify.isPending || code.length < 6}
              className="flex-1 py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verify.isPending ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : "Verify Code"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => resendCode.mutate()}
              disabled={resendCode.isPending || resendTimer > 0}
              className="text-xs text-aegis-accent-purple hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {resendCode.isPending ? "Sending…" : resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
            </button>
            <button
              onClick={() => { setStep("idle"); setCode(""); setErrorMsg(null); }}
              className="text-xs text-aegis-tertiary-dark hover:text-aegis-secondary-dark"
            >
              Use different email
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── KYC Section (functional) ──────────────────────────────────────
const ID_TYPES = [
  { value: "NIN",              label: "NIN (National ID Number)" },
  { value: "BVN",              label: "BVN (Bank Verification Number)" },
  { value: "PASSPORT",         label: "International Passport" },
  { value: "DRIVERS_LICENSE",  label: "Driver's License" },
] as const;

function KycSection() {
  const { user } = useCurrentUser();
  const [open, setOpen]           = useState(false);
  const [fullName, setFullName]   = useState("");
  const [idType, setIdType]       = useState<typeof ID_TYPES[number]["value"]>("NIN");
  const [idNumber, setIdNumber]   = useState("");
  const [dob, setDob]             = useState("");
  const [country, setCountry]     = useState(localStorage.getItem("aegis_country") ?? "NG");
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null);

  const submitKyc = trpc.auth.submitKyc.useMutation({
    onSuccess: (data) => {
      setMsg({ text: data.message, ok: true });
      setOpen(false);
      queryClient.invalidateQueries();
    },
    onError: (e) => setMsg({ text: e.message, ok: false }),
  });

  const status = user?.kycStatus ?? "NONE";

  const statusBadge = {
    VERIFIED: { label: "Verified ✓", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    PENDING:  { label: "Under Review", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    NONE:     { label: "Not Started", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  }[status] ?? { label: "Not Started", color: "bg-gray-100 text-gray-600" };

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
          <BadgeCheck size={16} className="text-aegis-accent-purple" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">KYC Verification</p>
          <p className="text-xs text-aegis-tertiary-dark mt-0.5">Verify your identity to unlock all features</p>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge.color}`}>
          {statusBadge.label}
        </span>
      </div>

      {status === "NONE" || status === "REJECTED" ? (
        <>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium"
            >
              {status === "REJECTED" ? "Re-submit Identity" : "Start Identity Verification"}
            </button>
          ) : (
            <div className="space-y-3 border border-border rounded-xl p-4 bg-aegis-bg-elevated">
              <p className="text-xs font-semibold text-aegis-secondary-dark uppercase tracking-wide">Identity Details</p>

              <input
                type="text"
                placeholder="Full legal name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-card text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
              />

              <div className="relative">
                <select
                  value={idType}
                  onChange={e => setIdType(e.target.value as any)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-card text-aegis-primary-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30 appearance-none"
                >
                  {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3.5 text-aegis-tertiary-dark pointer-events-none" />
              </div>

              <input
                type="text"
                placeholder="ID number"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-card text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
              />

              <div>
                <label className="text-xs text-aegis-tertiary-dark mb-1 block">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-card text-aegis-primary-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
                />
              </div>

              {msg && (
                <p className={`flex items-center gap-1.5 text-xs ${msg.ok ? "text-green-500" : "text-red-500"}`}>
                  {msg.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {msg.text}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setOpen(false); setMsg(null); }}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm text-aegis-secondary-dark hover:bg-card"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!fullName || !idNumber || !dob) { setMsg({ text: "All fields required", ok: false }); return; }
                    submitKyc.mutate({ fullName, idType, idNumber, dateOfBirth: dob, country });
                  }}
                  disabled={submitKyc.isPending}
                  className="flex-1 py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitKyc.isPending ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : "Submit"}
                </button>
              </div>
            </div>
          )}
        </>
      ) : status === "PENDING" ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30">
          <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-400">Your documents are under review. This usually takes 1–2 business days.</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useCurrentUser();
  const { linkedWallets } = useWallets();
  const [darkMode, setDarkMode]           = useState(document.documentElement.classList.contains("dark"));
  const [notificationsOn, setNotifications] = useState(true);
  const [recoveryWallet, setRecoveryWallet] = useState("");
  const [recoveryMsg, setRecoveryMsg]     = useState<string | null>(null);

  const setRecoveryMut = trpc.accounts.setRecovery.useMutation({
    onSuccess: () => setRecoveryMsg("Recovery wallet saved ✓"),
    onError: (e) => setRecoveryMsg(`Error: ${e.message}`),
  });
  const removeMut = trpc.accounts.removeWallet.useMutation({
    onSuccess: () => queryClient.invalidateQueries(),
  });

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // The embedded Aegis wallet address (non-removable)
  const aegisWalletAddress = user?.walletAddress?.toLowerCase();

  function handleSetRecovery() {
    if (!recoveryWallet.trim()) return;
    // Block using the Aegis embedded wallet as recovery address
    if (aegisWalletAddress && recoveryWallet.trim().toLowerCase() === aegisWalletAddress) {
      setRecoveryMsg("Your Aegis wallet cannot be used as a recovery address. Please use an external wallet.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(recoveryWallet.trim())) {
      setRecoveryMsg("Invalid wallet address. Must be a valid 0x EVM address.");
      return;
    }
    setRecoveryMut.mutate({ recoveryWallet: recoveryWallet.trim() });
  }

  return (
    <div className="space-y-5 pb-24 lg:pb-4">
      {/* Email verification banner */}
      {!user?.emailVerified && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={15} className="text-yellow-500 flex-shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-400 truncate">
              Verify your email to unlock $10,000/day limits and account recovery.
            </p>
          </div>
          <a href="#email-verify" className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 whitespace-nowrap underline flex-shrink-0">
            Verify now →
          </a>
        </div>
      )}

      {/* Appearance */}
      <Section title="Appearance">
        <SettingRow
          icon={darkMode ? Moon : Sun}
          label="Dark Mode"
          description="Toggle between light and dark theme"
          action={<Toggle on={darkMode} onToggle={toggleDark} />}
        />
        <SettingRow
          icon={Bell}
          label="Notifications"
          description="Rate alerts and transaction updates"
          action={<Toggle on={notificationsOn} onToggle={() => setNotifications(n => !n)} />}
        />
      </Section>

      {/* Security */}
      <Section title="Security">
        <SettingRow
          icon={KeyRound}
          label="Passkey (Biometric)"
          description="Face ID / Fingerprint registered"
          badge="Active"
          badgeColor="green"
        />
        <KycSection />
      </Section>

      {/* Email Verification — LIVE */}
      <div id="email-verify">
        <Section title="Email Verification">
          <EmailVerification />
        </Section>
      </div>

      {/* Wallet Details */}
      <Section title="Connected Wallets">
        {linkedWallets.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <Wallet size={32} className="mx-auto mb-2 text-aegis-tertiary-dark" />
            <p className="text-sm text-aegis-tertiary-dark">No wallets connected yet</p>
            <p className="text-xs text-aegis-tertiary-dark mt-1">Go to Wallets and connect an EVM address</p>
          </div>
        ) : (
          linkedWallets.map((w) => {
            const isEmbedded = (w as any).type === "EMBEDDED";
            return (
              <div key={w.id} className="px-5 py-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                  <Wallet size={16} className="text-aegis-accent-purple" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{w.label ?? "My Wallet"}</p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-aegis-bg-elevated text-aegis-tertiary-dark">
                      {isEmbedded ? "AEGIS" : "EXTERNAL"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-mono text-aegis-tertiary-dark">{shorten(w.address)}</p>
                    <CopyButton text={w.address} />
                    <a
                      href={`https://bscscan.com/address/${w.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors"
                    >
                      <ExternalLink size={12} className="text-aegis-tertiary-dark" />
                    </a>
                  </div>
                </div>
                {/* Aegis embedded wallet is non-removable */}
                {!isEmbedded && (
                  <button
                    onClick={() => removeMut.mutate({ walletId: w.id })}
                    className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex-shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })
        )}
      </Section>

      {/* Recovery Wallet */}
      <Section title="Recovery">
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-aegis-accent-purple" />
            </div>
            <div>
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Recovery Wallet</p>
              <p className="text-xs text-aegis-tertiary-dark mt-0.5">Set an external wallet to recover your account</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30">
            <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-1.5">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              Your Aegis wallet cannot be used as a recovery address. Use an external hardware or software wallet.
            </p>
          </div>
          <input
            type="text"
            value={recoveryWallet}
            onChange={e => setRecoveryWallet(e.target.value)}
            placeholder="0x... recovery address"
            className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-border bg-aegis-bg-elevated text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          {recoveryMsg && (
            <p className={`text-xs flex items-center gap-1.5 ${recoveryMsg.startsWith("Error") || recoveryMsg.includes("cannot") ? "text-red-500" : "text-green-500"}`}>
              {recoveryMsg.startsWith("Error") || recoveryMsg.includes("cannot")
                ? <XCircle size={12} />
                : <CheckCircle2 size={12} />}
              {recoveryMsg}
            </p>
          )}
          <button
            onClick={handleSetRecovery}
            disabled={setRecoveryMut.isPending || !recoveryWallet.trim()}
            className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {setRecoveryMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Recovery Wallet"}
          </button>
        </div>
      </Section>
    </div>
  );
}
