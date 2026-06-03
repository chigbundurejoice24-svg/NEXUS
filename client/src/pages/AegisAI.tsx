/**
 * AegisAI.tsx — Live smart assistant powered by real on-chain + account data
 * Replaces static mockData with tRPC ai.getInsights
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, TrendingUp, Shield, Zap, Activity,
  BarChart3, Sparkles, AlertTriangle, ChevronRight,
  Loader2, RefreshCw, Search, X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// ── FAQ data (static — expandable later) ─────────────────────────
const FAQ = [
  { q: "How do I send money?", a: "Go to Send Money, enter the recipient bank details, choose your wallet, and confirm with Face ID. Funds arrive in minutes." },
  { q: "What is Cozanet (CZN)?", a: "CZN is the utility token of the Cozanet ecosystem. Hold CZN to get discounts on transfer fees — the more you hold, the more you save." },
  { q: "Is my wallet safe?", a: "Yes. Aegis is non-custodial — your private keys are derived from your biometric passkey and never stored on our servers." },
  { q: "How do I verify my email?", a: "Go to Settings → Security → Email Verification and enter your email. A 6-digit code will be sent instantly." },
  { q: "What are my transfer limits?", a: "Unverified accounts: $100/day. Email verified: $10,000/day. KYC verified: $50,000/day." },
  { q: "Which banks are supported?", a: "All 27 Nigerian commercial banks are supported, including GTBank, Access Bank, UBA, First Bank, Zenith, and more." },
  { q: "How fast are transfers?", a: "Most bank deposits arrive within 5–10 minutes. In rare cases during high network load, it can take up to 30 minutes." },
  { q: "What is the transfer fee?", a: "The base fee is 1% of the transfer amount. Hold CZN to reduce this — down to 0.5% or less." },
];

// ── Insight type → icon + color ──────────────────────────────────
const TYPE_MAP: Record<string, { icon: React.ElementType; bg: string; iconColor: string }> = {
  discount:  { icon: Sparkles,      bg: "bg-green-50 dark:bg-green-900/20",   iconColor: "text-green-600 dark:text-green-400" },
  savings:   { icon: TrendingUp,    bg: "bg-blue-50 dark:bg-blue-900/20",     iconColor: "text-blue-600 dark:text-blue-400" },
  portfolio: { icon: BarChart3,     bg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-aegis-accent-purple" },
  activity:  { icon: Activity,      bg: "bg-indigo-50 dark:bg-indigo-900/20", iconColor: "text-indigo-600 dark:text-indigo-400" },
  market:    { icon: Zap,           bg: "bg-yellow-50 dark:bg-yellow-900/20", iconColor: "text-yellow-600 dark:text-yellow-500" },
  tip:       { icon: Brain,         bg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-aegis-accent-purple" },
  warning:   { icon: AlertTriangle, bg: "bg-yellow-50 dark:bg-yellow-900/20", iconColor: "text-yellow-600" },
};

const BADGE_COLOR: Record<string, string> = {
  green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500",
  red:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ── Insight Card ──────────────────────────────────────────────────
function InsightCard({ insight, delay }: { insight: any; delay: number }) {
  const cfg   = TYPE_MAP[insight.type] ?? TYPE_MAP.tip;
  const Icon  = cfg.icon;
  const badge = insight.badge ? (BADGE_COLOR[insight.badgeColor ?? "purple"] ?? BADGE_COLOR.purple) : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border rounded-2xl p-5 flex gap-4"
    >
      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon size={18} className={cfg.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white leading-snug">{insight.title}</p>
          {insight.badge && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge}`}>
              {insight.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-aegis-secondary-dark leading-relaxed">{insight.body}</p>
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function AegisAI() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const firstName = (user as any)?.name?.split(" ")[0] ?? "there";
  const [faqQuery, setFaqQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = trpc.ai.getInsights.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  const filteredFaq = faqQuery.trim()
    ? FAQ.filter(f => f.q.toLowerCase().includes(faqQuery.toLowerCase()) || f.a.toLowerCase().includes(faqQuery.toLowerCase()))
    : FAQ;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark">Your intelligent financial assistant</p>

      {/* AI Header card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#5B3CF5] via-[#6B4CF5] to-[#3B5BDB] rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs><pattern id="ai-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#ai-grid)"/>
          </svg>
        </div>
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <Brain size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold">Aegis AI</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-white/20 rounded-full">LIVE</span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed">
              Hey {firstName}! I'm analysing your account right now — here are your personalised financial insights.
            </p>
            {data && (
              <div className="flex items-center gap-4 mt-3 text-xs text-white/60">
                {data.totalValueUsd > 0 && <span>Portfolio: <b className="text-white">${data.totalValueUsd.toFixed(2)}</b></span>}
                {data.cznPriceUsd > 0 && <span>CZN: <b className="text-white">${data.cznPriceUsd.toFixed(4)}</b></span>}
                {!data.emailVerified && <span className="text-yellow-300">⚠ Email unverified</span>}
              </div>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
            title="Refresh insights"
          >
            <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
          </button>
        </div>
      </motion.div>

      {/* Insights */}
      <div>
        <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-3">Your Insights</h3>

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-12 text-aegis-tertiary-dark">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Analysing your account…</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <AlertTriangle size={32} className="mx-auto mb-2 text-yellow-500" />
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white mb-1">Could not load insights</p>
            <p className="text-xs text-aegis-tertiary-dark mb-3">Connect a wallet and sign in to see your personalised data.</p>
            <button onClick={() => navigate("/wallets")}
              className="text-xs text-aegis-accent-purple font-medium flex items-center gap-1 mx-auto">
              Connect Wallet <ChevronRight size={12} />
            </button>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-3">
            {data.insights.map((ins: any, i: number) => (
              <InsightCard key={ins.id} insight={ins} delay={i * 0.07} />
            ))}
          </div>
        )}
      </div>

      {/* FAQ / Ask a question */}
      <div>
        <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-3">Ask a Question</h3>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
          <input
            type="text"
            placeholder="Search FAQs — e.g. 'transfer limits', 'fees', 'CZN'…"
            value={faqQuery}
            onChange={e => setFaqQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          {faqQuery && (
            <button onClick={() => setFaqQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark hover:text-aegis-primary-dark">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {filteredFaq.length === 0 ? (
            <p className="text-sm text-aegis-tertiary-dark text-center py-4">No results for "{faqQuery}"</p>
          ) : filteredFaq.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{item.q}</p>
                <ChevronRight
                  size={16}
                  className={`text-aegis-tertiary-dark flex-shrink-0 transition-transform ${expandedFaq === i ? "rotate-90" : ""}`}
                />
              </button>
              <AnimatePresence>
                {expandedFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-sm text-aegis-secondary-dark leading-relaxed border-t border-border pt-3">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
