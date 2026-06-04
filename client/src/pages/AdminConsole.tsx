/**
 * AdminConsole.tsx — Fully operational admin dashboard
 * Tabs: Overview | Users | KYC Queue | Transactions | Support | Broadcast
 * All actions hit real tRPC endpoints.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Users, Receipt, TrendingUp, Shield, RefreshCw, Search,
  ChevronRight, Loader2, Megaphone, Send, Bell,
  LifeBuoy, UserCheck, UserX, AlertTriangle, Flag,
  CheckCircle, XCircle, Clock, ChevronLeft, Eye,
} from "lucide-react";

type Tab = "overview" | "users" | "kyc" | "transactions" | "support" | "broadcast";

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-blue-500/20 text-blue-400",
  IN_PROGRESS: "bg-yellow-500/20 text-yellow-400",
  RESOLVED:    "bg-green-500/20 text-green-400",
  CLOSED:      "bg-gray-500/20 text-gray-400",
  SETTLED:     "bg-green-500/20 text-green-400",
  PENDING:     "bg-yellow-500/20 text-yellow-400",
  PENDING_SIGNATURE: "bg-yellow-500/20 text-yellow-400",
  FAILED:      "bg-red-500/20 text-red-400",
  CANCELLED:   "bg-gray-500/20 text-gray-400",
  CONFIRMED:   "bg-green-500/20 text-green-400",
  SUBMITTED:   "bg-blue-500/20 text-blue-400",
  CREATED:     "bg-gray-500/20 text-gray-400",
  NONE:        "bg-gray-500/20 text-gray-400",
  VERIFIED:    "bg-green-500/20 text-green-400",
  REJECTED:    "bg-red-500/20 text-red-400",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color ?? STATUS_COLORS[label] ?? "bg-gray-500/20 text-gray-400"}`}>
      {label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-aegis-primary-dark dark:text-white">{value}</p>
      <p className="text-xs text-aegis-tertiary-dark mt-0.5">{label}</p>
      {sub && <p className="text-xs text-aegis-tertiary-dark mt-0.5 opacity-60">{sub}</p>}
    </div>
  );
}

// ── User Detail Modal ──────────────────────────────────────────────────────────
function UserDetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getUserDetail.useQuery({ userId });
  const suspend    = trpc.admin.suspendUser.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const unsuspend  = trpc.admin.unsuspendUser.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const approveKyc = trpc.admin.approveKyc.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectKyc  = trpc.admin.rejectKyc.useMutation({ onSuccess:  () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const setRole    = trpc.admin.setRole.useMutation({ onSuccess:    () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const flag       = trpc.admin.flagUser.useMutation({ onSuccess:   () => utils.admin.getUserDetail.invalidate({ userId }) });

  const isBusy = suspend.isPending || unsuspend.isPending || approveKyc.isPending || rejectKyc.isPending || setRole.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-aegis-primary-dark dark:text-white">User #{userId}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-aegis-bg-elevated text-aegis-tertiary-dark">✕</button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8"><Loader2 size={24} className="animate-spin text-aegis-tertiary-dark"/></div>
        ) : !data ? (
          <p className="p-5 text-sm text-aegis-tertiary-dark">User not found</p>
        ) : (
          <div className="p-5 space-y-5">
            {/* User info */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-lg font-bold">
                  {data.user.name?.charAt(0).toUpperCase() ?? "#"}
                </div>
                <div>
                  <p className="font-semibold dark:text-white">{data.user.name ?? `User #${userId}`}</p>
                  <p className="text-xs text-aegis-tertiary-dark">{data.user.email ?? "No email"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-aegis-bg-elevated rounded-xl p-3">
                  <p className="text-aegis-tertiary-dark">Role</p>
                  <p className="font-semibold dark:text-white mt-0.5 capitalize">{data.user.role}</p>
                </div>
                <div className="bg-aegis-bg-elevated rounded-xl p-3">
                  <p className="text-aegis-tertiary-dark">KYC</p>
                  <p className="font-semibold dark:text-white mt-0.5">{data.user.kycStatus}</p>
                </div>
                <div className="bg-aegis-bg-elevated rounded-xl p-3">
                  <p className="text-aegis-tertiary-dark">Wallets</p>
                  <p className="font-semibold dark:text-white mt-0.5">{data.wallets.length}</p>
                </div>
                <div className="bg-aegis-bg-elevated rounded-xl p-3">
                  <p className="text-aegis-tertiary-dark">Transactions</p>
                  <p className="font-semibold dark:text-white mt-0.5">{data.txCount}</p>
                </div>
              </div>
              {data.user.suspended && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <AlertTriangle size={14} className="text-red-400"/>
                  <p className="text-xs text-red-400 font-medium">Account suspended</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider">Actions</p>

              {/* Suspend / Unsuspend */}
              {data.user.suspended ? (
                <button onClick={() => unsuspend.mutate({ userId })} disabled={isBusy}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/20 disabled:opacity-50 transition-colors">
                  {unsuspend.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserCheck size={14}/>}
                  Restore Account
                </button>
              ) : (
                <button onClick={() => suspend.mutate({ userId, reason: "Admin action" })} disabled={isBusy}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                  {suspend.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserX size={14}/>}
                  Suspend Account
                </button>
              )}

              {/* KYC actions */}
              {data.user.kycStatus === "PENDING" && (
                <div className="flex gap-2">
                  <button onClick={() => approveKyc.mutate({ userId })} disabled={isBusy}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/20 disabled:opacity-50">
                    {approveKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                    Approve KYC
                  </button>
                  <button onClick={() => rejectKyc.mutate({ userId })} disabled={isBusy}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 disabled:opacity-50">
                    {rejectKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>}
                    Reject KYC
                  </button>
                </div>
              )}

              {/* Role change */}
              <div className="flex gap-2">
                <button onClick={() => setRole.mutate({ userId, role: "admin" })} disabled={isBusy || data.user.role === "admin"}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#5B3CF5]/10 border border-[#5B3CF5]/30 text-[#5B3CF5] rounded-xl text-xs font-medium hover:bg-[#5B3CF5]/20 disabled:opacity-40">
                  <Shield size={12}/> Make Admin
                </button>
                <button onClick={() => setRole.mutate({ userId, role: "user" })} disabled={isBusy || data.user.role === "user"}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-500/10 border border-gray-500/30 text-gray-400 rounded-xl text-xs font-medium hover:bg-gray-500/20 disabled:opacity-40">
                  <Users size={12}/> Revoke Admin
                </button>
              </div>

              {/* Flag */}
              <button onClick={() => flag.mutate({ userId, reason: "Flagged by admin" })} disabled={flag.isPending}
                className="w-full flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-medium hover:bg-yellow-500/20 disabled:opacity-50">
                {flag.isPending ? <Loader2 size={14} className="animate-spin"/> : <Flag size={14}/>}
                Flag for Review
              </button>
            </div>

            {/* Wallets */}
            {data.wallets.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-2">Wallets</p>
                {data.wallets.map((w: any) => (
                  <div key={w.id} className="bg-aegis-bg-elevated rounded-xl px-3 py-2 mb-1">
                    <p className="text-xs font-mono text-aegis-primary-dark dark:text-white truncate">{w.address}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{w.label ?? w.type} · Chain {w.chainId}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Audit log */}
            {data.auditLogs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-2">Recent Audit Log</p>
                {data.auditLogs.slice(0, 5).map((log: any) => (
                  <div key={log.id} className="text-xs text-aegis-tertiary-dark border-l-2 border-[#5B3CF5]/30 pl-3 py-1 mb-1">
                    <span className="text-aegis-secondary-dark font-medium">{log.action}</span>
                    {log.createdAt && <span className="ml-2">{new Date(log.createdAt).toLocaleDateString()}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Broadcast Panel ────────────────────────────────────────────────────────────
function BroadcastPanel() {
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [type, setType]         = useState<"BROADCAST"|"SYSTEM"|"PROMO">("BROADCAST");
  const [mode, setMode]         = useState<"all"|"user">("all");
  const [targetUserId, setTUID] = useState("");
  const utils = trpc.useUtils();
  const broadcast  = trpc.notify.broadcast.useMutation({ onSuccess: () => { setTitle(""); setBody(""); utils.notify.list.invalidate(); } });
  const sendToUser = trpc.notify.sendToUser.useMutation({ onSuccess: () => { setTitle(""); setBody(""); setTUID(""); } });
  const isPending = broadcast.isPending || sendToUser.isPending;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 max-w-lg">
      <h3 className="font-semibold flex items-center gap-2 dark:text-white"><Megaphone size={16} className="text-yellow-400"/> Send Notification</h3>
      <div className="flex gap-2">
        {(["all","user"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode===m ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
            {m === "all" ? "All Users" : "Specific User"}
          </button>
        ))}
      </div>
      {mode === "user" && (
        <input value={targetUserId} onChange={e => setTUID(e.target.value)} placeholder="User ID (number)"
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
        className="w-full py-3 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {isPending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
        {mode==="all" ? "Broadcast to All" : "Send to User"}
      </button>
      {(broadcast.isSuccess || sendToUser.isSuccess) && <p className="text-xs text-green-400 text-center">✅ Sent successfully</p>}
    </div>
  );
}

// ── Support Panel ──────────────────────────────────────────────────────────────
function SupportPanel() {
  const [selected, setSelected] = useState<number|null>(null);
  const [reply, setReply]       = useState("");
  const utils = trpc.useUtils();
  const { data: tickets, isLoading } = trpc.support.listAllTickets.useQuery({ limit: 100, offset: 0, status: "ALL" });
  const { data: detail }             = trpc.support.getTicket.useQuery({ ticketId: selected! }, { enabled: !!selected });
  const addReply     = trpc.support.addReply.useMutation({ onSuccess: () => { setReply(""); utils.support.getTicket.invalidate({ ticketId: selected! }); } });
  const updateStatus = trpc.support.updateStatus.useMutation({ onSuccess: () => utils.support.listAllTickets.invalidate() });

  if (selected && detail) {
    const { ticket, replies } = detail;
    return (
      <div className="space-y-4 max-w-lg">
        <button onClick={() => setSelected(null)} className="text-xs text-aegis-tertiary-dark hover:text-white flex items-center gap-1"><ChevronLeft size={12}/> Back to tickets</button>
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm dark:text-white">{ticket.subject}</p>
            <Badge label={ticket.status}/>
          </div>
          <p className="text-xs text-aegis-tertiary-dark">User #{ticket.userId} · Ticket #{ticket.id} · {ticket.priority}</p>
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
          {[...replies].reverse().map((r: any) => (
            <div key={r.id} className={`rounded-xl p-3 ${r.isAdmin ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/30" : "bg-card border border-border"}`}>
              <p className={`text-xs font-semibold mb-1 ${r.isAdmin ? "text-[#5B3CF5]" : "dark:text-white"}`}>{r.isAdmin ? "🛡 Aegis Support" : `User #${r.userId}`}</p>
              <p className="text-sm text-aegis-secondary-dark">{r.message}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply as Aegis Support..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
          <button onClick={() => reply.trim() && addReply.mutate({ticketId:ticket.id,message:reply})} disabled={!reply.trim()||addReply.isPending}
            className="px-4 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl disabled:opacity-50">
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
        : tickets.map((t: any) => (
          <button key={t.id} onClick={() => setSelected(t.id)}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-[#5B3CF5]/50 transition-colors text-left">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold dark:text-white truncate">{t.subject}</p>
              <p className="text-xs text-aegis-tertiary-dark">#{t.id} · User #{t.userId} · {t.priority}</p>
            </div>
            <Badge label={t.status}/>
            <ChevronRight size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
          </button>
        ))
      }
    </div>
  );
}

// ── KYC Queue Panel ────────────────────────────────────────────────────────────
function KycPanel({ onOpenUser }: { onOpenUser: (id: number) => void }) {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({ limit: 200, offset: 0 });
  const approveKyc = trpc.admin.approveKyc.useMutation({ onSuccess: () => { utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectKyc  = trpc.admin.rejectKyc.useMutation({ onSuccess:  () => { utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });

  const pending = (users ?? []).filter(u => u.kycStatus === "PENDING");

  return (
    <div className="space-y-3 max-w-lg">
      <h3 className="font-semibold dark:text-white flex items-center gap-2">
        <UserCheck size={16} className="text-yellow-400"/> KYC Review Queue
        {pending.length > 0 && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{pending.length} pending</span>}
      </h3>
      {isLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark"/>
        : pending.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <CheckCircle size={24} className="text-green-400 mx-auto mb-2"/>
            <p className="text-sm text-aegis-tertiary-dark">No pending KYC submissions</p>
          </div>
        ) : pending.map(u => (
          <div key={u.id} className="bg-card border border-yellow-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {u.name?.charAt(0).toUpperCase() ?? "#"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold dark:text-white truncate">{u.name ?? `User #${u.id}`}</p>
                <p className="text-xs text-aegis-tertiary-dark truncate">{u.email ?? "No email"} · ID #{u.id}</p>
              </div>
              <button onClick={() => onOpenUser(u.id)} className="p-2 rounded-lg hover:bg-aegis-bg-elevated text-aegis-tertiary-dark">
                <Eye size={14}/>
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => approveKyc.mutate({ userId: u.id })} disabled={approveKyc.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-xs font-medium hover:bg-green-500/20 disabled:opacity-50">
                {approveKyc.isPending ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle size={12}/>} Approve
              </button>
              <button onClick={() => rejectKyc.mutate({ userId: u.id })} disabled={rejectKyc.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium hover:bg-red-500/20 disabled:opacity-50">
                {rejectKyc.isPending ? <Loader2 size={12} className="animate-spin"/> : <XCircle size={12}/>} Reject
              </button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminConsole() {
  const navigate = useNavigate();
  const { user, isLoading, isAdmin } = useCurrentUser();
  const [tab, setTab]         = useState<Tab>("overview");
  const [search, setSearch]   = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [detailUserId, setDetailUserId] = useState<number|null>(null);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } =
    trpc.admin.stats.useQuery(undefined, { enabled: !!isAdmin });
  const { data: usersList, isLoading: usersLoading } =
    trpc.admin.listUsers.useQuery({ limit: 200, offset: 0 }, { enabled: !!isAdmin && (tab === "users" || tab === "overview") });
  const { data: txList, isLoading: txLoading } =
    trpc.admin.listTransactions.useQuery({ limit: 100, offset: 0 }, { enabled: !!isAdmin && tab === "transactions" });

  if (!isLoading && !isAdmin) { navigate("/", { replace: true }); return null; }
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-aegis-tertiary-dark"/>
    </div>
  );
  if (!isAdmin) return null;

  const filteredUsers = (usersList ?? []).filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTx = (txList ?? []).filter((tx: any) =>
    !txSearch || String(tx.id).includes(txSearch) || (tx.state ?? "").includes(txSearch.toUpperCase())
  );

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "overview",     label: "Overview",     icon: TrendingUp },
    { id: "users",        label: "Users",        icon: Users },
    { id: "kyc",          label: "KYC",          icon: UserCheck, badge: stats?.pendingKyc },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "support",      label: "Support",      icon: LifeBuoy },
    { id: "broadcast",    label: "Broadcast",    icon: Megaphone },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* User detail modal */}
      {detailUserId !== null && (
        <UserDetailModal userId={detailUserId} onClose={() => setDetailUserId(null)}/>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Shield size={20} className="text-red-400"/>
          </div>
          <div>
            <h2 className="text-lg font-bold dark:text-white">Admin Console</h2>
            <p className="text-xs text-aegis-tertiary-dark">Cozanet Operations · Restricted access</p>
          </div>
        </div>
        <button onClick={() => refetchStats()} className="p-2 rounded-xl hover:bg-aegis-bg-elevated">
          <RefreshCw size={16} className="text-aegis-tertiary-dark"/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-aegis-bg-elevated rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${tab===t.id ? "bg-card dark:text-white shadow-sm" : "text-aegis-tertiary-dark"}`}>
            <t.icon size={13}/>{t.label}
            {(t.badge ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          {statsLoading ? <div className="flex items-center gap-2 text-aegis-tertiary-dark"><Loader2 size={16} className="animate-spin"/>Loading...</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Users"        value={stats?.totalUsers ?? 0}        icon={Users}     color="bg-[#5B3CF5]/20 text-[#5B3CF5]"/>
              <StatCard label="Transactions"       value={stats?.totalTransactions ?? 0} icon={Receipt}   color="bg-green-500/20 text-green-400"/>
              <StatCard label="KYC Pending"        value={stats?.pendingKyc ?? 0}        icon={UserCheck} color="bg-yellow-500/20 text-yellow-400" sub="Needs review"/>
              <StatCard label="Active Today"       value={stats?.activeToday ?? 0}       icon={Bell}      color="bg-blue-500/20 text-blue-400"/>
            </div>
          )}
          {/* Recent users preview */}
          <div>
            <p className="text-sm font-semibold dark:text-white mb-3">Recent Signups</p>
            <div className="space-y-2">
              {(usersList ?? []).slice(0, 5).map(u => (
                <button key={u.id} onClick={() => setDetailUserId(u.id)}
                  className="w-full bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:border-[#5B3CF5]/50 text-left">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {u.name?.charAt(0).toUpperCase() ?? "#"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium dark:text-white truncate">{u.name ?? `User #${u.id}`}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{u.email ?? "No email"}</p>
                  </div>
                  <Badge label={u.kycStatus ?? "NONE"}/>
                  <ChevronRight size={12} className="text-aegis-tertiary-dark flex-shrink-0"/>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-aegis-bg-elevated rounded-xl px-3 py-2">
            <Search size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..."
              className="bg-transparent text-sm flex-1 focus:outline-none dark:text-white placeholder:text-aegis-tertiary-dark"/>
          </div>
          {usersLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark"/>
            : !filteredUsers.length ? <p className="text-sm text-aegis-tertiary-dark">{search ? "No users match" : "No users yet"}</p>
            : filteredUsers.map(u => (
              <button key={u.id} onClick={() => setDetailUserId(u.id)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-[#5B3CF5]/50 text-left">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {u.name?.charAt(0).toUpperCase() ?? "#"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold dark:text-white truncate">{u.name ?? `User #${u.id}`}</p>
                  <p className="text-xs text-aegis-tertiary-dark truncate">{u.email ?? "No email"} · #{u.id}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge label={u.role ?? "user"} color={u.role==="admin" ? "bg-red-500/20 text-red-400" : "bg-[#5B3CF5]/20 text-[#5B3CF5]"}/>
                  <Badge label={u.kycStatus ?? "NONE"}/>
                </div>
                <ChevronRight size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
              </button>
            ))
          }
        </div>
      )}

      {/* KYC */}
      {tab === "kyc" && <KycPanel onOpenUser={(id) => setDetailUserId(id)}/>}

      {/* Transactions */}
      {tab === "transactions" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-aegis-bg-elevated rounded-xl px-3 py-2">
            <Search size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
            <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search ID or status..."
              className="bg-transparent text-sm flex-1 focus:outline-none dark:text-white placeholder:text-aegis-tertiary-dark"/>
          </div>
          {txLoading ? <Loader2 size={20} className="animate-spin text-aegis-tertiary-dark"/>
            : !filteredTx.length ? <p className="text-sm text-aegis-tertiary-dark">No transactions yet</p>
            : filteredTx.map((tx: any) => (
              <div key={tx.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold dark:text-white">TX #{tx.id}</p>
                    <span className="text-xs text-aegis-tertiary-dark">User #{tx.userId}</span>
                  </div>
                  <Badge label={tx.state ?? "UNKNOWN"}/>
                </div>
                <div className="flex items-center justify-between text-xs text-aegis-tertiary-dark">
                  <span>{tx.type ?? "TRANSFER"}</span>
                  <span>{tx.amountRaw ? `${(Number(tx.amountRaw)/1e6).toFixed(2)} USDT` : "—"}</span>
                </div>
                {tx.createdAt && <p className="text-xs text-aegis-tertiary-dark mt-1">{new Date(tx.createdAt).toLocaleString()}</p>}
              </div>
            ))
          }
        </div>
      )}

      {tab === "support"   && <SupportPanel/>}
      {tab === "broadcast" && <BroadcastPanel/>}
    </div>
  );
}
