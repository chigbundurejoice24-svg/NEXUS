import { useState } from "react";
import {
  Shield, Wallet, Bell, Moon, Sun,
  BadgeCheck, KeyRound, Copy, Check, ExternalLink,
  Mail, Loader2, CheckCircle2, XCircle,
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

  const sendCode = trpc.auth.sendVerificationCode.useMutation({
    onSuccess: () => { setStep("sent"); setErrorMsg(null); },
    onError: (e) => setErrorMsg(e.message),
  });

  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        setStep("verified");
        setErrorMsg(null);
        // Refresh user data so badge updates everywhere
        queryClient.invalidateQueries();
      }
    },
    onError: (e) => setErrorMsg(e.message),
  });

  // Already verified — just show status
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

      {/* Step 1 — Enter email */}
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
            onClick={() => {
              if (email.trim()) sendCode.mutate({ email: email.trim() });
            }}
            disabled={sendCode.isPending || !email.trim()}
            className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sendCode.isPending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : "Send Verification Code"}
          </button>
        </>
      )}

      {/* Step 2 — Enter 6-digit code */}
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
          <button
            onClick={() => { if (email) sendCode.mutate({ email }); }}
            disabled={sendCode.isPending}
            className="text-xs text-aegis-accent-purple hover:opacity-80 underline w-full text-center"
          >
            Resend code
          </button>
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useCurrentUser();
  const { linkedWallets } = useWallets();
  const [darkMode, setDarkMode]         = useState(document.documentElement.classList.contains("dark"));
  const [notifications, setNotifications] = useState(true);
  const [recoveryWallet, setRecoveryWallet] = useState("");
  const [recoveryMsg, setRecoveryMsg]   = useState<string | null>(null);

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
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark">Manage your account settings</p>

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
          action={<Toggle on={notifications} onToggle={() => setNotifications(!notifications)} />}
        />
      </Section>

      {/* Security */}
      <Section title="Security">
        <SettingRow
          icon={KeyRound}
          label="Passkey"
          description={user?.credentialId ? "Passkey active — biometric sign-in enabled" : "Passkey registered"}
          badge="Active"
          badgeColor="green"
        />
        <SettingRow
          icon={BadgeCheck}
          label="KYC Verification"
          description={`Identity status: ${user?.kycStatus ?? "Not started"}`}
          badge={user?.kycStatus === "VERIFIED" ? "Verified" : "Pending"}
          badgeColor={user?.kycStatus === "VERIFIED" ? "green" : "yellow"}
        />
      </Section>

      {/* Email Verification — LIVE */}
      <Section title="Email Verification">
        <EmailVerification />
      </Section>

      {/* Wallet Details */}
      <Section title="Connected Wallets">
        {linkedWallets.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <Wallet size={32} className="mx-auto mb-2 text-aegis-tertiary-dark" />
            <p className="text-sm text-aegis-tertiary-dark">No wallets connected yet</p>
            <p className="text-xs text-aegis-tertiary-dark mt-1">Go to Wallets and connect an EVM address</p>
          </div>
        ) : (
          linkedWallets.map((w) => (
            <div key={w.id} className="px-5 py-4 flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                <Wallet size={16} className="text-aegis-accent-purple" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{w.label ?? "My Wallet"}</p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-aegis-bg-elevated text-aegis-tertiary-dark">
                    {(w as any).type ?? "External"}
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
                    title="View on BscScan"
                  >
                    <ExternalLink size={12} className="text-aegis-tertiary-dark" />
                  </a>
                </div>
              </div>
              <button
                onClick={() => removeMut.mutate({ walletId: (w as any).id })}
                disabled={removeMut.isPending}
                className="text-xs text-red-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </Section>

      {/* Recovery wallet */}
      <Section title="Recovery">
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-aegis-accent-purple" />
            </div>
            <div>
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Recovery Wallet</p>
              <p className="text-xs text-aegis-tertiary-dark mt-0.5">Set a backup wallet address to recover your account</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="0x... recovery address"
            value={recoveryWallet}
            onChange={(e) => setRecoveryWallet(e.target.value)}
            className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-border bg-aegis-bg-elevated text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          {recoveryMsg && (
            <p className={`text-xs ${recoveryMsg.startsWith("Error") ? "text-red-500" : "text-green-500"}`}>
              {recoveryMsg}
            </p>
          )}
          <button
            onClick={() => {
              if (recoveryWallet.trim()) {
                setRecoveryMut.mutate({ address: recoveryWallet.trim() });
              }
            }}
            disabled={setRecoveryMut.isPending || !recoveryWallet.trim()}
            className="w-full py-2.5 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {setRecoveryMut.isPending ? "Saving..." : "Save Recovery Wallet"}
          </button>
        </div>
      </Section>
    </div>
  );
}
