/**
 * Dashboard.tsx — Main home screen
 *
 * Speed: reads portfolio from DB snapshot via tRPC.portfolio.get
 * → <100ms for returning users (no blockchain RPC calls at render time)
 * → Live RPC calls only happen server-side via background cron
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send, Download, PlusCircle, ArrowLeftRight, Eye, EyeOff,
  TrendingUp, ChevronRight, Wallet, Plus, Copy, Check, Loader2,
} from "lucide-react";
import { useNgnRate } from "@/hooks/useNgnRate";
import { useCurrentUser } from "@/hooks/useAuth";
import { usePortfolioSnapshot } from "@/hooks/usePortfolioSnapshot";
import { trpc } from "@/lib/trpc";

const QUICK_ACTIONS = [
  { id: "send",     title: "Send",     icon: Send,            href: "/send"     },
  { id: "receive",  title: "Receive",  icon: Download,        href: "/receive"  },
  { id: "fund",     title: "Fund",     icon: PlusCircle,      href: "/fund"     },
  { id: "exchange", title: "Swap",     icon: ArrowLeftRight,  href: "/exchange" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [copiedAddr, setCopiedAddr]   = useState(false);

  const { user }                  = useCurrentUser();
  const { rate: NGN_PER_USD }     = useNgnRate();
  const {
    snapshot, totalValueUsd, assets, perWallet,
    isLoading: snapLoading, hasSnapshot,
  } = usePortfolioSnapshot();

  // unread notification badge
  const { data: unread } = trpc.notify.unreadCount.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const firstName           = user?.name?.split(" ")[0] ?? "there";
  const embeddedAddr        = (user as any)?.walletAddress as string | null ?? null;
  const usdtNgn             = NGN_PER_USD > 0 ? NGN_PER_USD : 1595.20;
  const totalNgn            = totalValueUsd * usdtNgn;

  // Build wallet list from snapshot or fallback to embedded wallet stub
  const walletList = perWallet.length > 0
    ? perWallet
    : embeddedAddr
      ? [{ wallet: embeddedAddr, label: "My Aegis Wallet", assets: [], totalValueUsd: "0.00" }]
      : [];

  const primaryWallet = walletList[0] ?? null;

  function copyWallet() {
    if (!primaryWallet) return;
    navigator.clipboard.writeText(primaryWallet.wallet);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-aegis-secondary-dark">
            Welcome back, {firstName}! 👋
          </h2>
          <p className="text-sm text-aegis-tertiary-dark mt-0.5">
            Move value across Africa instantly
          </p>
        </div>
        {/* Notification badge */}
        {(unread?.count ?? 0) > 0 && (
          <button
            onClick={() => navigate("/notifications")}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-card border border-border"
          >
            <span className="w-2 h-2 bg-[#5B3CF5] rounded-full absolute top-1.5 right-1.5" />
            <span className="text-xs font-bold text-aegis-primary-dark dark:text-white">
              {unread!.count > 9 ? "9+" : unread!.count}
            </span>
          </button>
        )}
      </div>

      {/* Hero Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#5B3CF5] via-[#6B4CF5] to-[#3B5BDB] p-6 sm:p-8 text-white"
      >
        {/* Grid bg */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                  Total Balance
                </span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {snapLoading ? (
                <div className="flex items-center gap-2 h-10">
                  <Loader2 size={20} className="animate-spin text-white/60" />
                  <span className="text-white/60 text-sm">Loading balance…</span>
                </div>
              ) : (
                <>
                  <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                    {showBalance
                      ? `$${totalValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "••••••"}
                  </h3>
                  <p className="text-sm text-white/70 mt-1">
                    {showBalance
                      ? `≈ ₦${totalNgn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "••••••"}
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(({ id, title, icon: Icon, href }) => (
                <button
                  key={id}
                  onClick={() => navigate(href)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm"
                >
                  <Icon size={16} />
                  {title}
                </button>
              ))}
            </div>
          </div>

          {/* Live rate */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 min-w-[180px]">
            <p className="text-xs text-white/60 mb-1">Today's Rate</p>
            <p className="text-xs text-white/60">1 USDT =</p>
            <p className="text-xl font-semibold mt-1">₦{usdtNgn.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={12} className="text-green-300" />
              <span className="text-xs text-green-300">Live</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Primary Wallet Card */}
      {primaryWallet ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Wallet size={16} className="text-aegis-accent-purple" />
              </div>
              <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                {primaryWallet.label ?? "My Aegis Wallet"}
              </p>
            </div>
            <button
              onClick={() => navigate("/wallets")}
              className="text-xs text-aegis-accent-purple font-medium flex items-center gap-1 hover:opacity-80"
            >
              Manage <ChevronRight size={12} />
            </button>
          </div>

          <div className="flex items-center gap-2 p-3 bg-aegis-bg-elevated rounded-xl mb-3">
            <p className="text-xs font-mono text-aegis-primary-dark dark:text-white flex-1 truncate">
              {primaryWallet.wallet}
            </p>
            <button onClick={copyWallet} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0">
              {copiedAddr
                ? <Check size={14} className="text-green-500" />
                : <Copy  size={14} className="text-aegis-tertiary-dark" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-aegis-tertiary-dark">Balance</p>
              <p className="font-semibold text-aegis-primary-dark dark:text-white">
                {showBalance
                  ? `$${parseFloat(primaryWallet.totalValueUsd ?? "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "••••••"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-aegis-tertiary-dark">Wallets</p>
              <p className="font-semibold text-aegis-primary-dark dark:text-white">
                {walletList.length} connected
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate("/wallets")}
          whileHover={{ y: -2 }}
          className="w-full bg-card border-2 border-dashed border-border rounded-2xl p-5 flex items-center gap-4 hover:border-aegis-accent-purple/40 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center">
            <Plus size={20} className="text-aegis-accent-purple" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
              Connect Your Wallet
            </p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">
              Track your live crypto balance
            </p>
          </div>
          <ChevronRight size={16} className="text-aegis-tertiary-dark ml-auto" />
        </motion.button>
      )}

      {/* Assets breakdown */}
      {assets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
              Assets
            </h3>
            <button
              onClick={() => navigate("/wallets")}
              className="text-xs text-aegis-accent-purple font-medium flex items-center gap-1"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {assets.slice(0, 5).map((asset, i) => (
              <motion.div
                key={`${asset.network}-${asset.token}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center">
                    <span className="text-xs font-bold text-aegis-accent-purple">
                      {asset.token.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                      {asset.token}
                    </p>
                    <p className="text-xs text-aegis-tertiary-dark capitalize">{asset.network}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                    {showBalance ? `$${parseFloat(asset.valueUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "••••••"}
                  </p>
                  <p className="text-xs text-aegis-tertiary-dark">
                    {parseFloat(asset.totalBalance).toFixed(4)} {asset.token}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no wallets */}
      {!snapLoading && !hasSnapshot && walletList.length === 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate("/wallets")}
          className="w-full bg-card border border-dashed border-border rounded-xl p-6 text-center hover:border-aegis-accent-purple/40 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center mx-auto mb-3">
            <Plus size={20} className="text-aegis-accent-purple" />
          </div>
          <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
            Add your first wallet
          </p>
          <p className="text-xs text-aegis-tertiary-dark mt-1">
            Connect an EVM wallet to track live balances across 4 networks
          </p>
        </motion.button>
      )}
    </div>
  );
}
