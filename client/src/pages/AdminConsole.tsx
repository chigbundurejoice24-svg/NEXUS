/**
 * AdminConsole.tsx — Admin-only dashboard
 * Access enforced server-side (email whitelist) + client-side (isAdmin flag)
 * No UI references to "admin" role visible to users through notifications
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Users, Receipt, TrendingUp, Flag, Shield, RefreshCw, Search,
  ChevronRight, Loader2, Megaphone, Send, Bell,
  CheckCircle, Clock, XCircle, AlertTriangle, LifeBuoy, Lock,
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
};

function Badge({ label, color }: { label: string; color?: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color ?? "bg-gray-500/20 text-gray-400"}`}>{label}</span>;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon size={18}/>
      </div>
      <p className="text-2xl font-bold dark:text-white">{value}</p>
      <p className="text-xs text-aegis-tertiary-dark mt-0.5">{label}</p>
    </div>
  );
}

// ── Broadcast panel ──────────────────────────────────────────────────────────
// ── Broadcast Panel ────────────────────────────────────────────────────────────
function BroadcastPanel() {
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [type, setType]         = useState<"BROADCAST"|"SYSTEM"|"PROMO">("BROADCAST");
  const [mode, setMode]         = useState<"all"|"aegisId">("all");
  const [aegisId, setAegisId]   = useState("");
  const [preview, setPreview]   = useState<{id:number;name:string|null;email:string|null;aegisId:string|null}|null>(null);
  const [lookupErr, setLookupErr] = useState("");

  const utils = trpc.useUtils();
  const broadcast  = trpc.notify.broadcast.useMutation({ onSuccess: () => { setTitle(""); setBody(""); } });
  const sendToUser = trpc.notify.sendToUser.useMutation({ onSuccess: () => { setTitle(""); setBody(""); setAegisId(""); setPreview(null); } });
  const lookup     = trpc.notify.lookupByAegisId.useQuery(
    { aegisId: aegisId.toUpperCase().trim() },
    { enabled: /^AEG-[A-Z0-9]{8}$/.test(aegisId.toUpperCase().trim()), retry: false }
  );

  // Update preview when lookup returns
  useEffect(() => {
    if (lookup.data) { setPreview(lookup.data as any); setLookupErr(""); }
    else if (lookup.error) { setPreview(null); setLookupErr("User not found"); }
    else if (!aegisId) { setPreview(null); setLookupErr(""); }
  }, [lookup.data, lookup.error, aegisId]);

  const isPending = broadcast.isPending || sendToUser.isPending;

  function send() {
    if (!title.trim() || !body.trim()) return;
    if (mode === "all") {
      broadcast.mutate({ title: title.trim(), body: body.trim(), type });
    } else {
      if (!preview) return;
      sendToUser.mutate({ aegisId: aegisId.toUpperCase().trim(), title: title.trim(), body: body.trim(), type });
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 max-w-lg">
      <h3 className="font-semibold flex items-center gap-2 dark:text-white">
        <Bell size={16} className="text-[#5B3CF5]"/> Send Notification
      </h3>

      {/* Recipient mode */}
      <div className="flex gap-2">
        {(["all","aegisId"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setPreview(null); setAegisId(""); }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode===m ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
            {m === "all" ? "📢 All Users" : "🎯 Specific User"}
          </button>
        ))}
      </div>

      {/* Aegis ID input with live lookup */}
      {mode === "aegisId" && (
        <div className="space-y-2">
          <div className="relative">
            <input
              value={aegisId}
              onChange={e => { setAegisId(e.target.value.toUpperCase()); setPreview(null); }}
              placeholder="AEG-XXXXXXXX"
              maxLength={12}
              className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"
            />
            {lookup.isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={14} className="animate-spin text-aegis-tertiary-dark"/>
              </div>
            )}
          </div>

          {/* Preview card */}
          {preview && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {preview.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-400">{preview.name ?? `User #${preview.id}`}</p>
                <p className="text-xs text-aegis-tertiary-dark">{preview.email ?? "No email"} · {preview.aegisId}</p>
              </div>
              <CheckCircle size={16} className="text-green-400 flex-shrink-0"/>
            </div>
          )}
          {lookupErr && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <XCircle size={12}/> {lookupErr}
            </p>
          )}
        </div>
      )}

      {/* Type */}
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

      <button
        onClick={send}
        disabled={!title.trim() || !body.trim() || isPending || (mode === "aegisId" && !preview)}
        className="w-full py-3 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
        {isPending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
        {mode === "all" ? "Broadcast to All Users" : preview ? `Send to ${preview.name ?? preview.aegisId}` : "Enter Aegis ID first"}
      </button>

      {broadcast.isSuccess  && <p className="text-xs text-green-400 text-center">✅ Broadcast delivered to all users</p>}
      {sendToUser.isSuccess  && <p className="text-xs text-green-400 text-center">✅ Notification delivered to {preview?.name ?? aegisId}</p>}
      {(broadcast.isError || sendToUser.isError) && (
        <p className="text-xs text-red-400 text-center">❌ {((broadcast.error ?? sendToUser.error) as any)?.message ?? "Failed"}</p>
      )}
    </div>
  );
}




