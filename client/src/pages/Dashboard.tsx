import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send, Download, PlusCircle, ArrowLeftRight, Eye, EyeOff,
  TrendingUp, ChevronRight, Wallet, Plus, Copy, Check,
} from "lucide-react";
// Inline constants — no mockData dependency
const QUICK_ACTIONS = [
  { id: 'send',     title: 'Send',     icon: 'Send',            href: '/send' },
  { id: 'receive',  title: 'Receive',  icon: 'Download',        href: '/receive' },
  { id: 'fund',     title: 'Fund',     icon: 'PlusCircle',      href: '/fund' },
  { id: 'exchange', title: 'Swap',     icon: 'ArrowLeftRight',  href: '/exchange' },
];
import { useState } from "react";
import { useWalletStore } from "@/hooks/useWalletStore";
import { useNgnRate } from "@/hooks/useNgnRate";
import { useCurrentUser } from "@/hooks/useAuth";

export default function Dashboard() {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const { wallets, totalUsd, totalNgn } = useWalletStore();
  // Embedded wallet = auto-generated BSC wallet from DB (always present after signup)
  const embeddedWalletAddress: string | null = (user as any)?.walletAddress ?? null;

  const hasRealWallets = wallets.length > 0;
  const { rate: NGN_PER_USD } = useNgnRate();
  const { user } = useCurrentUser();
  const firstName = (user as any)?.name?.split(" ")[0] ?? "there";

  const usdtNgn = NGN_PER_USD > 0 ? NGN_PER_USD : 1595.20;

  const actionIconMap: Record<string, React.ElementType> = {
    Send, Download, PlusCircle, ArrowLeftRight,
  };

  // Prefer manually added wallets; fall back to embedded wallet
  const primaryWallet = wallets[0] ?? (embeddedWalletAddress ? { address: embeddedWalletAddress, label: "My Aegis Wallet", balanceUsd: 0 } : null);

  function copyWallet() {
    if (!primaryWallet) return;
    navigator.clipboard.writeText(primaryWallet.address);
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
      </div>

      {/* Hero Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#5B3CF5] via-[#6B4CF5] to-[#3B5BDB] p-6 sm:p-8 text-white"
      >
        <div className="absolute inset-0 opacity-10">
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
                <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Total Balance</span>
                <button onClick={() => setShowBalance(!showBalance)} className="text-white/50 hover:text-white transition-colors">
                  {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                {showBalance
                  ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "••••••"}
              </h3>
              <p className="text-sm text-white/70 mt-1">
                {showBalance
                  ? `≈ ₦${totalNgn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "••••••"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.slice(0, 4).map((action) => {
                const Icon = actionIconMap[action.icon] ?? Wallet;
                return (
                  <button
                    key={action.id}
                    onClick={() => navigate(action.href)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm"
                  >
                    <Icon size={16} />
                    {action.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rate card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 min-w-[180px]">
            <p className="text-xs text-white/60 mb-1">Today's Rate</p>
            <p className="text-xs text-white/60">1 USDT =</p>
            <p className="text-xl font-semibold mt-1">₦{usdtNgn.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={12} className="text-green-300" />
              <span className="text-xs text-green-300">+0.8% Live</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* My Wallet card */}
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
              <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">My Aegis Wallet</p>
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
              {primaryWallet.address}
            </p>
            <button onClick={copyWallet} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
              {copiedAddr
                ? <Check size={14} className="text-green-500" />
                : <Copy size={14} className="text-aegis-tertiary-dark" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-aegis-tertiary-dark">Balance</p>
              <p className="font-semibold text-aegis-primary-dark dark:text-white">
                {showBalance
                  ? `$${wallets[0]?.balanceUsd?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}`
                  : "••••••"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-aegis-tertiary-dark">Wallets</p>
              <p className="font-semibold text-aegis-primary-dark dark:text-white">{wallets.length} connected</p>
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
            <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Connect Your Wallet</p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">Track your live crypto balance</p>
          </div>
          <ChevronRight size={16} className="text-aegis-tertiary-dark ml-auto" />
        </motion.button>
      )}

      {/* My Wallets row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">My Wallets</h3>
          <button
            onClick={() => navigate("/wallets")}
            className="text-xs text-aegis-accent-purple font-medium flex items-center gap-1"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>

        {!hasRealWallets ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["Tether", "USD Coin", "Bitcoin", "Ethereum"].map((name, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-aegis-tertiary-dark">Mock</p>
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white mt-1">{name}</p>
                <p className="text-xs text-aegis-tertiary-dark font-mono mt-1">0x3F...B66E</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {wallets.slice(0, 4).map((w) => (
              <motion.div
                key={w.id}
                whileHover={{ y: -2 }}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer"
                onClick={() => navigate("/wallets")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Wallet size={14} className="text-aegis-accent-purple" />
                  </div>
                  <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{w.label}</p>
                </div>
                <p className="text-xs font-mono text-aegis-tertiary-dark truncate">{w.address.slice(0,8)}...{w.address.slice(-4)}</p>
                <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white mt-2">
                  {showBalance ? `$${w.balanceUsd?.toFixed(2) ?? "0.00"}` : "••••"}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
