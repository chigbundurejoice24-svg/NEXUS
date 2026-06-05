import { motion } from "framer-motion";
import { User, Mail, Phone, Shield, BadgeCheck, Settings, ChevronRight, Star, Wallet } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWallets } from "@/hooks/useWallets";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const KYC_LABELS: Record<string, { label: string; color: string }> = {
  NONE:     { label: "Not Verified",  color: "text-aegis-tertiary-dark" },
  PENDING:  { label: "Pending",       color: "text-yellow-500" },
  VERIFIED: { label: "Verified",      color: "text-aegis-success-green" },
  REJECTED: { label: "Rejected",      color: "text-red-500" },
};

export default function Profile() {
  const { user, isLoading } = useCurrentUser();
  const { linkedWallets, totalValueUsd, totalWallets } = useWallets();
  const navigate = useNavigate();

  const kyc = KYC_LABELS[user?.kycStatus ?? "NONE"] ?? KYC_LABELS.NONE;
  const initials = user?.name
    ? user.name.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "A";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 lg:pb-0">
      {/* Avatar */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
        className="bg-card border border-border rounded-xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {isLoading ? "?" : initials}
        </div>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <><Skeleton className="h-5 w-32 mb-2"/><Skeleton className="h-3.5 w-48"/></>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-aegis-primary-dark dark:text-white truncate">{user?.name ?? "Aegis User"}</h2>
              <p className="text-sm text-aegis-tertiary-dark truncate">{user?.email ?? "No email set"}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs font-medium ${kyc.color}`}>{kyc.label}</span>
                {user?.emailVerified && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium">Email ✓</span>
                )}
              </div>
            </>
          )}
        </div>
        <button onClick={() => navigate("/settings")}
          className="p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors flex-shrink-0">
          <Settings size={18} className="text-aegis-tertiary-dark"/>
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Value", value: isLoading ? "—" : `$${Number(totalValueUsd).toLocaleString("en-US",{minimumFractionDigits:2})}` },
          { label: "Wallets",     value: isLoading ? "—" : String(totalWallets) },
          { label: "KYC Status",  value: isLoading ? "—" : (user?.kycStatus ?? "NONE") },
        ].map((s, i) => (
          <motion.div key={i} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
            className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-lg font-bold text-aegis-primary-dark dark:text-white">{s.value}</p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Account Details */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.1}}
        className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
        <div className="px-5 py-3 bg-aegis-bg-elevated">
          <h3 className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider">Account Details</h3>
        </div>
        {[
          { icon: User,      label: "Display Name", value: user?.name ?? "Not set" },
          { icon: Mail,      label: "Email",        value: user?.email ?? "Not set" },
          { icon: Shield,    label: "Account ID",   value: user?.id ? `#${user.id}` : "—" },
          { icon: BadgeCheck,label: "KYC",          value: user?.kycStatus ?? "NONE" },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <row.icon size={15} className="text-aegis-tertiary-dark flex-shrink-0"/>
            <p className="text-xs text-aegis-tertiary-dark w-28 flex-shrink-0">{row.label}</p>
            <p className="text-sm text-aegis-primary-dark dark:text-white flex-1 truncate">{isLoading ? "…" : row.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Wallets */}
      {linkedWallets.length > 0 && (
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.15}}
          className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-aegis-bg-elevated flex items-center justify-between">
            <h3 className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider">Wallets</h3>
            <button onClick={() => navigate("/wallets")} className="text-xs text-aegis-accent-purple hover:opacity-80">Manage</button>
          </div>
          <div className="divide-y divide-border">
            {linkedWallets.slice(0,3).map((w, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-7 h-7 rounded-lg bg-[#5B3CF5]/10 flex items-center justify-center flex-shrink-0">
                  <Wallet size={13} className="text-[#5B3CF5]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium dark:text-white truncate">{w.label ?? "Wallet"}</p>
                  <p className="text-xs font-mono text-aegis-tertiary-dark truncate">{w.address.slice(0,10)}...{w.address.slice(-6)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Edit Profile CTA */}
      <button onClick={() => navigate("/settings")}
        className="w-full py-3 bg-card border border-border rounded-xl text-sm text-aegis-accent-purple font-medium flex items-center justify-center gap-2 hover:bg-aegis-bg-elevated transition-colors">
        <Settings size={15}/> Edit Profile & Settings
      </button>
    </div>
  );
}