// ── Support panel ────────────────────────────────────────────────────────────
function SupportPanel() {
  const [selected, setSelected] = useState<number|null>(null);
  const [reply, setReply]       = useState("");
  const utils = trpc.useUtils();
  const { data: tickets, isLoading } = trpc.support.listAllTickets.useQuery({ limit: 100, offset: 0, status: "ALL" });
  const { data: detail } = trpc.support.getTicket.useQuery({ ticketId: selected! }, { enabled: !!selected });
  const addReply     = trpc.support.addReply.useMutation({
    onSuccess: () => { setReply(""); utils.support.getTicket.invalidate({ ticketId: selected! }); },
  });
  const updateStatus = trpc.support.updateStatus.useMutation({
    onSuccess: () => utils.support.listAllTickets.invalidate(),
  });

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
          <p className="text-xs text-aegis-tertiary-dark">User #{ticket.userId} · Ticket #{ticket.id}</p>
          <p className="text-sm text-aegis-secondary-dark border-t border-border pt-2">{ticket.message}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const).map(s => (
            <button key={s} disabled={ticket.status===s || updateStatus.isPending}
              onClick={() => updateStatus.mutate({ ticketId: ticket.id, status: s })}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${ticket.status===s ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
              {s.replace("_"," ")}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {[...replies].reverse().map(r => (
            <div key={r.id} className={`rounded-xl p-3 ${r.isAdmin ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/30" : "bg-card border border-border"}`}>
              <p className={`text-xs font-semibold mb-1 ${r.isAdmin ? "text-[#5B3CF5]" : "dark:text-white"}`}>
                {r.isAdmin ? "Aegis Support" : `User #${r.userId}`}
              </p>
              <p className="text-sm text-aegis-secondary-dark">{r.message}</p>
              <p className="text-[10px] text-aegis-tertiary-dark mt-1">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply as Aegis Support…"
            className="flex-1 px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
          <button onClick={() => reply.trim() && addReply.mutate({ ticketId: ticket.id, message: reply })}
            disabled={!reply.trim() || addReply.isPending}
            className="px-4 py-2.5 gradient-brand text-white rounded-xl disabled:opacity-50">
            {addReply.isPending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg">
      <h3 className="font-semibold dark:text-white">All Support Tickets</h3>
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

// ── Main AdminConsole ────────────────────────────────────────────────────────
export default function AdminConsole() {
  const navigate = useNavigate();
  const { user, isLoading, isAdmin } = useCurrentUser();
  const [tab, setTab]       = useState<Tab>("overview");
  const [search, setSearch] = useState("");

  const { data: stats }    = trpc.admin.stats.useQuery(undefined, { enabled: isAdmin });
  const { data: userList } = trpc.admin.listUsers.useQuery({ limit: 100, offset: 0 }, { enabled: isAdmin && tab === "users" });
  const { data: txList }   = trpc.admin.listTransactions.useQuery({ limit: 50, offset: 0 }, { enabled: isAdmin && tab === "transactions" });

  // Loading
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-aegis-tertiary-dark"/>
    </div>
  );

  // Access denied
  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <Lock size={28} className="text-red-400"/>
      </div>
      <p className="text-base font-semibold dark:text-white">Access Restricted</p>
      <p className="text-sm text-aegis-tertiary-dark">You don't have permission to view this page.</p>
      <button onClick={() => navigate("/")} className="text-xs text-[#5B3CF5] hover:underline">← Go home</button>
    </div>
  );

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview",     label: "Overview",   icon: TrendingUp  },
    { id: "users",        label: "Users",      icon: Users       },
    { id: "transactions", label: "Tx",         icon: Receipt     },
    { id: "support",      label: "Support",    icon: LifeBuoy    },
    { id: "broadcast",    label: "Notify",     icon: Bell        },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                tab === t.id ? "bg-[#5B3CF5] text-white" : "bg-card border border-border text-aegis-tertiary-dark hover:text-aegis-secondary-dark"
              }`}>
              <Icon size={14}/> {t.label}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Total Users"        value={stats?.totalUsers ?? "—"}        icon={Users}      color="bg-blue-500/20 text-blue-400"/>
            <StatCard label="Transactions"       value={stats?.totalTransactions ?? "—"} icon={Receipt}    color="bg-purple-500/20 text-purple-400"/>
            <StatCard label="Settled Volume"     value={stats?.settledVolume ? `$${Number(BigInt(stats.settledVolume) / BigInt(1e18)).toLocaleString()}` : "—"} icon={TrendingUp} color="bg-green-500/20 text-green-400"/>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
          </div>
          {!userList ? <Loader2 size={18} className="animate-spin text-aegis-tertiary-dark"/> : (
            <div className="space-y-2">
              {userList
                .filter(u => !search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
                .map(u => (
                <div key={u.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#5B3CF5]/20 flex items-center justify-center text-xs font-bold text-[#5B3CF5] flex-shrink-0">
                    {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium dark:text-white truncate">{u.name ?? "—"}</p>
                    <p className="text-xs text-aegis-tertiary-dark truncate">{u.email ?? "No email"} · #{u.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge label={u.kycStatus} color={u.kycStatus === "VERIFIED" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}/>
                    <Badge label={u.role} color={u.role === "admin" ? "bg-[#5B3CF5]/20 text-[#5B3CF5]" : "bg-gray-500/20 text-gray-400"}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transactions */}
      {tab === "transactions" && (
        <div className="space-y-2">
          {!txList ? <Loader2 size={18} className="animate-spin text-aegis-tertiary-dark"/> : (
            txList.map(tx => (
              <div key={tx.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium dark:text-white truncate">{tx.referenceId ?? `#${tx.id}`}</p>
                  <p className="text-xs text-aegis-tertiary-dark">User #{tx.userId} · Chain {tx.chainId}</p>
                </div>
                <Badge label={tx.state} color={STATUS_COLORS[tx.state]}/>
              </div>
            ))
          )}
        </div>
      )}

      {/* Support */}
      {tab === "support" && <SupportPanel/>}

      {/* Broadcast */}
      {tab === "broadcast" && <BroadcastPanel/>}
    </div>
  );
}
