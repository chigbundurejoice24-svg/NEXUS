import { useState } from "react";
import {
  Shield, Wallet, Bell, Moon, Sun,
  BadgeCheck, KeyRound, Copy, Check, ExternalLink,
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

// ── sub-components ────────────────────────────────────────────────
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
  icon: Icon,
  label,
  description,
  action,
  badge,
  badgeColor = "gray",
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

// ── Toggle ────────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useCurrentUser();
  const { linkedWallets } = useWallets();
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains("dark"));
  const [notifications, setNotifications] = useState(true);
  const [recoveryWallet, setRecoveryWallet] = useState("");
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);

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

      {/* Wallet Details */}
      <Section title="Wallet Details">
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
                    External
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-mono text-aegis-tertiary-dark">{shorten(w.address)}</p>
                  <CopyButton text={w.address} />
                  <a
                    href={`https://etherscan.io/address/${w.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors"
                    title="View on Etherscan"
                  >
                    <ExternalLink size={12} className="text-aegis-tertiary-dark" />
                  </a>
                </div>
                <p className="text-[11px] text-aegis-tertiary-dark">All chains · Polygon primary</p>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Security */}
      <Section title="Security">
        <SettingRow
          icon={KeyRound}
          label="Passkey"
          description={user?.credentialId ? "Passkey active — biometric sign-in enabled" : "No passkey set up yet"}
          badge={user?.credentialId ? "Active" : "Not Set"}
          badgeColor={user?.credentialId ? "green" : "gray"}
        />
        <SettingRow
          icon={BadgeCheck}
          label="KYC Verification"
          description={`Identity status: ${user?.kycStatus ?? "Not started"}`}
          badge={user?.kycStatus === "VERIFIED" ? "Verified" : "Unverified"}
          badgeColor={user?.kycStatus === "VERIFIED" ? "green" : "yellow"}
        />
        <SettingRow
          icon={Shield}
          label="Email Verification"
          description={user?.email ?? "No email on file"}
          badge={user?.emailVerified ? "Verified" : "Unverified"}
          badgeColor={user?.emailVerified ? "green" : "yellow"}
        />
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
