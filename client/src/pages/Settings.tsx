import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, Wallet, Bell, Moon, Sun, ChevronRight,
  BadgeCheck, KeyRound, Trash2, Plus,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWallets } from "@/hooks/useWallets";
import { trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/queryClient";

export default function Settings() {
  const { user } = useCurrentUser();
  const { linkedWallets } = useWallets();
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );
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
          action={
            <button
              onClick={toggleDark}
              className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? "bg-aegis-accent-purple" : "bg-border"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-5" : ""}`}
              />
            </button>
          }
        />
        <SettingRow
          icon={Bell}
          label="Notifications"
          description="Enable rate alerts and transaction updates"
          action={
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifications ? "bg-aegis-accent-purple" : "bg-border"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifications ? "translate-x-5" : ""}`}
              />
            </button>
          }
        />
      </Section>

      {/* Security */}
      <Section title="Security">
        <SettingRow
          icon={KeyRound}
          label="Passkey"
          description={user?.credentialId ? "Passkey registered — you can sign in without a password" : "No passkey set up — available in next release"}
          badge={user?.credentialId ? "Active" : "Coming Soon"}
          badgeColor={user?.credentialId ? "green" : "gray"}
        />
        <SettingRow
          icon={BadgeCheck}
          label="KYC Verification"
          description={`Status: ${user?.kycStatus ?? "NONE"}`}
          badge={user?.kycStatus === "VERIFIED" ? "Verified" : user?.kycStatus ?? "NONE"}
          badgeColor={user?.kycStatus === "VERIFIED" ? "green" : "yellow"}
        />
      </Section>

      {/* Recovery */}
      <Section title="Account Recovery">
        <div className="p-4 space-y-3">
          <p className="text-xs text-aegis-tertiary-dark">
            Set a recovery wallet address. If you lose access to your passkey, this EVM address can be used to regain access.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0x recovery wallet address"
              value={recoveryWallet}
              onChange={(e) => setRecoveryWallet(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-aegis-bg-elevated text-sm font-mono text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
            />
            <button
              onClick={() => setRecoveryMut.mutate({ recoveryWallet })}
              disabled={setRecoveryMut.isPending || !recoveryWallet}
              className="px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {setRecoveryMut.isPending ? "Saving..." : "Save"}
            </button>
          </div>
          {user?.recoveryWallet && (
            <p className="text-xs text-aegis-tertiary-dark">
              Current: <span className="font-mono text-aegis-accent-purple">{user.recoveryWallet}</span>
            </p>
          )}
          {recoveryMsg && (
            <p className={`text-xs ${recoveryMsg.startsWith("Error") ? "text-red-500" : "text-aegis-success-green"}`}>
              {recoveryMsg}
            </p>
          )}
        </div>
      </Section>

      {/* Linked Wallets */}
      <Section title="Linked Wallets">
        {linkedWallets.length === 0 ? (
          <div className="p-4 text-sm text-aegis-tertiary-dark text-center">No wallets connected yet</div>
        ) : (
          linkedWallets.map((lw, i) => (
            <div key={lw.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                <Wallet size={14} className="text-aegis-accent-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{lw.label ?? `Wallet ${i + 1}`}</p>
                <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{lw.address}</p>
              </div>
              <button
                onClick={() => removeMut.mutate({ walletId: lw.id })}
                disabled={removeMut.isPending}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={13} className="text-red-400" />
              </button>
            </div>
          ))
        )}
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <SettingRow
          icon={Trash2}
          label="Delete Account"
          description="Permanently delete your Aegis account and all data"
          action={
            <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors">
              Delete
            </button>
          }
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-aegis-bg-elevated">
        <h3 className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SettingRow({
  icon: Icon, label, description, action, badge, badgeColor,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  action?: React.ReactNode;
  badge?: string;
  badgeColor?: "green" | "yellow" | "gray";
}) {
  const badgeColors = {
    green:  "bg-green-50 dark:bg-green-900/20 text-aegis-success-green",
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500",
    gray:   "bg-aegis-bg-elevated text-aegis-tertiary-dark",
  };
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
      <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-aegis-accent-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{label}</p>
        <p className="text-xs text-aegis-tertiary-dark mt-0.5">{description}</p>
      </div>
      {badge ? (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColors[badgeColor ?? "gray"]}`}>
          {badge}
        </span>
      ) : action}
    </div>
  );
}
