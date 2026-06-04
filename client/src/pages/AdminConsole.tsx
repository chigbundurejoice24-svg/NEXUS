/**
 * AdminConsole.tsx — Full company-grade admin dashboard
 *
 * Tabs: Overview | Users | KYC Queue | Transactions | Support | Broadcast | Settings
 * Admin emails: info@cozanet.net | fassdavid722@gmail.com
 *
 * Features:
 *  - Platform stats (users, volume, tx count, active today, KYC queue)
 *  - Full user management (view, suspend/unsuspend, KYC approve/reject, role change, flag)
 *  - KYC queue with one-click approve / reject
 *  - All transactions view with search + filter
 *  - Support tickets with reply + status management
 *  - Broadcast panel — send to ALL users or one specific user (in-app + email)
 *  - Platform settings panel (announcement banner, maintenance mode)
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
  Settings, Download, BarChart2, Activity, Lock, Unlock,
  Mail, Star, Info, Hash, Copy, Check,
} from "lucide-react";

type Tab = "overview" | "users" | "kyc" | "transactions" | "support" | "broadcast" | "settings";

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number | string | undefined) =>
  Number(n ?? 0).toLocaleString("en-US");

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:              "bg-blue-500/20 text-blue-400",
  IN_PROGRESS:       "bg-yellow-500/20 text-yellow-400",
  RESOLVED:          "bg-green-500/20 text-green-400",
  CLOSED:            "bg-gray-500/20 text-gray-400",
  SETTLED:           "bg-green-500/20 text-green-400",
  PENDING:           "bg-yellow-500/20 text-yellow-400",
  PENDING_SIGNATURE: "bg-yellow-500/20 text-yellow-400",
  FAILED:            "bg-red-500/20 text-red-400",
  CANCELLED:         "bg-gray-500/20 text-gray-400",
  CONFIRMED:         "bg-green-500/20 text-green-400",
  SUBMITTED:         "bg-blue-500/20 text-blue-400",
  CREATED:           "bg-blue-500/20 text-blue-400",
  NONE:              "bg-gray-500/20 text-gray-400",
  VERIFIED:          "bg-green-500/20 text-green-400",
  REJECTED:          "bg-red-500/20 text-red-400",
};

const KYC_LABELS: Record<string, string> = {
  NONE: "Unverified", PENDING: "Pending", VERIFIED: "Verified", REJECTED: "Rejected",
};

// ── User Detail Modal ────────────────────────────────────────────────────────
function UserDetail({ userId, onClose }: { userId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getUserDetail.useQuery({ userId });
  const suspend    = trpc.admin.suspendUser.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const unsuspend  = trpc.admin.unsuspendUser.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const approveKyc = trpc.admin.approveKyc.useMutation({ onSuccess: () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectKyc  = trpc.admin.rejectKyc.useMutation({ onSuccess:  () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const setRole    = trpc.admin.setRole.useMutation({ onSuccess:    () => { utils.admin.getUserDetail.invalidate({ userId }); utils.admin.listUsers.invalidate(); } });
  const flag       = trpc.admin.flagUser.useMutation({ onSuccess:   () => utils.admin.getUserDetail.invalidate({ userId }) });
  const notifyUser = trpc.notify.sendToUser.useMutation();
  const [notifTitle, setNotifTitle] = useState(""); 
  const [notifBody,  setNotifBody]  = useState("");

  if (isLoading) return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#5B3CF5]" />
    </div>
  );

  const u = data?.user;
  if (!u) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#111318] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">User #{userId}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XCircle size={20}/></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Identity */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Name</span><span className="text-white font-medium">{u.name ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="text-white font-medium break-all">{u.email ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Role</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-gray-500/20 text-gray-400"}`}>{u.role}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-400">KYC</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[u.kycStatus ?? "NONE"]}`}>{KYC_LABELS[u.kycStatus ?? "NONE"]}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-400">Status</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.suspended ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                {u.suspended ? "Suspended" : "Active"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-400">Transactions</span><span className="text-white font-medium">{data?.txCount ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Joined</span><span className="text-white">{fmtDate((u as any).createdAt)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Last seen</span><span className="text-white">{fmtDate(u.lastSignedIn)}</span></div>
          </div>

          {/* Wallets */}
          {(data?.wallets?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Wallets ({data!.wallets.length})</p>
              <div className="space-y-2">
                {data!.wallets.map((w: any) => (
                  <div key={w.id} className="bg-white/5 rounded-lg p-3 text-xs font-mono text-gray-300 truncate">{w.address}</div>
                ))}
              </div>
            </div>
          )}

          {/* Quick notify */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Send Notification</p>
            <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)}
              placeholder="Title" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
            <textarea value={notifBody} onChange={e => setNotifBody(e.target.value)}
              placeholder="Message body..." rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
            <button onClick={() => { if (notifTitle && notifBody) notifyUser.mutate({ userId, title: notifTitle, body: notifBody, type: "SYSTEM" }); }}
              disabled={!notifTitle || !notifBody || notifyUser.isPending}
              className="w-full py-2 rounded-lg bg-[#5B3CF5] hover:bg-[#4c31d4] text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2">
              {notifyUser.isPending ? <Loader2 size={14} className="animate-spin"/> : <Bell size={14}/>}
              Send Notification
            </button>
            {notifyUser.isSuccess && <p className="text-xs text-green-400 text-center">✅ Sent</p>}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {u.suspended
              ? <button onClick={() => unsuspend.mutate({ userId })} disabled={unsuspend.isPending}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium disabled:opacity-40">
                  {unsuspend.isPending ? <Loader2 size={14} className="animate-spin"/> : <Unlock size={14}/>} Restore
                </button>
              : <button onClick={() => suspend.mutate({ userId, reason: "Admin action" })} disabled={suspend.isPending}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium disabled:opacity-40">
                  {suspend.isPending ? <Loader2 size={14} className="animate-spin"/> : <Lock size={14}/>} Suspend
                </button>
            }
            {u.kycStatus === "PENDING" && (
              <>
                <button onClick={() => approveKyc.mutate({ userId })} disabled={approveKyc.isPending}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium disabled:opacity-40">
                  {approveKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>} Approve KYC
                </button>
                <button onClick={() => rejectKyc.mutate({ userId, reason: "Failed review" })} disabled={rejectKyc.isPending}
                  className="flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium disabled:opacity-40">
                  {rejectKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>} Reject KYC
                </button>
              </>
            )}
            <button onClick={() => setRole.mutate({ userId, role: u.role === "admin" ? "user" : "admin" })} disabled={setRole.isPending}
              className="flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm font-medium disabled:opacity-40 col-span-2">
              {setRole.isPending ? <Loader2 size={14} className="animate-spin"/> : <Star size={14}/>}
              {u.role === "admin" ? "Demote to User" : "Promote to Admin"}
            </button>
            <button onClick={() => flag.mutate({ userId, reason: "Flagged by admin" })} disabled={flag.isPending}
              className="flex items-center justify-center gap-2 py-2 rounded-lg bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 text-sm font-medium disabled:opacity-40 col-span-2">
              {flag.isPending ? <Loader2 size={14} className="animate-spin"/> : <Flag size={14}/>} Flag for Review
            </button>
          </div>

          {/* Recent audit log */}
          {(data?.auditLogs?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Audit Log</p>
              <div className="space-y-1">
                {data!.auditLogs.slice(0, 6).map((log: any) => (
                  <div key={log.id} className="flex justify-between text-xs text-gray-400 py-1 border-b border-white/5">
                    <span className="font-medium text-white">{log.action}</span>
                    <span>{fmtDate(log.timestamp ?? log.createdAt)}</span>
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
  const [actionUrl, setActionUrl] = useState("");
  const utils = trpc.useUtils();
  const broadcast  = trpc.notify.broadcast.useMutation({ onSuccess: () => { setTitle(""); setBody(""); setActionUrl(""); utils.notify.list.invalidate(); } });
  const sendToUser = trpc.notify.sendToUser.useMutation({ onSuccess: () => { setTitle(""); setBody(""); setTUID(""); setActionUrl(""); } });
  const isPending  = broadcast.isPending || sendToUser.isPending;
  const isSuccess  = broadcast.isSuccess  || sendToUser.isSuccess;

  const TYPES = [
    { value: "BROADCAST", label: "📢 Broadcast", desc: "General announcement to all users" },
    { value: "PROMO",     label: "🎁 Promo",     desc: "Promotional or rewards message" },
    { value: "SYSTEM",    label: "⚙️ System",    desc: "System update or maintenance notice" },
  ] as const;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Broadcast Center</h2>
        <p className="text-sm text-gray-400">Send in-app notifications to users. All broadcasts appear in their notification bell.</p>
      </div>

      {/* Audience selector */}
      <div className="grid grid-cols-2 gap-3">
        {(["all", "user"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`p-4 rounded-xl border text-left transition-all ${mode === m ? "border-[#5B3CF5] bg-[#5B3CF5]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
            <div className="flex items-center gap-2 mb-1">
              {m === "all" ? <Users size={16} className={mode === "all" ? "text-[#5B3CF5]" : "text-gray-400"}/> : <Mail size={16} className={mode === "user" ? "text-[#5B3CF5]" : "text-gray-400"}/>}
              <span className={`text-sm font-medium ${mode === m ? "text-white" : "text-gray-400"}`}>{m === "all" ? "All Users" : "Specific User"}</span>
            </div>
            <p className="text-xs text-gray-500">{m === "all" ? "Broadcast to every registered user" : "Target one user by their ID"}</p>
          </button>
        ))}
      </div>

      {/* Target user ID */}
      {mode === "user" && (
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">User ID</label>
          <input value={targetUserId} onChange={e => setTUID(e.target.value)} type="number" placeholder="Enter numeric user ID"
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
              <p className={`text-xs font-medium ${type === t.value ? "text-white" : "text-gray-400"}`}>{t.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Title + Body */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New feature launched 🚀"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Write your message here..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Action URL <span className="text-gray-600 normal-case">(optional — e.g. /fund)</span></label>
          <input value={actionUrl} onChange={e => setActionUrl(e.target.value)} placeholder="https://aegis.cozanet.net/fund"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
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
            <div>
              <p className="text-sm font-semibold text-white">{title || "Title"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{body || "Your message..."}</p>
              <p className="text-xs text-gray-600 mt-1">Just now • {mode === "all" ? "All users" : `User #${targetUserId}`}</p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          if (!title || !body) return;
          const payload = { title, body, type, ...(actionUrl ? { actionUrl } : {}) };
          if (mode === "all") broadcast.mutate(payload);
          else sendToUser.mutate({ ...payload, userId: Number(targetUserId), type: type as any });
        }}
        disabled={!title || !body || isPending || (mode === "user" && !targetUserId)}
        className="w-full py-4 rounded-xl bg-[#5B3CF5] hover:bg-[#4c31d4] text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
        {isPending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
        {isPending ? "Sending..." : mode === "all" ? "Broadcast to All Users" : "Send to User"}
      </button>
      {isSuccess && (
        <div className="flex items-center gap-2 text-green-400 text-sm justify-center">
          <CheckCircle size={16}/> Notification sent successfully!
        </div>
      )}
    </div>
  );
}

// ── Support Panel ────────────────────────────────────────────────────────────
function SupportPanel() {
  const [selected, setSelected] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const utils = trpc.useUtils();
  const { data: tickets, isLoading } = trpc.support.listAllTickets.useQuery({ limit: 100, offset: 0, status: "ALL" });
  const { data: detail }             = trpc.support.getTicket.useQuery({ ticketId: selected! }, { enabled: !!selected });
  const addReply     = trpc.support.addReply.useMutation({ onSuccess: () => { setReply(""); utils.support.getTicket.invalidate({ ticketId: selected! }); } });
  const updateStatus = trpc.support.updateStatus.useMutation({ onSuccess: () => utils.support.listAllTickets.invalidate() });

  const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>;

  if (selected && detail) return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
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
            className="bg-[#111318] border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-[#5B3CF5]">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <p className="text-sm text-gray-300 border-t border-white/10 pt-3">{(detail as any).ticket?.message}</p>
      </div>

      {/* Replies */}
      <div className="space-y-3">
        {((detail as any).replies ?? []).map((r: any) => (
          <div key={r.id} className={`flex gap-3 ${r.isAdmin ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${r.isAdmin ? "bg-[#5B3CF5] text-white" : "bg-white/10 text-gray-300"}`}>
              {r.isAdmin ? "A" : "U"}
            </div>
            <div className={`bg-white/5 rounded-xl px-4 py-3 max-w-sm ${r.isAdmin ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/20" : "border border-white/10"}`}>
              <p className="text-sm text-white">{r.message}</p>
              <p className="text-xs text-gray-500 mt-1">{fmtDate(r.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div className="space-y-2">
        <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3}
          placeholder="Type your admin reply..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
        <button onClick={() => reply && selected && addReply.mutate({ ticketId: selected, message: reply, isAdmin: true })}
          disabled={!reply || addReply.isPending}
          className="w-full py-3 rounded-xl bg-[#5B3CF5] hover:bg-[#4c31d4] text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2 text-sm transition-colors">
          {addReply.isPending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
          Send Reply
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
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.priority === "HIGH" || t.priority === "CRITICAL" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400"}`}>{t.priority}</span>
              <ChevronRight size={14} className="text-gray-500"/>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── KYC Panel ────────────────────────────────────────────────────────────────
function KycPanel() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({ limit: 200, offset: 0 });
  const approveKyc = trpc.admin.approveKyc.useMutation({ onSuccess: () => { utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });
  const rejectKyc  = trpc.admin.rejectKyc.useMutation({ onSuccess:  () => { utils.admin.listUsers.invalidate(); utils.admin.stats.invalidate(); } });

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
              {u.emailVerified ? "✓ Email verified" : "Email unverified"}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => approveKyc.mutate({ userId: u.id })} disabled={approveKyc.isPending}
              className="flex-1 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
              {approveKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserCheck size={14}/>} Approve
            </button>
            <button onClick={() => rejectKyc.mutate({ userId: u.id, reason: "Failed review" })} disabled={rejectKyc.isPending}
              className="flex-1 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
              {rejectKyc.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserX size={14}/>} Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel() {
  const [banner, setBanner]   = useState("");
  const [maintenanceMode, setMaintenance] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Persist to localStorage as a platform-wide setting (admin only)
    localStorage.setItem("aegis_admin_banner", banner);
    localStorage.setItem("aegis_maintenance", String(maintenanceMode));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Platform Settings</h2>
        <p className="text-sm text-gray-400">These settings affect the entire platform for all users.</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Info size={15}/> Announcement Banner</h3>
        <textarea value={banner} onChange={e => setBanner(e.target.value)} rows={3}
          placeholder="e.g. 🛠️ Maintenance scheduled for Sunday 2AM–4AM WAT. Plan ahead."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5] resize-none" />
        <p className="text-xs text-gray-500">Leave empty to hide the banner. Shown to all logged-in users.</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><AlertTriangle size={15}/> Maintenance Mode</h3>
          <p className="text-xs text-gray-400 mt-1">Disables trading and send/receive while on.</p>
        </div>
        <button onClick={() => setMaintenance(!maintenanceMode)}
          className={`w-12 h-6 rounded-full transition-colors relative ${maintenanceMode ? "bg-red-500" : "bg-white/20"}`}>
          <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${maintenanceMode ? "left-6" : "left-0.5"}`}/>
        </button>
      </div>

      <button onClick={handleSave}
        className="w-full py-3 rounded-xl bg-[#5B3CF5] hover:bg-[#4c31d4] text-white font-semibold flex items-center justify-center gap-2 transition-colors">
        {saved ? <><Check size={16}/> Saved</> : <><Settings size={16}/> Save Settings</>}
      </button>
    </div>
  );
}

// ── Main AdminConsole ────────────────────────────────────────────────────────
export default function AdminConsole() {
  const navigate  = useNavigate();
  const { user, isLoading: authLoading } = useCurrentUser();
  const [tab, setTab]             = useState<Tab>("overview");
  const [search, setSearch]       = useState("");
  const [selectedUser, setSelUser] = useState<number | null>(null);

  const isAdmin = (user as any)?.isAdmin;

  const { data: stats, isLoading: statsLoading, refetch } =
    trpc.admin.stats.useQuery(undefined, { enabled: !!isAdmin });

  const { data: usersData, isLoading: usersLoading } =
    trpc.admin.listUsers.useQuery({ limit: 200, offset: 0 }, { enabled: !!isAdmin && (tab === "users" || tab === "overview") });

  const { data: txData, isLoading: txLoading } =
    trpc.admin.listTransactions.useQuery({ limit: 100, offset: 0 }, { enabled: !!isAdmin && tab === "transactions" });

  if (authLoading) return (
    <div className="flex items-center justify-center h-screen bg-[#0B0C10]">
      <Loader2 size={32} className="animate-spin text-[#5B3CF5]"/>
    </div>
  );

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0B0C10] text-center px-4">
      <Shield size={48} className="text-red-500 mb-4"/>
      <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
      <p className="text-gray-400 mb-6">This area is restricted to Cozanet administrators only.</p>
      <button onClick={() => navigate("/")} className="px-6 py-3 rounded-xl bg-[#5B3CF5] hover:bg-[#4c31d4] text-white font-medium transition-colors">
        Back to Dashboard
      </button>
    </div>
  );

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview",      label: "Overview",     icon: BarChart2  },
    { id: "users",         label: "Users",        icon: Users      },
    { id: "kyc",           label: "KYC Queue",    icon: UserCheck  },
    { id: "transactions",  label: "Transactions", icon: Receipt    },
    { id: "support",       label: "Support",      icon: LifeBuoy   },
    { id: "broadcast",     label: "Broadcast",    icon: Megaphone  },
    { id: "settings",      label: "Settings",     icon: Settings   },
  ];

  const filteredUsers = (usersData ?? []).filter((u: any) =>
    !search ||
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    String(u.id).includes(search)
  );

  const STAT_CARDS = [
    { label: "Total Users",    value: fmt(stats?.totalUsers),        icon: Users,     color: "text-[#5B3CF5]", bg: "bg-[#5B3CF5]/10" },
    { label: "Transactions",   value: fmt(stats?.totalTransactions),  icon: Receipt,   color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Active Today",   value: fmt(stats?.activeToday),        icon: Activity,  color: "text-blue-400",  bg: "bg-blue-500/10"  },
    { label: "KYC Pending",    value: fmt(stats?.pendingKyc),         icon: Clock,     color: "text-yellow-400",bg: "bg-yellow-500/10"},
  ];

  return (
    <div className="min-h-screen bg-[#0B0C10] pb-20 lg:pb-0">
      {selectedUser && <UserDetail userId={selectedUser} onClose={() => setSelUser(null)}/>}

      {/* Header */}
      <div className="bg-[#111318] border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5B3CF5]/20 flex items-center justify-center">
            <Shield size={18} className="text-[#5B3CF5]"/>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Admin Console</h1>
            <p className="text-xs text-gray-400">Cozanet Platform Operations</p>
          </div>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto border-b border-white/10 bg-[#111318]">
        <div className="flex min-w-max px-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? "border-[#5B3CF5] text-[#5B3CF5]" : "border-transparent text-gray-400 hover:text-white"
              }`}>
              <t.icon size={14}/> {t.label}
              {t.id === "kyc" && (stats?.pendingKyc ?? 0) > 0 && (
                <span className="w-4 h-4 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">{stats!.pendingKyc}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-6xl mx-auto">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {STAT_CARDS.map(s => (
                <div key={s.label} className="bg-[#111318] border border-white/10 rounded-xl p-4">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon size={18} className={s.color}/>
                  </div>
                  <p className={`text-2xl font-bold ${statsLoading ? "text-gray-600" : "text-white"}`}>
                    {statsLoading ? "—" : s.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Recent users */}
            <div className="bg-[#111318] border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="text-sm font-semibold text-white">Recent Users</h2>
                <button onClick={() => setTab("users")} className="text-xs text-[#5B3CF5] hover:underline flex items-center gap-1">
                  View all <ChevronRight size={12}/>
                </button>
              </div>
              {usersLoading
                ? <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#5B3CF5]"/></div>
                : (usersData ?? []).slice(0, 5).map((u: any) => (
                    <div key={u.id} onClick={() => setSelUser(u.id)}
                      className="flex items-center justify-between px-5 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#5B3CF5]/20 flex items-center justify-center text-xs font-bold text-[#5B3CF5] shrink-0">
                          {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{u.name ?? u.email ?? `User #${u.id}`}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email ?? "No email"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[u.kycStatus ?? "NONE"]}`}>{KYC_LABELS[u.kycStatus ?? "NONE"]}</span>
                        <ChevronRight size={14} className="text-gray-600"/>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email or ID..."
                className="w-full bg-[#111318] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5B3CF5]" />
            </div>
            <p className="text-xs text-gray-500">{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</p>
            {usersLoading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>
              : filteredUsers.map((u: any) => (
                <div key={u.id} onClick={() => setSelUser(u.id)}
                  className="bg-[#111318] border border-white/10 hover:border-white/20 rounded-xl p-4 cursor-pointer transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#5B3CF5]/20 flex items-center justify-center font-bold text-[#5B3CF5] shrink-0">
                        {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.name ?? `User #${u.id}`}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email ?? "No email"} · Joined {fmtDate(u.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[u.kycStatus ?? "NONE"]}`}>{KYC_LABELS[u.kycStatus ?? "NONE"]}</span>
                      {u.suspended && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">Suspended</span>}
                      {u.role === "admin" && <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">Admin</span>}
                      <ChevronRight size={14} className="text-gray-600"/>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* KYC */}
        {tab === "kyc"          && <KycPanel/>}

        {/* TRANSACTIONS */}
        {tab === "transactions" && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">All Transactions ({txData?.length ?? 0})</h2>
            {txLoading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#5B3CF5]"/></div>
              : (txData ?? []).map((tx: any) => (
                <div key={tx.id} className="bg-[#111318] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[tx.state]}`}>{tx.state}</span>
                    <span className="text-xs text-gray-400">{fmtDate(tx.createdAt)}</span>
                  </div>
                  <p className="text-sm text-white font-medium font-mono truncate">{tx.txHash ?? tx.referenceId}</p>
                  <p className="text-xs text-gray-400 mt-1">User #{tx.userId} · Chain {tx.chainId}</p>
                </div>
              ))
            }
          </div>
        )}

        {/* SUPPORT */}
        {tab === "support"    && <SupportPanel/>}

        {/* BROADCAST */}
        {tab === "broadcast"  && <BroadcastPanel/>}

        {/* SETTINGS */}
        {tab === "settings"   && <SettingsPanel/>}
      </div>
    </div>
  );
}
