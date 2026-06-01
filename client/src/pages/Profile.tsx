import { motion } from "framer-motion";
import {
  User, Mail, Phone, Shield, BadgeCheck, Settings,
  ChevronRight, Star,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWallets } from "@/hooks/useWallets";
import { Skeleton } from "@/components/ui/skeleton";

const KYC_LABELS: Record<string, { label: string; color: string }> = {
  NONE:     { label: "Not Verified",  color: "text-aegis-tertiary-dark" },
  PENDING:  { label: "Pending",       color: "text-yellow-500" },
  VERIFIED: { label: "Verified",      color: "text-aegis-success-green" },
  REJECTED: { label: "Rejected",      color: "text-red-500" },
};

export default function Profile() {
  const { user, isLoading } = useCurrentUser();
  const { linkedWallets, totalValueUsd, totalWallets } = useWallets();

  const kyc = KYC_LABELS[user?.kycStatus ?? "NONE"] ?? KYC_LABELS.NONE;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 lg:pb-0">
      {/* Avatar + Name */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6 flex items-center gap-5"
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {isLoading ? "?" : (user?.name?.charAt(0).toUpperCase() ?? "A")}
        </div>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-36 mb-2 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-aegis-primary-dark dark:text-white truncate">
                {user?.name ?? "Anonymous"}
              </h2>
              <p className="text-sm text-aegis-tertiary-dark truncate">{user?.email ?? "—"}</p>
            </>
          )}
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${kyc.color}`}>
            <BadgeCheck size={13} />
            {kyc.label}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Wallets", value: totalWallets },
          { label: "Portfolio", value: `$${parseFloat(totalValueUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
          { label: "KYC", value: user?.kycStatus ?? "NONE" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-lg font-semibold text-aegis-primary-dark dark:text-white">{stat.value}</p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {[
          { icon: User,   label: "Full Name",    value: user?.name ?? "—" },
          { icon: Mail,   label: "Email",        value: user?.email ?? "—" },
          { icon: Shield, label: "Account Role", value: user?.role ?? "user" },
          { icon: Star,   label: "KYC Status",   value: user?.kycStatus ?? "NONE" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-aegis-accent-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-aegis-tertiary-dark">{label}</p>
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white truncate capitalize">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Passkey info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center">
              <Shield size={16} className="text-aegis-accent-purple" />
            </div>
            <div>
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Passkey Auth</p>
              <p className="text-xs text-aegis-tertiary-dark">
                {user?.credentialId ? "Passkey registered" : "No passkey set up yet"}
              </p>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${user?.credentialId ? "bg-aegis-success-green" : "bg-aegis-tertiary-dark"}`} />
        </div>
      </div>

      <p className="text-xs text-center text-aegis-tertiary-dark">
        Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
      </p>
    </div>
  );
}
