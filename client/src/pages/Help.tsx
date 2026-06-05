/**
 * Help.tsx — Support tickets + FAQ
 * Real tRPC data, polished loading/empty states
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  LifeBuoy, Plus, ChevronRight, Clock, CheckCircle, AlertCircle,
  XCircle, ArrowLeft, Send, MessageSquare, Loader2, ChevronDown, HelpCircle,
} from "lucide-react";

const STATUS_CFG: Record<string, { label: string; color: string; Icon: any }> = {
  OPEN:        { label: "Open",        color: "bg-blue-500/20 text-blue-400",    Icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-yellow-500/20 text-yellow-400",Icon: AlertCircle },
  RESOLVED:    { label: "Resolved",    color: "bg-green-500/20 text-green-400",  Icon: CheckCircle },
  CLOSED:      { label: "Closed",      color: "bg-gray-500/20 text-gray-400",    Icon: XCircle },
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "text-green-400", MEDIUM: "text-yellow-400", HIGH: "text-red-400",
};

const FAQ = [
  { q: "How do I send money?",     a: "Go to Send Money, enter recipient bank details, choose your wallet, and confirm. Funds arrive in minutes." },
  { q: "What is Cozanet (CZN)?",   a: "CZN is the utility token. Hold CZN to get discounts on fees — from 10% (Bronze) up to 60% (Platinum)." },
  { q: "Is my wallet safe?",       a: "Yes. Aegis is non-custodial. Your keys are derived from your biometric passkey and never stored on any server." },
  { q: "How do I verify my email?",a: "Settings → Security → Email Verification. Enter your email and a 6-digit code will be sent instantly." },
  { q: "What are my transfer limits?", a: "Unverified: $100/day. Email verified: $10,000/day. KYC verified: $50,000/day." },
  { q: "Which banks are supported?",   a: "All 27 Nigerian commercial banks — GTBank, Access, UBA, First Bank, Zenith, and more." },
  { q: "How fast are transfers?",   a: "Most bank deposits arrive in 5–10 minutes. During high network load, up to 30 minutes." },
  { q: "What is the fee?",         a: "Base fee is 1% of the transfer amount. Hold CZN to reduce this — down to 0.4% at Platinum tier." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-aegis-bg-elevated/50 transition-colors gap-3">
        <p className="text-sm font-medium dark:text-white">{q}</p>
        <ChevronDown size={15} className={`text-aegis-tertiary-dark flex-shrink-0 transition-transform ${open?"rotate-180":""}`}/>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
            className="overflow-hidden">
            <p className="px-5 pb-4 text-sm text-aegis-secondary-dark leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [reply, setReply] = useState("");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.support.getTicket.useQuery({ ticketId });
  const addReply = trpc.support.addReply.useMutation({
    onSuccess: () => { setReply(""); utils.support.getTicket.invalidate({ ticketId }); },
  });

  if (isLoading) return <div className="flex items-center gap-2 py-8 justify-center"><Loader2 size={18} className="animate-spin text-aegis-tertiary-dark"/></div>;
  if (!data) return null;

  const { ticket, replies } = data;
  const cfg = STATUS_CFG[ticket.status] ?? STATUS_CFG.OPEN;
  const StatusIcon = cfg.Icon;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark hover:text-aegis-secondary-dark">
        <ArrowLeft size={13}/> Back to tickets
      </button>
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-sm font-semibold dark:text-white">{ticket.subject}</p>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
        </div>
        <p className="text-xs text-aegis-tertiary-dark mb-3">#{ticket.id} · {new Date(ticket.createdAt).toLocaleString()}</p>
        <p className="text-sm text-aegis-secondary-dark">{ticket.message}</p>
      </div>
      <div className="space-y-2">
        {replies.map(r => (
          <div key={r.id} className={`rounded-xl p-3 ${r.isAdmin ? "bg-[#5B3CF5]/10 border border-[#5B3CF5]/30 ml-4" : "bg-card border border-border"}`}>
            <p className={`text-xs font-semibold mb-1 ${r.isAdmin ? "text-[#5B3CF5]" : "dark:text-white"}`}>
              {r.isAdmin ? "🛡 Aegis Support" : "You"}
            </p>
            <p className="text-sm text-aegis-secondary-dark">{r.message}</p>
            <p className="text-[10px] text-aegis-tertiary-dark mt-1">{new Date(r.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
      {ticket.status !== "CLOSED" && ticket.status !== "RESOLVED" && (
        <div className="flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)}
            placeholder="Reply to support…"
            onKeyDown={e => e.key === "Enter" && reply.trim() && addReply.mutate({ ticketId, message: reply })}
            className="flex-1 px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
          <button onClick={() => reply.trim() && addReply.mutate({ ticketId, message: reply })}
            disabled={!reply.trim() || addReply.isPending}
            className="px-4 py-2.5 gradient-brand text-white rounded-xl disabled:opacity-50">
            {addReply.isPending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
          </button>
        </div>
      )}
    </div>
  );
}

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const [subject, setSubject]   = useState("");
  const [message, setMessage]   = useState("");
  const [priority, setPriority] = useState<"LOW"|"MEDIUM"|"HIGH">("MEDIUM");
  const utils = trpc.useUtils();
  const create = trpc.support.createTicket.useMutation({
    onSuccess: () => { utils.support.listMyTickets.invalidate(); onDone(); },
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold dark:text-white">New Support Ticket</h3>
      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
        className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] dark:text-white"/>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Describe your issue…"
        className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#5B3CF5] resize-none dark:text-white"/>
      <div className="flex gap-2">
        {(["LOW","MEDIUM","HIGH"] as const).map(p => (
          <button key={p} onClick={() => setPriority(p)}
            className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${priority===p ? "border-[#5B3CF5] bg-[#5B3CF5]/10 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
            {p}
          </button>
        ))}
      </div>
      {create.error && <p className="text-xs text-red-400">{create.error.message}</p>}
      <div className="flex gap-2">
        <button onClick={() => subject.trim() && message.trim() && create.mutate({ subject: subject.trim(), message: message.trim(), priority })}
          disabled={create.isPending || !subject.trim() || !message.trim()}
          className="flex-1 py-2.5 gradient-brand text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
          {create.isPending ? <><Loader2 size={14} className="animate-spin"/>Submitting…</> : <><Send size={14}/>Submit Ticket</>}
        </button>
        <button onClick={onDone} className="px-4 py-2.5 bg-aegis-bg-elevated border border-border text-aegis-secondary-dark rounded-xl text-sm hover:bg-card">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Help() {
  const [view, setView]       = useState<"list"|"new"|"detail">("list");
  const [ticketId, setTicketId] = useState<number|null>(null);
  const { data: tickets, isLoading } = trpc.support.listMyTickets.useQuery({ limit: 50, offset: 0 });

  if (view === "new") return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0 space-y-4">
      <button onClick={() => setView("list")} className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark hover:text-aegis-secondary-dark">
        <ArrowLeft size={13}/> Back
      </button>
      <NewTicketForm onDone={() => setView("list")}/>
    </div>
  );

  if (view === "detail" && ticketId) return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0 space-y-4">
      <TicketDetail ticketId={ticketId} onBack={() => setView("list")}/>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0 space-y-6">
      {/* New ticket CTA */}
      <button onClick={() => setView("new")}
        className="w-full flex items-center gap-3 bg-gradient-to-r from-[#5B3CF5]/10 to-[#3B5BDB]/10 border border-[#5B3CF5]/30 rounded-xl p-4 hover:from-[#5B3CF5]/20 hover:to-[#3B5BDB]/20 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-[#5B3CF5]/20 flex items-center justify-center flex-shrink-0">
          <Plus size={18} className="text-[#5B3CF5]"/>
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold dark:text-white">Open a Support Ticket</p>
          <p className="text-xs text-aegis-tertiary-dark">We typically respond within 2–4 hours</p>
        </div>
        <ChevronRight size={15} className="text-aegis-tertiary-dark"/>
      </button>

      {/* My tickets */}
      <div>
        <h3 className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-3">My Tickets</h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-aegis-tertiary-dark py-4 justify-center"><Loader2 size={16} className="animate-spin"/>Loading…</div>
        ) : !tickets?.length ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <MessageSquare size={28} className="text-aegis-tertiary-dark mx-auto mb-2"/>
            <p className="text-sm text-aegis-secondary-dark">No tickets yet</p>
            <p className="text-xs text-aegis-tertiary-dark mt-1">Have a problem? Open a ticket above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((t: any) => {
              const cfg = STATUS_CFG[t.status] ?? STATUS_CFG.OPEN;
              return (
                <button key={t.id} onClick={() => { setTicketId(t.id); setView("detail"); }}
                  className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-[#5B3CF5]/50 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold dark:text-white truncate">{t.subject}</p>
                    <p className="text-xs text-aegis-tertiary-dark">#{t.id} · {new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                  <ChevronRight size={13} className="text-aegis-tertiary-dark flex-shrink-0"/>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FAQ */}
      <div>
        <h3 className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-3 flex items-center gap-2">
          <HelpCircle size={13}/> Frequently Asked Questions
        </h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {FAQ.map((item, i) => <FAQItem key={i} q={item.q} a={item.a}/>)}
        </div>
      </div>
    </div>
  );
}
