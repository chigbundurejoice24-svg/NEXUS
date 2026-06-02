/**
 * AdminConsole.tsx — Admin dashboard for Aegis operators
 * Accessible only to users with role === 'admin'
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Receipt, TrendingUp, Flag, Shield, RefreshCw, Search, ChevronRight, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUnits } from "viem";

type Tab = "overview" | "users" | "transactions";

export default function AdminConsole() {
  const [tab, setTab] = useState<Tab>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [flagReason, setFlagReason] = useState("");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = (trpc as any).admin.stats.useQuery(undefined, { retry: false });
  const { data: users, isLoading: usersLoading } = (trpc as any).admin.listUsers.useQuery({ limit: 100, offset: 0 }, { enabled: tab === "users" });
  const { data: txs, isLoading: txsLoading } = (trpc as any).admin.listTransactions.useQuery({ limit: 100, offset: 0 }, { enabled: tab === "transactions" });
  const flagMutation = (trpc as any).admin.flagUser.useMutation();

  // Check if not admin (stats will fail with UNAUTHORIZED)
  const isUnauthorized = !statsLoading && !stats;

  if (isUnauthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Shield size={48} className="text-aegis-tertiary-dark" />
        <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Admin Access Required</h2>
        <p className="text-sm text-aegis-secondary-dark">Your account does not have admin privileges.</p>
      </div>
    );
  }

  const filteredUsers = (users ?? []).filter((u: any) =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleFlag = async (userId: number) => {
    if (!flagReason.trim()) return;
    await flagMutation.mutateAsync({ userId, reason: flagReason });
    setFlagReason(""); setSelectedUser(null);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-aegis-secondary-dark">Platform monitoring & management</p>
        </div>
        <button onClick={() => refetchStats()} className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark hover:text-aegis-accent-purple transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-aegis-bg-elevated dark:bg-gray-800/50 rounded-xl p-1">
        {(["overview", "users", "transactions"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize ${tab === t ? "bg-white dark:bg-gray-700 text-aegis-accent-purple shadow-sm" : "text-aegis-secondary-dark"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Users",         icon: Users,    value: statsLoading ? null : stats?.totalUsers,         color: "text-aegis-accent-purple" },
              { label: "Total Transactions",  icon: Receipt,  value: statsLoading ? null : stats?.totalTransactions,   color: "text-aegis-accent-blue" },
              { label: "Settled Volume (raw)",icon: TrendingUp,value: statsLoading ? null : stats?.settledVolume,       color: "text-aegis-success-green" },
            ].map(({ label, icon: Icon, value, color }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={16} className={color} />
                  <span className="text-xs text-aegis-tertiary-dark uppercase tracking-wider">{label}</span>
                </div>
                {value == null ? <Skeleton className="h-8 w-24" /> : (
                  <p className="text-2xl font-semibold text-aegis-primary-dark dark:text-white font-mono">
                    {typeof value === "string" ? value : value.toLocaleString()}
                  </p>
                )}
              </motion.div>
            ))}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Admin Console Active</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">You have full visibility into all user data. Use responsibly.</p>
            </div>
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30 transition-all" />
          </div>

          {usersLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {filteredUsers.map((u: any, i: number) => (
                <div key={u.id} className={`flex items-center gap-4 p-4 hover:bg-aegis-bg-elevated transition-colors cursor-pointer ${i > 0 ? "border-t border-border" : ""}`}
                  onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-aegis-accent-purple to-aegis-accent-blue flex items-center justify-center text-white text-sm font-semibold">
                    {(u.name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-aegis-primary-dark dark:text-white truncate">{u.name ?? "—"}</p>
                    <p className="text-xs text-aegis-tertiary-dark truncate">{u.email ?? `User #${u.id}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-purple-100 text-aegis-accent-purple" : "bg-gray-100 text-aegis-secondary-dark"}`}>
                      {u.role}
                    </span>
                    <ChevronRight size={14} className="text-aegis-tertiary-dark" />
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="text-center text-aegis-tertiary-dark text-sm py-8">No users found</p>}
            </div>
          )}

          {/* Flag panel */}
          {selectedUser && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2"><Flag size={14} className="text-red-500" /><span className="text-sm font-medium text-red-700 dark:text-red-400">Flag User #{selectedUser}</span></div>
              <input value={flagReason} onChange={e => setFlagReason(e.target.value)}
                placeholder="Reason for flagging…"
                className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none" />
              <button onClick={() => handleFlag(selectedUser)} disabled={!flagReason.trim() || flagMutation.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {flagMutation.isPending ? "Flagging…" : "Flag User"}
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* TRANSACTIONS */}
      {tab === "transactions" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {txsLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-none" />)
          ) : (txs ?? []).length === 0 ? (
            <p className="text-center text-aegis-tertiary-dark text-sm py-10">No transactions yet</p>
          ) : (txs ?? []).map((tx: any, i: number) => (
            <div key={tx.id} className={`flex items-center gap-4 p-4 hover:bg-aegis-bg-elevated transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white font-mono truncate">{tx.referenceId}</p>
                <p className="text-xs text-aegis-tertiary-dark">{tx.recipient?.slice(0,8)}… · Chain {tx.chainId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                  {tx.amountRaw ? parseFloat(formatUnits(BigInt(tx.amountRaw), tx.tokenDecimals ?? 6)).toFixed(2) : "?"} USDT
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  tx.state === "SETTLED" ? "bg-green-100 text-green-600" :
                  tx.state === "FAILED"  ? "bg-red-100 text-red-500" :
                  "bg-blue-100 text-blue-500"}`}>
                  {tx.state}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
