/**
 * AdminConsole.tsx — Real admin dashboard
 * - Stats from tRPC (real user/tx counts)
 * - User list from tRPC
 * - Transactions list from tRPC
 * - Support tickets
 * - Broadcast notifications
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Users, Receipt, TrendingUp, Flag, Shield, RefreshCw, Search,
  ChevronRight, Loader2, Megaphone, Send, Bell,
  CheckCircle, Clock, XCircle, AlertTriangle, LifeBuoy,
} from "lucide-react";

type Tab = "overview" | "users" | "transactions" | "support" | "broadcast";

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-500/20 text-blue-400",
  IN_PROGRESS: "bg-yellow-500/20 text-yellow-400",
  RESOLVED:    "bg-green-500/20 text-green-400",
  CLOSED:      "bg-gray-500/20 text-gray-400",
  SETTLED:     "bg-green-500/20 text-green-400",
  PENDING:     "bg-yellow-500/20 text-yellow-400",
  FAILED:      "bg-red-500/20 text-red-400",
  CANCELLED:   "bg-gray-500/20 text-gray-400",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color ?? "bg-gray-500/20 text-gray-400"}`}>{label}</span>;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-aegis-primary-dark dark:text-white">{value}</p>
      <p className="text-xs text-aegis-tertiary-dark mt-0.5">{label}</p>
    </div>
  );
}

function BroadcastPanel() {
  const [title, setTitle]           = useState("");
  const [body, setBody]             = useState("");
  const [type, setType]             = useState<"BROADCAST"|"SYSTEM"|"PROMO">("BROADCAST");
  const [mode, setMode]             = useState<"all"|"user">("all");
  const [targetUserId, setTargetUserId] = useState("");
  const utils = trpc.useUtils();
  const broadcast  = trpc.notify.broadcast.useMutation({ onSuccess: () => { setTitle(""); setBody(""); utils.notify.list.invalidate(); } });
  const sendToUser = trpc.notify.sendToUser.useMutation({ onSuccess: () => { setTitle(""); setBody(""); setTargetUserId(""); } });
  const isPending = broadcast.isPending || sendToUser.isPending;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 max-w-lg">
      <h3 className="font-semibold flex items-center gap-2 text-aegis-primary-dark dark:text-white">
        <Megaphone size={16} className="text-yellow-400"/> Send Notification
      </h3>
      <div className="flex gap-2">
        {(["all","user"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode===m ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
            {m === "all" ? "All Users" : "Specific User"}
          </button>
        ))}
      </div>
      {mode === "user" && (
        <input value={targetUserId} onChange={e => setTargetUserId(e.target.value)} placeholder="User ID"
          className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
      )}
      <div className="flex gap-2 flex-wrap">
        {(["BROADCAST","SYSTEM","PROMO"] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${type===t ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
            {t}
          </button>
        ))}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
        className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Message..."
        className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] resize-none dark:text-white"/>
      <button onClick={() => mode==="all" ? broadcast.mutate({title,body,type}) : sendToUser.mutate({userId:Number(targetUserId),title,body,type})}
        disabled={!title.trim()||!body.trim()||isPending}
        className="w-full py-3 gradient-brand text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {isPending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
        {mode==="all" ? "Broadcast to All" : "Send to User"}
      </button>
      {broadcast.isSuccess && <p className="text-xs text-green-400 text-center">✅ Broadcast sent</p>}
      {sendToUser.isSuccess && <p className="text-xs text-green-400 text-center">✅ Notification sent</p>}
    </div>
  );
}

function SupportPanel() {
  const [selected, setSelected] = useState<number|null>(null);
  const [reply, setReply]       = useState("");
  const utils = trpc.useUtils();
  const { data: tickets, isLoading } = trpc.support.listAllTickets.useQuery({ limit: 100, offset: 0, status: "ALL" });
  const { data: detail } = trpc.support.getTicket.useQuery({ ticketId: selected! }, { enabled: !!selected });
  const addReply     = trpc.support.addReply.useMutation({ onSuccess: () => { setReply(""); utils.support.getTicket.invalidate({ ticketId: selected! }); } });
  const updateStatus = trpc.support.updateStatus.useMutation({ onSuccess: () => utils.support.listAllTickets.invalidate() });

  if (selected && detail) {
    const { ticket, replies } = detail;
    return (
      <div className="space-y-4 max-w-lg">
        <button onClick={() => setSelected(null)} className="text-xs text-aegis-tertiary-dark hover:text-white flex items-center gap-1">← Back</button>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm dark:text-white">{ticket.subject}</p>
            <Badge label={ticket.status} color={STATUS_COLORS[ticket.status]}/>
          </div>
          <p className="text-xs text-aegis-tertiary-dark">User #{ticket.userId} · #{ticket.id}</p>
          <p className="text-sm text-aegis-secondary-dark border-t border-border pt-2">{ticket.message}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const).map(s => (
            <button key={s} disabled={ticket.status===s||updateStatus.isPending}
              onClick={() => updateStatus.mutate({ticketId:ticket.id,status:s})}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${ticket.status===s ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
              {s.replace("_"," ")}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {[...replies].reverse().map(r => (
            <div key={r.id} className={`rounded-xl p-3 ${r.isAdmin ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/30" : "bg-card border border-border"}`}>
              <p className={`text-xs font-semibold mb-1 ${r.isAdmin ? "text-[#5B3CF5]" : "dark:text-white"}`}>
                {r.isAdmin ? "🛡 Aegis Support" : `User #${r.userId}`}
              </p>
              <p className="text-sm text-aegis-secondary-dark">{r.message}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply as Aegis Support..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
          <button onClick={() => reply.trim() && addReply.mutate({ticketId:ticket.id,message:reply})}
            disabled={!reply.trim()||addReply.isPending}
            className="px-4 py-2.5 gradient-brand text-white rounded-xl disabled:opacity-50">
            {addReply.isPending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg">
      <h3 className="font-semibold dark:text-white">Support Tickets</h3>
      {isLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark"/>
        : !tickets?.length ? <p className="text-sm text-aegis-tertiary-dark">No tickets yet</p>
        : tickets.map(t => (
          <button key={t.id} onClick={() => setSelected(t.id)}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-[#5B3CF5]/50 transition-colors text-left">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold dark:text-white truncate">{t.subject}</p>
              <p className="text-xs text-aegis-tertiary-dark">#{t.id} · User #{t.userId} · {t.priority}</p>
            </div>
            <Badge label={t.status} color={STATUS_COLORS[t.status]}/>
            <ChevronRight size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
          </button>
        ))
      }
    </div>
  );
}

export default function AdminConsole() {
  const navigate = useNavigate();
  const { user, isLoading, isAdmin } = useCurrentUser();
  const [tab, setTab]       = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/", { replace: true });
  }, [isAdmin, isLoading, navigate]);

  // ── Real data from tRPC ─────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } =
    trpc.admin.stats.useQuery(undefined, { enabled: !!isAdmin, refetchOnMount: true });
  const { data: usersList, isLoading: usersLoading } =
    trpc.admin.listUsers.useQuery({ limit: 100, offset: 0 }, { enabled: !!isAdmin && tab === "users" });
  const { data: txList, isLoading: txLoading } =
    trpc.admin.listTransactions.useQuery({ limit: 100, offset: 0 }, { enabled: !!isAdmin && tab === "transactions" });

  const filteredUsers = (usersList ?? []).filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTx = (txList ?? []).filter(tx =>
    !txSearch || String(tx.id).includes(txSearch) || tx.state?.includes(txSearch.toUpperCase())
  );

  if (!isAdmin) return null;

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview",     label: "Overview",     icon: TrendingUp },
    { id: "users",        label: "Users",        icon: Users },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "support",      label: "Support",      icon: LifeBuoy },
    { id: "broadcast",    label: "Broadcast",    icon: Megaphone },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Shield size={20} className="text-red-400"/>
          </div>
          <div>
            <h2 className="text-lg font-bold text-aegis-primary-dark dark:text-white">Admin Console</h2>
            <p className="text-xs text-aegis-tertiary-dark">Cozanet Operations · Operator only</p>
          </div>
        </div>
        <button onClick={() => refetchStats()}
          className="p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <RefreshCw size={16} className="text-aegis-tertiary-dark"/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-aegis-bg-elevated rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${tab===t.id ? "bg-card text-aegis-primary-dark dark:text-white shadow-sm" : "text-aegis-tertiary-dark hover:text-aegis-secondary-dark"}`}>
            <t.icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center gap-2 text-aegis-tertiary-dark"><Loader2 size={16} className="animate-spin"/>Loading stats...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Total Users"        value={stats?.totalUsers ?? 0}        icon={Users}    color="bg-[#5B3CF5]/20 text-[#5B3CF5]"/>
              <StatCard label="Total Transactions" value={stats?.totalTransactions ?? 0} icon={Receipt}  color="bg-green-500/20 text-green-400"/>
              <StatCard label="Settled Volume"     value={`$${Number(stats?.settledVolume ?? 0).toLocaleString()}`} icon={TrendingUp} color="bg-yellow-500/20 text-yellow-400"/>
            </div>
          )}
        </div>
      )}

      {/* ── Users ── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-aegis-bg-elevated rounded-xl px-3 py-2">
            <Search size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
              className="bg-transparent text-sm flex-1 focus:outline-none dark:text-white placeholder:text-aegis-tertiary-dark"/>
          </div>
          {usersLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark"/>
            : !filteredUsers.length ? <p className="text-sm text-aegis-tertiary-dark">{search ? "No users match your search" : "No users yet"}</p>
            : (
              <div className="space-y-2">
                {filteredUsers.map(u => (
                  <div key={u.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {u.name?.charAt(0).toUpperCase() ?? "#"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold dark:text-white truncate">{u.name ?? `User #${u.id}`}</p>
                      <p className="text-xs text-aegis-tertiary-dark truncate">{u.email ?? "No email"} · ID #{u.id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge label={u.role ?? "user"} color={u.role==="admin" ? "bg-red-500/20 text-red-400" : "bg-[#5B3CF5]/20 text-[#5B3CF5]"}/>
                      <Badge label={u.kycStatus ?? "NONE"} color={u.kycStatus==="VERIFIED" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}/>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* ── Transactions ── */}
      {tab === "transactions" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-aegis-bg-elevated rounded-xl px-3 py-2">
            <Search size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
            <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search by ID or status..."
              className="bg-transparent text-sm flex-1 focus:outline-none dark:text-white placeholder:text-aegis-tertiary-dark"/>
          </div>
          {txLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark"/>
            : !filteredTx.length ? <p className="text-sm text-aegis-tertiary-dark">No transactions yet</p>
            : (
              <div className="space-y-2">
                {filteredTx.map((tx: any) => (
                  <div key={tx.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold dark:text-white">TX #{tx.id}</p>
                      <Badge label={tx.state ?? "UNKNOWN"} color={STATUS_COLORS[tx.state ?? ""] ?? "bg-gray-500/20 text-gray-400"}/>
                    </div>
                    <div className="flex items-center justify-between text-xs text-aegis-tertiary-dark">
                      <span>User #{tx.userId} · {tx.type ?? "TRANSFER"}</span>
                      <span>{tx.amountRaw ? `${(Number(tx.amountRaw)/1e6).toFixed(2)} USDT` : "—"}</span>
                    </div>
                    {tx.createdAt && <p className="text-xs text-aegis-tertiary-dark mt-1">{new Date(tx.createdAt).toLocaleString()}</p>}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {tab === "support"   && <SupportPanel/>}
      {tab === "broadcast" && <BroadcastPanel/>}
    </div>
  );
}
