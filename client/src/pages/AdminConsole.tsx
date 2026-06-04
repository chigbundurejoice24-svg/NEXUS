/**
 * AdminConsole.tsx — Admin dashboard for Aegis operators
 * Tabs: Overview | Users | Transactions | Support | Broadcast
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useAuth';
import { trpc } from "@/lib/trpc";
import {
  Users, Receipt, TrendingUp, Flag, Shield, RefreshCw, Search,
  ChevronRight, AlertTriangle, LifeBuoy, Megaphone, Loader2,
  CheckCircle, Clock, XCircle, Send, Bell
} from "lucide-react";

type Tab = "overview" | "users" | "transactions" | "support" | "broadcast";

// ── Status badge helper ──────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-500/20 text-blue-400",
  IN_PROGRESS: "bg-yellow-500/20 text-yellow-400",
  RESOLVED:    "bg-green-500/20 text-green-400",
  CLOSED:      "bg-gray-500/20 text-gray-400",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color ?? "bg-gray-500/20 text-gray-400"}`}>
      {label}
    </span>
  );
}

// ── Broadcast Panel ──────────────────────────────────────────────
function BroadcastPanel() {
  const [title, setTitle] = useState("");
  const [body,  setBody]  = useState("");
  const [type, setType]   = useState<"BROADCAST"|"SYSTEM"|"PROMO">("BROADCAST");
  const [targetUserId, setTargetUserId] = useState("");
  const [mode, setMode]   = useState<"all"|"user">("all");
  const utils = trpc.useUtils();

  const broadcast   = trpc.notify.broadcast.useMutation({ onSuccess: () => { setTitle(""); setBody(""); utils.notify.list.invalidate(); } });
  const sendToUser  = trpc.notify.sendToUser.useMutation({ onSuccess: () => { setTitle(""); setBody(""); setTargetUserId(""); } });

  const send = () => {
    if (!title.trim() || !body.trim()) return;
    if (mode === "all") broadcast.mutate({ title, body, type });
    else sendToUser.mutate({ userId: Number(targetUserId), title, body, type });
  };

  const isPending = broadcast.isPending || sendToUser.isPending;
  const isError   = broadcast.error || sendToUser.error;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 max-w-lg">
      <h3 className="font-semibold text-aegis-primary-dark dark:text-white flex items-center gap-2">
        <Megaphone size={16} className="text-[#F5A623]" /> Send Notification
      </h3>

      <div className="flex gap-2">
        {(["all","user"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === m ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
            {m === "all" ? "Broadcast to All" : "Send to User"}
          </button>
        ))}
      </div>

      {mode === "user" && (
        <input value={targetUserId} onChange={e => setTargetUserId(e.target.value)}
          placeholder="User ID (number)"
          className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5]"
        />
      )}

      <div className="flex gap-2">
        {(["BROADCAST","SYSTEM","PROMO"] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${type === t ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
            {t}
          </button>
        ))}
      </div>

      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title..."
        className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5]" />

      <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Message body..."
        className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] resize-none" />

      {isError && <p className="text-xs text-red-400">{(broadcast.error ?? sendToUser.error)?.message}</p>}

      <button onClick={send} disabled={!title.trim() || !body.trim() || isPending}
        className="w-full py-3 gradient-brand text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {mode === "all" ? "Broadcast to All Users" : "Send to User"}
      </button>

      {broadcast.isSuccess && <p className="text-xs text-green-400 text-center">✅ Notification sent to all users</p>}
      {sendToUser.isSuccess && <p className="text-xs text-green-400 text-center">✅ Notification sent</p>}
    </div>
  );
}

// ── Support Panel ────────────────────────────────────────────────
function SupportPanel() {
  const [selected, setSelected] = useState<number | null>(null);
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
        <button onClick={() => setSelected(null)} className="text-xs text-aegis-tertiary-dark hover:text-white flex items-center gap-1">
          ← Back to tickets
        </button>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">{ticket.subject}</p>
            <Badge label={ticket.status} color={STATUS_COLORS[ticket.status]} />
          </div>
          <p className="text-xs text-aegis-tertiary-dark">User #{ticket.userId} · #{ticket.id}</p>
          <p className="text-sm text-aegis-secondary-dark border-t border-border pt-2 mt-2">{ticket.message}</p>
        </div>

        {/* Status controls */}
        <div className="flex gap-2 flex-wrap">
          {(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const).map(s => (
            <button key={s} disabled={ticket.status === s || updateStatus.isPending}
              onClick={() => updateStatus.mutate({ ticketId: ticket.id, status: s })}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${ticket.status === s ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark hover:border-[#5B3CF5]/50"}`}>
              {s.replace("_"," ")}
            </button>
          ))}
        </div>

        {/* Replies */}
        <div className="space-y-2">
          {[...replies].reverse().map(r => (
            <div key={r.id} className={`rounded-xl p-3 ${r.isAdmin ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/30" : "bg-card border border-border"}`}>
              <p className={`text-xs font-semibold mb-1 ${r.isAdmin ? "text-[#5B3CF5]" : "text-aegis-primary-dark dark:text-white"}`}>
                {r.isAdmin ? "🛡 Aegis Support (Admin)" : `User #${r.userId}`}
              </p>
              <p className="text-sm text-aegis-secondary-dark">{r.message}</p>
            </div>
          ))}
        </div>

        {/* Admin reply */}
        <div className="flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply as Aegis Support..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5]" />
          <button onClick={() => reply.trim() && addReply.mutate({ ticketId: ticket.id, message: reply })}
            disabled={!reply.trim() || addReply.isPending}
            className="px-4 py-2.5 gradient-brand text-white rounded-xl disabled:opacity-50">
            {addReply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg">
      <h3 className="font-semibold text-aegis-primary-dark dark:text-white">All Support Tickets</h3>
      {isLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark" /> :
        !tickets || tickets.length === 0 ? <p className="text-sm text-aegis-tertiary-dark">No tickets yet</p> :
        tickets.map(t => (
          <button key={t.id} onClick={() => setSelected(t.id)}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-[#5B3CF5]/50 transition-colors text-left">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white truncate">{t.subject}</p>
              <p className="text-xs text-aegis-tertiary-dark">#{t.id} · {t.userName ?? `User #${t.userId}`} · {t.priority}</p>
            </div>
            <Badge label={t.status} color={STATUS_COLORS[t.status]} />
            <ChevronRight size={14} className="text-aegis-tertiary-dark flex-shrink-0" />
          </button>
        ))
      }
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function AdminConsole() {
  const navigate = useNavigate();
  const { user, isLoading, isAdmin } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && !isAdmin) navigate("/", { replace: true });
  }, [user, isLoading, navigate]);

  if (!isAdmin) return null;

  const [tab, setTab] = useState<Tab>("overview");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [flagReason, setFlagReason] = useState("");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = (trpc as any).admin.stats.useQuery(undefined, { retry: false });
  const { data: usersData, isLoading: usersLoading } = (trpc as any).admin.listUsers.useQuery({ limit: 100, offset: 0 }, { enabled: tab === "users" });
  const { data: txs, isLoading: txsLoading } = (trpc as any).admin.listTransactions.useQuery({ limit: 100, offset: 0 }, { enabled: tab === "transactions" });
  const flagMutation = (trpc as any).admin.flagUser.useMutation();
  const setRole = (trpc as any).admin.setRole.useMutation();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview",     label: "Overview",     icon: TrendingUp },
    { id: "users",        label: "Users",         icon: Users },
    { id: "transactions", label: "Transactions",  icon: Receipt },
    { id: "support",      label: "Support",       icon: LifeBuoy },
    { id: "broadcast",    label: "Broadcast",     icon: Megaphone },
  ];

  const filteredUsers = (usersData ?? []).filter((u: any) =>
    !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-aegis-primary-dark dark:text-white flex items-center gap-2">
            <Shield size={20} className="text-[#5B3CF5]" /> Admin Console
          </h1>
          <p className="text-xs text-aegis-tertiary-dark mt-0.5">Full operator access — handle with care</p>
        </div>
        <button onClick={() => refetchStats?.()} className="p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <RefreshCw size={16} className="text-aegis-tertiary-dark" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-aegis-bg-elevated rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                tab === t.id ? "bg-[#5B3CF5] text-white" : "text-aegis-tertiary-dark hover:text-white"
              }`}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Users",        value: statsLoading ? "…" : stats?.totalUsers ?? 0,        icon: Users,    color: "text-blue-400" },
            { label: "Total Transactions", value: statsLoading ? "…" : stats?.totalTransactions ?? 0, icon: Receipt,  color: "text-yellow-400" },
            { label: "Settled Volume",     value: statsLoading ? "…" : `${(Number(stats?.settledVolume ?? 0) / 1e6).toFixed(2)} USDT`, icon: TrendingUp, color: "text-green-400" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-5 space-y-2">
                <Icon size={20} className={s.color} />
                <p className="text-2xl font-bold text-aegis-primary-dark dark:text-white">{s.value}</p>
                <p className="text-xs text-aegis-tertiary-dark">{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── USERS ── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5]"
            />
          </div>
          {usersLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark" /> :
            filteredUsers.map((u: any) => (
              <div key={u.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{u.name ?? "(no name)"}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{u.email ?? "no email"} · ID #{u.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={u.role?.toUpperCase() ?? "USER"} color={u.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-gray-500/20 text-gray-400"} />
                    <Badge label={u.kycStatus ?? "NONE"} />
                  </div>
                </div>
                {/* Admin actions */}
                <div className="flex gap-2 pt-1 border-t border-border flex-wrap">
                  <button
                    onClick={() => { const reason = prompt("Flag reason:"); if (reason) flagMutation.mutate({ userId: u.id, reason }); }}
                    className="text-xs px-2.5 py-1 rounded-lg border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                    <Flag size={10} className="inline mr-1" /> Flag
                  </button>
                  {u.role !== "admin" ? (
                    <button
                      onClick={() => { if (confirm(`Promote ${u.name ?? u.id} to admin?`)) setRole.mutate({ userId: u.id, role: "admin" }); }}
                      className="text-xs px-2.5 py-1 rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors">
                      <Shield size={10} className="inline mr-1" /> Make Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (confirm(`Revoke admin from ${u.name ?? u.id}?`)) setRole.mutate({ userId: u.id, role: "user" }); }}
                      className="text-xs px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                      <XCircle size={10} className="inline mr-1" /> Revoke Admin
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {tab === "transactions" && (
        <div className="space-y-3">
          {txsLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark" /> :
            (txs ?? []).map((tx: any) => (
              <div key={tx.id} className="bg-card border border-border rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-aegis-secondary-dark">#{tx.id} · Chain {tx.chainId}</p>
                  <Badge label={tx.state} color={tx.state === "SETTLED" ? "bg-green-500/20 text-green-400" : tx.state === "FAILED" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"} />
                </div>
                <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                  {(Number(BigInt(tx.amountRaw ?? "0")) / 10 ** (tx.tokenDecimals ?? 6)).toFixed(2)} USDT
                </p>
                <p className="text-xs text-aegis-tertiary-dark">User #{tx.userId} · {new Date(tx.createdAt).toLocaleString()}</p>
              </div>
            ))
          }
        </div>
      )}

      {/* ── SUPPORT ── */}
      {tab === "support" && <SupportPanel />}

      {/* ── BROADCAST ── */}
      {tab === "broadcast" && <BroadcastPanel />}
    </div>
  );
}
