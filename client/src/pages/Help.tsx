/**
 * Help.tsx — Customer Care / Support Tickets
 *
 * Users: submit tickets, view history, reply to tickets
 * Real-time admin replies → notification badge updates
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import {
  LifeBuoy, Plus, ChevronRight, Clock, CheckCircle, AlertCircle,
  XCircle, ArrowLeft, Send, MessageSquare, Loader2
} from "lucide-react";

// ── Status badge ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  OPEN:        { label: "Open",        color: "bg-blue-500/20 text-blue-400",   icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-yellow-500/20 text-yellow-400", icon: AlertCircle },
  RESOLVED:    { label: "Resolved",    color: "bg-green-500/20 text-green-400", icon: CheckCircle },
  CLOSED:      { label: "Closed",      color: "bg-gray-500/20 text-gray-400",   icon: XCircle },
};

const PRIORITY_CONFIG = {
  LOW:      { label: "Low",      color: "text-gray-400" },
  MEDIUM:   { label: "Medium",   color: "text-yellow-400" },
  HIGH:     { label: "High",     color: "text-orange-400" },
  CRITICAL: { label: "Critical", color: "text-red-400" },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.OPEN;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

// ── New Ticket Form ───────────────────────────────────────────────
function NewTicketForm({ onSuccess }: { onSuccess: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"LOW"|"MEDIUM"|"HIGH"|"CRITICAL">("MEDIUM");

  const create = trpc.support.createTicket.useMutation({
    onSuccess: () => { onSuccess(); setSubject(""); setMessage(""); },
  });

  const disabled = subject.length < 5 || message.length < 10 || create.isPending;

  return (
    <form
      onSubmit={e => { e.preventDefault(); create.mutate({ subject, message, priority }); }}
      className="bg-card border border-border rounded-2xl p-5 space-y-4"
    >
      <h3 className="font-semibold text-aegis-primary-dark dark:text-white">New Support Ticket</h3>

      <div>
        <label className="text-xs text-aegis-tertiary-dark mb-1 block">Subject</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Briefly describe your issue..."
          className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5]"
          maxLength={255}
        />
      </div>

      <div>
        <label className="text-xs text-aegis-tertiary-dark mb-1 block">Priority</label>
        <div className="flex gap-2 flex-wrap">
          {(["LOW","MEDIUM","HIGH","CRITICAL"] as const).map(p => (
            <button key={p} type="button"
              onClick={() => setPriority(p)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                priority === p
                  ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]"
                  : "border-border text-aegis-tertiary-dark hover:border-[#5B3CF5]/50"
              }`}>
              {PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-aegis-tertiary-dark mb-1 block">Message</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe your issue in detail..."
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] resize-none"
        />
      </div>

      {create.error && (
        <p className="text-xs text-red-400">{create.error.message}</p>
      )}

      <button type="submit" disabled={disabled}
        className="w-full py-3 gradient-brand text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        Submit Ticket
      </button>
    </form>
  );
}

// ── Ticket Detail ─────────────────────────────────────────────────
function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [reply, setReply] = useState("");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.support.getTicket.useQuery({ ticketId });
  const addReply = trpc.support.addReply.useMutation({
    onSuccess: () => { setReply(""); utils.support.getTicket.invalidate({ ticketId }); },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={24} className="animate-spin text-aegis-tertiary-dark" />
      </div>
    );
  }

  if (!data?.ticket) return <p className="text-sm text-red-400">Ticket not found</p>;

  const { ticket, replies } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <ArrowLeft size={18} className="text-aegis-secondary-dark" />
        </button>
        <div>
          <p className="font-semibold text-aegis-primary-dark dark:text-white text-sm">{ticket.subject}</p>
          <p className="text-xs text-aegis-tertiary-dark">Ticket #{ticket.id}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={ticket.status as any} />
        </div>
      </div>

      {/* Original message */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-aegis-tertiary-dark mb-1">Your message</p>
        <p className="text-sm text-aegis-secondary-dark">{ticket.message}</p>
        <p className="text-xs text-aegis-tertiary-dark mt-2">
          {new Date(ticket.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">Replies</p>
          {[...replies].reverse().map(r => (
            <div key={r.id}
              className={`rounded-xl p-3 ${r.isAdmin
                ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/30"
                : "bg-card border border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${r.isAdmin ? "text-[#5B3CF5]" : "text-aegis-primary-dark dark:text-white"}`}>
                  {r.isAdmin ? "🛡 Aegis Support" : "You"}
                </span>
                <span className="text-xs text-aegis-tertiary-dark">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-aegis-secondary-dark">{r.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form (only if ticket is not closed) */}
      {ticket.status !== "CLOSED" && ticket.status !== "RESOLVED" && (
        <div className="flex gap-2">
          <input
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Add a reply..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5]"
          />
          <button
            onClick={() => reply.trim() && addReply.mutate({ ticketId, message: reply })}
            disabled={!reply.trim() || addReply.isPending}
            className="px-4 py-2.5 gradient-brand text-white rounded-xl disabled:opacity-50">
            {addReply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Help Page ────────────────────────────────────────────────
export default function Help() {
  const [searchParams] = useSearchParams();
  const initialTicket = searchParams.get("ticket") ? Number(searchParams.get("ticket")) : null;

  const [view, setView] = useState<"list" | "new" | "detail">(initialTicket ? "detail" : "list");
  const [selectedTicket, setSelectedTicket] = useState<number | null>(initialTicket);
  const utils = trpc.useUtils();

  const { data: tickets, isLoading } = trpc.support.listUserTickets.useQuery();

  function openTicket(id: number) { setSelectedTicket(id); setView("detail"); }
  function goBack() { setSelectedTicket(null); setView("list"); utils.support.listUserTickets.invalidate(); }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-aegis-primary-dark dark:text-white flex items-center gap-2">
            <LifeBuoy size={20} className="text-[#5B3CF5]" /> Help & Support
          </h1>
          <p className="text-xs text-aegis-tertiary-dark mt-0.5">We typically respond within 24 hours</p>
        </div>
        {view === "list" && (
          <button onClick={() => setView("new")}
            className="flex items-center gap-1.5 px-3 py-2 gradient-brand text-white rounded-xl text-sm font-medium">
            <Plus size={14} /> New
          </button>
        )}
      </div>

      {/* Views */}
      {view === "new" && (
        <div>
          <button onClick={() => setView("list")} className="flex items-center gap-1 text-xs text-aegis-tertiary-dark mb-4 hover:text-white transition-colors">
            <ArrowLeft size={12} /> Back to tickets
          </button>
          <NewTicketForm onSuccess={() => { setView("list"); utils.support.listUserTickets.invalidate(); }} />
        </div>
      )}

      {view === "detail" && selectedTicket && (
        <TicketDetail ticketId={selectedTicket} onBack={goBack} />
      )}

      {view === "list" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="animate-spin text-aegis-tertiary-dark" />
            </div>
          ) : !tickets || tickets.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
              <MessageSquare size={36} className="mx-auto text-aegis-tertiary-dark opacity-40" />
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">No support tickets yet</p>
              <p className="text-xs text-aegis-tertiary-dark">Hit "New" to open a support request</p>
              <button onClick={() => setView("new")}
                className="mt-2 px-5 py-2.5 gradient-brand text-white rounded-xl text-sm font-medium inline-flex items-center gap-2">
                <Plus size={14} /> Open First Ticket
              </button>
            </div>
          ) : tickets.map(t => {
            const cfg = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.OPEN;
            return (
              <button key={t.id} onClick={() => openTicket(t.id)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-[#5B3CF5]/50 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white truncate">{t.subject}</p>
                  <p className="text-xs text-aegis-tertiary-dark mt-0.5">
                    #{t.id} · {new Date(t.createdAt).toLocaleDateString()}
                    <span className={`ml-2 ${PRIORITY_CONFIG[t.priority as keyof typeof PRIORITY_CONFIG]?.color ?? ""}`}>
                      {PRIORITY_CONFIG[t.priority as keyof typeof PRIORITY_CONFIG]?.label ?? t.priority}
                    </span>
                  </p>
                </div>
                <StatusBadge status={t.status as keyof typeof STATUS_CONFIG} />
                <ChevronRight size={16} className="text-aegis-tertiary-dark flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
