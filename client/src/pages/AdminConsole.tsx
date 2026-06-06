/**
 * AdminConsole.tsx — Full company-grade admin dashboard
 *
 * Tabs: Overview | Users | KYC Queue | Transactions | Support | Broadcast | Settings
 * Admin access: email whitelist (ADMIN_EMAILS env) OR DB role="admin"
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Users, Receipt, TrendingUp, Shield, RefreshCw, Search,
  ChevronRight, Loader2, Megaphone, Send, Bell,
  LifeBuoy, UserCheck, UserX, AlertTriangle, Flag,
  CheckCircle, XCircle, Clock, ChevronLeft,
  Settings, Activity, Lock, Unlock,
  Mail, Star, Info, Hash, Check,
  BarChart2, Coins, ShieldAlert, Eye, EyeOff,
  Download, Upload, UserPlus, Trash2, Edit3,
} from "lucide-react";

type Tab = "overview" | "users" | "kyc" | "transactions" | "support" | "broadcast" | "settings";

const fmt = (n: number | string | undefined) => Number(n ?? 0).toLocaleString("en-US");
const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-500/20 text-blue-400", IN_PROGRESS: "bg-yellow-500/20 text-yellow-400",
  RESOLVED: "bg-green-500/20 text-green-400", CLOSED: "bg-gray-500/20 text-gray-400",
  SETTLED: "bg-green-500/20 text-green-400", PENDING: "bg-yellow-500/20 text-yellow-400",
  PENDING_SIGNATURE: "bg-yellow-500/20 text-yellow-400", FAILED: "bg-red-500/20 text-red-400",
  CANCELLED: "bg-gray-500/20 text-gray-400", CONFIRMED: "bg-green-500/20 text-green-400",
  SUBMITTED: "bg-blue-500/20 text-blue-400", CREATED: "bg-blue-500/20 text-blue-400",
  NONE: "bg-gray-500/20 text-gray-400", VERIFIED: "bg-green-500/20 text-green-400",
  REJECTED: "bg-red-500/20 text-red-400",
};

// ── User Detail Modal ──────────────────────────────────────────────────────────
function UserDetail({ userId, onClose }: { userId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getUserDetail.useQuery({ userId });
  const suspend    = trpc.admin.suspendUser.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const unsuspend  = trpc.admin.unsuspendUser.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const approveKyc = trpc.admin.approveKyc.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectKyc  = trpc.admin.rejectKyc.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const setRole    = trpc.admin.setRole.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const notifyUser = trpc.notify.sendToUser.useMutation();
  const flag       = trpc.admin.flagUser.useMutation({ onSuccess: () => utils.admin.getUserDetail.invalidate({ userId }) });
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody,  setNotifBody]  = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [showFlag,   setShowFlag]   = useState(false);

  if (isLoading) return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#5B3CF5]" />
    </div>
  );
  const u = data?.user;
  if (!u) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#111318] z-10">
          <h2 className="text-lg font-semibold text-white">User #{userId}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XCircle size={20}/></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Profile */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3">Profile</p>
            {[
              ["Name",      u.name ?? "—"],
              ["Email",     u.email ?? "—"],
              ["Aegis ID",  (u as any).aegisId ?? "—"],
              ["Role",      u.role ?? "user"],
              ["KYC",       (u as any).kycStatus ?? "NONE"],
              ["Joined",    fmtDate(u.createdAt)],
              ["Last seen", fmtDate((u as any).lastSignedIn)],
              ["Email verified", (u as any).emailVerified ? "Yes" : "No"],
              ["Suspended", (u as any).suspended ? "⚠️ YES" : "No"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4">
                <span className="text-gray-400 shrink-0">{k}</span>
                <span className="text-white font-medium text-right break-all">{v as string}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-gray-400">Tx count</span>
              <span className="text-white font-medium">{fmt(data?.txCount)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {(u as any).suspended ? (
              <button onClick={() => unsuspend.mutate({ userId })} disabled={unsuspend.isPending}
                className="py-2.5 rounded-xl bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                {unsuspend.isPending ? <Loader2 size={14} className="animate-spin"/> : <Unlock size={14}/>} Unsuspend
              </button>
            ) : (
              <button onClick={() => suspend.mutate({ userId, reason: "Admin action" })} disabled={suspend.isPending}
                className="py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                {suspend.isPending ? <Loader2 size={14} className="animate-spin"/> : <Lock size={14}/>} Suspend
              </button>
            )}
            {(u as any).kycStatus === "PENDING" && (
              <>
                <button onClick={() => approveKyc.mutate({ userId })} disabled={approveKyc.isPending}
                  className="py-2.5 rounded-xl bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                  {approveKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserCheck size={14}/>} Approve KYC
                </button>
                <button onClick={() => rejectKyc.mutate({ userId, reason: "Failed review" })} disabled={rejectKyc.isPending}
                  className="py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                  {rejectKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserX size={14}/>} Reject KYC
                </button>
              </>
            )}
            {u.role !== "admin" ? (
              <button onClick={() => setRole.mutate({ userId, role: "admin" })} disabled={setRole.isPending}
                className="py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                {setRole.isPending ? <Loader2 size={14} className="animate-spin"/> : <Star size={14}/>} Make Admin
              </button>
            ) : (
              <button onClick={() => setRole.mutate({ userId, role: "user" })} disabled={setRole.isPending}
                className="py-2.5 rounded-xl bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
                {setRole.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserX size={14}/>} Remove Admin
              </button>
            )}
            <button onClick={() => setShowFlag(!showFlag)}
              className="py-2.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-sm font-medium flex items-center justify-center gap-2">
              <Flag size={14}/> Flag User
            </button>
          </div>

          {/* Flag form */}
          {showFlag && (
            <div className="space-y-2">
              <input value={flagReason} onChange={e => setFlagReason(e.target.value)}
                placeholder="Flag reason (e.g. suspicious activity)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              <button onClick={() => { flag.mutate({ userId, reason: flagReason }); setShowFlag(false); setFlagReason(""); }}
                disabled={!flagReason || flag.isPending}
                className="w-full py-2 rounded-xl bg-orange-600/30 text-orange-400 text-sm font-medium disabled:opacity-40">
                Confirm Flag
              </button>
            </div>
          )}

          {/* Send notification to user */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-2"><Bell size={12}/> Send Direct Notification</p>
            <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Notification title"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
            <textarea value={notifBody} onChange={e => setNotifBody(e.target.value)} rows={2} placeholder="Message..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
            <button onClick={() => { notifyUser.mutate({ userId, title: notifTitle, body: notifBody, type: "SYSTEM" }); setNotifTitle(""); setNotifBody(""); }}
              disabled={!notifTitle || !notifBody || notifyUser.isPending}
              className="w-full py-2.5 rounded-xl bg-[#5B3CF5]/20 hover:bg-[#5B3CF5]/30 text-[#a78bfa] text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
              {notifyUser.isPending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
              {notifyUser.isSuccess ? "Sent!" : "Send Notification"}
            </button>
          </div>

          {/* Audit log */}
          {(data?.auditLogs ?? []).length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3 flex items-center gap-2"><Activity size={12}/> Audit Log</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(data?.auditLogs ?? []).map((log: any, i: number) => (
                  <div key={i} className="bg-white/5 rounded-lg px-3 py-2 text-xs">
                    <p className="text-white font-medium">{log.action}</p>
                    <p className="text-gray-500 mt-0.5">{fmtDateTime(log.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Broadcast Panel ──────────────────────────────────────────────────────────
function BroadcastPanel() {
  const [mode, setMode]           = useState<"all" | "user">("all");
  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [type, setType]           = useState<"BROADCAST" | "PROMO" | "SYSTEM">("BROADCAST");
  const [targetUserId, setTUID]   = useState("");
  const utils = trpc.useUtils();
  const broadcast  = trpc.notify.broadcast.useMutation({ onSuccess: () => { setTitle(""); setBody(""); utils.admin.broadcastHistory.invalidate(); } });
  const sendToUser = trpc.notify.sendToUser.useMutation({ onSuccess: () => { setTitle(""); setBody(""); setTUID(""); } });
  const { data: history, isLoading: histLoading } = trpc.admin.broadcastHistory.useQuery({ limit: 20 });
  const isPending = broadcast.isPending || sendToUser.isPending;
  const isSuccess = broadcast.isSuccess || sendToUser.isSuccess;

  const TYPES = [
    { value: "BROADCAST" as const, label: "Broadcast", emoji: "📢", desc: "General announcement" },
    { value: "PROMO"     as const, label: "Promo",     emoji: "🎁", desc: "Offer or reward" },
    { value: "SYSTEM"    as const, label: "System",    emoji: "⚙️", desc: "Platform update" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Broadcast Center</h2>
            <p className="text-sm text-gray-400">Send in-app notifications to users. Shows up in their notification bell instantly.</p>
          </div>

          {/* Target */}
          <div className="grid grid-cols-2 gap-3">
            {(["all", "user"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`p-4 rounded-xl border text-left transition-all ${mode === m ? "border-[#5B3CF5] bg-[#5B3CF5]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {m === "all" ? <Users size={16} className={mode === "all" ? "text-[#5B3CF5]" : "text-gray-400"}/> : <Mail size={16} className={mode === "user" ? "text-[#5B3CF5]" : "text-gray-400"}/>}
                  <span className={`text-sm font-medium ${mode === m ? "text-white" : "text-gray-400"}`}>{m === "all" ? "All Users" : "Specific User"}</span>
                </div>
                <p className="text-xs text-gray-500">{m === "all" ? "Every registered user" : "Target by user ID"}</p>
              </button>
            ))}
          </div>

          {mode === "user" && (
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">User ID</label>
              <input value={targetUserId} onChange={e => setTUID(e.target.value)} type="number"
                placeholder="Enter numeric user ID"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Message Type</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${type === t.value ? "border-[#5B3CF5] bg-[#5B3CF5]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                  <p className={`text-xs font-medium ${type === t.value ? "text-white" : "text-gray-400"}`}>{t.emoji} {t.label}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New feature available!"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Message Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
                placeholder="Write your message to users..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
              <p className="text-xs text-gray-600 mt-1">{body.length}/500 characters</p>
            </div>
          </div>

          {/* Preview */}
          {(title || body) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Preview</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5B3CF5]/20 flex items-center justify-center shrink-0">
                  <Bell size={18} className="text-[#5B3CF5]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{title || "Title"}</p>
                  <p className="text-xs text-gray-400 mt-0.5 break-words">{body || "Message..."}</p>
                  <p className="text-xs text-gray-600 mt-1">Just now · {TYPES.find(t => t.value === type)?.emoji} {type} · {mode === "all" ? "All users" : `User #${targetUserId}`}</p>
                </div>
              </div>
            </div>
          )}

          {/* Send */}
          <button
            onClick={() => {
              if (!title || !body) return;
              const payload = { title, body, type };
              if (mode === "all") broadcast.mutate(payload);
              else sendToUser.mutate({ ...payload, userId: Number(targetUserId) });
            }}
            disabled={!title || !body || isPending || (mode === "user" && !targetUserId)}
            className="w-full py-4 rounded-xl bg-[#5B3CF5] hover:bg-[#4c31d4] text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
            {isPending ? <Loader2 size={18} className="animate-spin"/> : <Megaphone size={18}/>}
            {isPending ? "Sending..." : mode === "all" ? "📢 Broadcast to All Users" : "Send to User"}
          </button>
          {isSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm justify-center bg-green-500/10 rounded-xl py-3">
              <CheckCircle size={16}/> Notification sent successfully!
            </div>
          )}
        </div>

        {/* Broadcast History */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Broadcast History</h2>
            <p className="text-sm text-gray-400">Recent messages sent to all users.</p>
          </div>
          {histLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#5B3CF5]"/></div>
          ) : (history ?? []).length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
              <Megaphone size={32} className="text-gray-600 mx-auto mb-3"/>
              <p className="text-gray-400 text-sm">No broadcasts yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {(history ?? []).map((n: any) => (
                <div key={n.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${STATUS_COLORS[n.type] ?? "bg-gray-500/20 text-gray-400"}`}>{n.type}</span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-gray-600 mt-2">{fmtDateTime(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Support Panel ────────────────────────────────────────────────────────────
function SupportPanel() {
  const [selected, setSelected] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const utils = trpc.useUtils();
  const { data: tickets, isLoading } = trpc.support.listAllTickets.useQuery({ limit: 100, offset: 0, status: "ALL" });
  const { data: detail } = trpc.support.getTicket.useQuery({ ticketId: selected! }, { enabled: !!selected });
  const addReply     = trpc.support.addReply.useMutation({ onSuccess: () => { setReply(""); utils.support.getTicket.invalidate({ ticketId: selected! }); } });
  const updateStatus = trpc.support.updateStatus.useMutation({ onSuccess: () => utils.support.listAllTickets.invalidate() });
  const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>;

  if (selected && detail) return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ChevronLeft size={16}/> Back to tickets
      </button>
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{(detail as any).ticket?.subject}</h3>
            <p className="text-xs text-gray-400 mt-1">Ticket #{selected} · User #{(detail as any).ticket?.userId} · {fmtDate((detail as any).ticket?.createdAt)}</p>
          </div>
          <select value={(detail as any).ticket?.status}
            onChange={e => updateStatus.mutate({ ticketId: selected!, status: e.target.value as any })}
            className="bg-[#111318] border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <p className="text-sm text-gray-300 border-t border-white/10 pt-3">{(detail as any).ticket?.message}</p>
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {((detail as any).replies ?? []).map((r: any) => (
          <div key={r.id} className={`flex gap-3 ${r.isAdmin ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${r.isAdmin ? "bg-[#5B3CF5] text-white" : "bg-white/10 text-gray-300"}`}>
              {r.isAdmin ? "A" : "U"}
            </div>
            <div className={`rounded-xl px-4 py-3 max-w-sm ${r.isAdmin ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/20" : "bg-white/5 border border-white/10"}`}>
              <p className="text-sm text-white">{r.message}</p>
              <p className="text-xs text-gray-500 mt-1">{fmtDateTime(r.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3}
          placeholder="Type your admin reply..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
        <button onClick={() => reply && selected && addReply.mutate({ ticketId: selected, message: reply, isAdmin: true })}
          disabled={!reply || addReply.isPending}
          className="w-full py-3 rounded-xl bg-[#5B3CF5] hover:bg-[#4c31d4] text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
          {addReply.isPending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} Send Reply
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-white">Support Tickets ({tickets?.length ?? 0})</h2>
        <span className="text-xs text-gray-400">{tickets?.filter((t: any) => t.status === "OPEN").length ?? 0} open</span>
      </div>
      {(tickets?.length ?? 0) === 0 && <p className="text-gray-400 text-sm py-8 text-center">No tickets yet.</p>}
      {(tickets ?? []).map((t: any) => (
        <button key={t.id} onClick={() => setSelected(t.id)}
          className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 text-left transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{t.subject}</p>
              <p className="text-xs text-gray-400 mt-0.5">User #{t.userId} · {fmtDate(t.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
              <ChevronRight size={14} className="text-gray-500"/>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── KYC Panel ──────────────────────────────────────────────────────────────
function KycPanel() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({ limit: 200, offset: 0 });
  const approveKyc = trpc.admin.approveKyc.useMutation({ onSuccess: () => { utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectKyc  = trpc.admin.rejectKyc.useMutation({ onSuccess: () => { utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const pending = (users ?? []).filter((u: any) => u.kycStatus === "PENDING");

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>;
  if (pending.length === 0) return (
    <div className="text-center py-16">
      <CheckCircle size={40} className="text-green-400 mx-auto mb-3"/>
      <p className="text-white font-medium">No pending KYC applications</p>
      <p className="text-gray-400 text-sm mt-1">All caught up!</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center font-bold">{pending.length}</span>
        <h2 className="text-base font-semibold text-white">Pending KYC Reviews</h2>
      </div>
      {pending.map((u: any) => (
        <div key={u.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-white">{u.name ?? `User #${u.id}`}</p>
              <p className="text-xs text-gray-400">{u.email ?? "No email"} · Joined {fmtDate(u.createdAt)}</p>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.emailVerified ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
              {u.emailVerified ? "Email ✓" : "Email unverified"}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => approveKyc.mutate({ userId: u.id })} disabled={approveKyc.isPending}
              className="flex-1 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
              {approveKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserCheck size={14}/>} Approve
            </button>
            <button onClick={() => rejectKyc.mutate({ userId: u.id, reason: "Failed review" })} disabled={rejectKyc.isPending}
              className="flex-1 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
              {rejectKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserX size={14}/>} Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Settings Panel ─────────────────────────────────────────────────────────
function SettingsPanel() {
  const [banner, setBanner]           = useState(() => localStorage.getItem("aegis_admin_banner") ?? "");
  const [maintenanceMode, setMaint]   = useState(() => localStorage.getItem("aegis_maintenance") === "true");
  const [registrationOpen, setReg]    = useState(() => localStorage.getItem("aegis_registration") !== "false");
  const [saved, setSaved]             = useState(false);
  const broadcast = trpc.notify.broadcast.useMutation();

  const handleSave = () => {
    localStorage.setItem("aegis_admin_banner", banner);
    localStorage.setItem("aegis_maintenance", String(maintenanceMode));
    localStorage.setItem("aegis_registration", String(registrationOpen));
    if (banner) {
      broadcast.mutate({ title: "📌 Platform Announcement", body: banner, type: "SYSTEM" });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Platform Settings</h2>
        <p className="text-sm text-gray-400">These settings affect all users platform-wide.</p>
      </div>

      {/* Announcement Banner */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Bell size={15}/> Announcement Banner</h3>
        <textarea value={banner} onChange={e => setBanner(e.target.value)} rows={3}
          placeholder="e.g. Maintenance scheduled Sunday 2AM–4AM WAT. Plan ahead."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
        <p className="text-xs text-gray-500">Saving will also broadcast this as a SYSTEM notification to all users.</p>
      </div>

      {/* Maintenance Mode */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><AlertTriangle size={15}/> Maintenance Mode</h3>
          <p className="text-xs text-gray-400 mt-1">Disables trading, send, and receive while on.</p>
        </div>
        <button onClick={() => setMaint(!maintenanceMode)}
          className={`w-12 h-6 rounded-full transition-colors relative ${maintenanceMode ? "bg-red-500" : "bg-white/20"}`}>
          <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${maintenanceMode ? "left-6" : "left-0.5"}`}/>
        </button>
      </div>

      {/* Registration Toggle */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><UserPlus size={15}/> Open Registration</h3>
          <p className="text-xs text-gray-400 mt-1">Allow new users to sign up.</p>
        </div>
        <button onClick={() => setReg(!registrationOpen)}
          className={`w-12 h-6 rounded-full transition-colors relative ${registrationOpen ? "bg-green-500" : "bg-white/20"}`}>
          <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${registrationOpen ? "left-6" : "left-0.5"}`}/>
        </button>
      </div>

      {/* Admin emails info */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><ShieldAlert size={15}/> Admin Access</h3>
        <p className="text-xs text-gray-400">Admins are set via <code className="bg-white/10 px-1 rounded text-[#a78bfa]">ADMIN_EMAILS</code> environment variable on Vercel, or via the "Make Admin" button in user detail.</p>
        <p className="text-xs text-gray-500">Current hardcoded admins: info@cozanet.net, fassdavid722@gmail.com</p>
      </div>

      <button onClick={handleSave}
        className="w-full py-3.5 rounded-xl bg-[#5B3CF5] hover:bg-[#4c31d4] text-white font-semibold flex items-center justify-center gap-2 transition-colors">
        {saved ? <><CheckCircle size={16}/> Saved!</> : <><Check size={16}/> Save Settings</>}
      </button>
    </div>
  );
}

// ── Main AdminConsole ──────────────────────────────────────────────────────
export default function AdminConsole() {
  const navigate       = useNavigate();
  const { isAdmin, isLoading: authLoading } = useCurrentUser();
  const [tab, setTab]  = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: stats, isLoading, refetch } = trpc.admin.stats.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: allUsers, isLoading: usersLoading } = trpc.admin.listUsers.useQuery({ limit: 100, offset: 0 }, { enabled: tab === "users" });
  const { data: searchResults } = trpc.admin.searchUsers.useQuery({ q: search }, { enabled: search.length >= 2 });
  const { data: allTxs, isLoading: txLoading } = trpc.admin.listTransactions.useQuery({ limit: 100, offset: 0 }, { enabled: tab === "transactions" });

  // Guard: only admins can see this page
  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={28} className="animate-spin text-[#5B3CF5]"/>
    </div>
  );
  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
        <Lock size={28} className="text-red-400"/>
      </div>
      <h2 className="text-xl font-semibold text-white">Access Denied</h2>
      <p className="text-gray-400 max-w-sm">You don't have admin privileges. Contact the platform owner.</p>
      <button onClick={() => navigate("/")} className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors">
        Go Home
      </button>
    </div>
  );

  const displayUsers = search.length >= 2 ? (searchResults ?? []) : (allUsers ?? []);

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "overview",      label: "Overview",     icon: BarChart2    },
    { id: "users",         label: "Users",        icon: Users,       badge: stats?.totalUsers },
    { id: "kyc",           label: "KYC Queue",    icon: Shield,      badge: stats?.pendingKyc },
    { id: "transactions",  label: "Transactions", icon: Receipt,     badge: stats?.totalTransactions },
    { id: "support",       label: "Support",      icon: LifeBuoy     },
    { id: "broadcast",     label: "Broadcast",    icon: Megaphone    },
    { id: "settings",      label: "Settings",     icon: Settings     },
  ];

  return (
    <div className="min-h-screen text-white">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-white/10 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5B3CF5]/20 flex items-center justify-center">
              <Shield size={20} className="text-[#5B3CF5]"/>
            </div>
            Admin Console
          </h1>
          <button onClick={() => { utils.admin.stats.invalidate(); utils.admin.listUsers.invalidate(); refetch(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm transition-colors">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>
        <p className="text-sm text-gray-400">Full platform management — users, KYC, notifications, support</p>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  tab === t.id ? "bg-[#5B3CF5] text-white" : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}>
                <Icon size={15}/>
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full bg-white/20 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {t.badge > 999 ? "999+" : t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-12">
        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Users",     value: fmt(stats?.totalUsers),        icon: Users,       color: "text-[#5B3CF5]", bg: "bg-[#5B3CF5]/10" },
                    { label: "Transactions",    value: fmt(stats?.totalTransactions), icon: Receipt,     color: "text-green-400",  bg: "bg-green-500/10" },
                    { label: "KYC Pending",     value: fmt(stats?.pendingKyc),        icon: Clock,       color: "text-yellow-400", bg: "bg-yellow-500/10" },
                    { label: "Active Today",    value: fmt(stats?.activeToday),       icon: Activity,    color: "text-blue-400",   bg: "bg-blue-500/10" },
                  ].map(card => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
                        <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                          <Icon size={18} className={card.color}/>
                        </div>
                        <p className="text-2xl font-bold text-white">{card.value}</p>
                        <p className="text-xs text-gray-400 mt-1">{card.label}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp size={15}/> Quick Actions</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Send Broadcast", icon: Megaphone, action: () => setTab("broadcast"), color: "text-[#5B3CF5]" },
                      { label: "Review KYC",     icon: Shield,    action: () => setTab("kyc"),       color: "text-yellow-400" },
                      { label: "View Support",   icon: LifeBuoy,  action: () => setTab("support"),   color: "text-blue-400" },
                      { label: "Manage Users",   icon: Users,     action: () => setTab("users"),     color: "text-green-400" },
                    ].map(qa => {
                      const Icon = qa.icon;
                      return (
                        <button key={qa.label} onClick={qa.action}
                          className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex flex-col items-center gap-2 text-center transition-all group">
                          <Icon size={20} className={`${qa.color} group-hover:scale-110 transition-transform`}/>
                          <span className="text-xs text-gray-300 font-medium">{qa.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Users */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
              </div>
              <span className="text-sm text-gray-400 whitespace-nowrap">{displayUsers.length} users</span>
            </div>
            {usersLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>
            ) : displayUsers.length === 0 ? (
              <p className="text-center text-gray-400 py-12">No users found.</p>
            ) : (
              <div className="space-y-2">
                {displayUsers.map((u: any) => (
                  <button key={u.id} onClick={() => setSelectedUser(u.id)}
                    className="w-full bg-white/5 border border-white/10 hover:border-[#5B3CF5]/40 rounded-xl p-4 text-left transition-all group">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#5B3CF5]/20 flex items-center justify-center shrink-0 text-sm font-bold text-[#a78bfa]">
                          {(u.name ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{u.name ?? "Unnamed"}</p>
                            {u.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium shrink-0">ADMIN</span>}
                            {u.suspended && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium shrink-0">SUSPENDED</span>}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{u.email ?? "No email"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[u.kycStatus ?? "NONE"]}`}>{u.kycStatus ?? "NONE"}</span>
                        <ChevronRight size={14} className="text-gray-500 group-hover:text-white transition-colors"/>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KYC */}
        {tab === "kyc" && <KycPanel/>}

        {/* Transactions */}
        {tab === "transactions" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-white">All Transactions</h2>
              <span className="text-xs text-gray-400">{allTxs?.length ?? 0} records</span>
            </div>
            {txLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>
            ) : (allTxs?.length ?? 0) === 0 ? (
              <p className="text-center text-gray-400 py-12">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {(allTxs ?? []).map((tx: any) => (
                  <div key={tx.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{tx.type ?? "Transfer"}</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[tx.state ?? "PENDING"]}`}>{tx.state ?? "PENDING"}</span>
                        </div>
                        <p className="text-xs text-gray-400">User #{tx.userId} · {fmtDateTime(tx.createdAt)}</p>
                        {tx.fromCurrency && <p className="text-xs text-gray-500 mt-0.5">{tx.fromCurrency} → {tx.toCurrency}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-white">{tx.amountRaw ? Number(tx.amountRaw).toLocaleString() : "—"}</p>
                        <p className="text-xs text-gray-500">#{tx.id}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Support */}
        {tab === "support" && <SupportPanel/>}

        {/* Broadcast */}
        {tab === "broadcast" && <BroadcastPanel/>}

        {/* Settings */}
        {tab === "settings" && <SettingsPanel/>}
      </div>

      {/* User Detail Modal */}
      {selectedUser !== null && (
        <UserDetail userId={selectedUser} onClose={() => setSelectedUser(null)}/>
      )}
    </div>
  );
}
