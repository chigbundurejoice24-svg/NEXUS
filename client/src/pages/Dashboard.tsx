import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send, Download, PlusCircle, ArrowLeftRight, Eye, EyeOff,
  TrendingUp, ChevronRight, Wallet, Plus,
} from "lucide-react";
import {
  quickActions, exchangeRates as mockRates, userProfile,
} from "@/data/mockData";
import { useState } from "react";
import { useWalletStore } from "@/hooks/useWalletStore";
import { useNgnRate } from "@/hooks/useNgnRate";
import { useCurrentUser } from "@/hooks/useAuth";

export default function Dashboard() {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const { wallets, totalUsd, totalNgn } = useWalletStore();

  const hasRealWallets = wallets.length > 0;
  const { rate: NGN_PER_USD } = useNgnRate();
  const { user } = useCurrentUser();
  const firstName = (user as any)?.name?.split(" ")[0] ?? userProfile.name.split(" ")[0];

  // Live USDT rate from mock rates
  const usdtNgn = mockRates.find(r => r.from === "USDT")?.rate ?? 1595.20;

  // Quick action icons
  const actionIconMap: Record<string, React.ElementType> = {
    Send, Download, PlusCircle, ArrowLeftRight,
  };

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
              <button onClick={() => navigate("/fund")}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm border border-white/20">
                <Plus size={15} /> Add Funds
              </button>
              <button onClick={() => navigate("/send")}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm border border-white/20">
                <Send size={15} /> Send Money
              </button>
              <button onClick={() => navigate("/receive")}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium transition-colors backdrop-blur-sm border border-white/20">
                <Download size={15} /> Receive
              </button>
            </div>
          </div>

          {/* Rate Card */}
          <div className="lg:min-w-[180px] bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Today's Rate</p>
            <p className="text-xs text-white/50 mb-2">1 USDT =</p>
            <p className="text-2xl font-semibold">₦{usdtNgn.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={12} className="text-green-300" />
              <span className="text-xs text-green-300">Live</span>
            </div>
            <div className="mt-3 h-10 opacity-40">
              <svg viewBox="0 0 100 30" className="w-full h-full">
                <polyline points="0,25 15,20 30,22 45,15 60,18 75,10 90,13 100,8"
                  fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-base font-semibold text-aegis-primary-dark dark:text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action, i) => {
            const Icon = actionIconMap[action.icon] ?? Send;
            return (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                onClick={() => navigate(action.href)}
                className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{ background: action.gradient }}>
                  <Icon size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white text-center">{action.title}</p>
                  <p className="text-xs text-aegis-tertiary-dark text-center mt-0.5">{action.description}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* My Wallets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">My Wallets</h3>
          <button onClick={() => navigate("/wallets")}
            className="text-sm text-aegis-accent-purple hover:opacity-80 transition-opacity flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>

        {!hasRealWallets ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-2 border-dashed border-border rounded-2xl p-8 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-aegis-bg-elevated flex items-center justify-center mx-auto mb-3">
              <Wallet size={22} className="text-aegis-tertiary-dark" />
            </div>
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white mb-1">No wallets connected yet</p>
            <p className="text-xs text-aegis-tertiary-dark mb-4">Connect a wallet to see your real balances here</p>
            <button onClick={() => navigate("/wallets")}
              className="px-4 py-2 gradient-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-glow">
              + Connect Wallet
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {wallets.slice(0, 4).map((w, index) => (
              <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }} whileHover={{ y: -4 }}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="h-2 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB]" />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                      <Wallet size={14} className="text-aegis-accent-purple" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white truncate">
                        {w.label || `Wallet ${index + 1}`}
                      </p>
                      <p className="text-[10px] text-aegis-tertiary-dark font-mono truncate">
                        {`${w.address.slice(0,6)}…${w.address.slice(-4)}`}
                      </p>
                    </div>
                  </div>
                  {w.loading ? (
                    <div className="h-6 bg-aegis-bg-elevated rounded animate-pulse mb-1" />
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-aegis-primary-dark dark:text-white">
                        ${w.balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-aegis-secondary-dark mt-0.5">
                        ≈ ₦{(w.balanceUsd * NGN_PER_USD).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => navigate("/send")}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white">Send</button>
                    <button onClick={() => navigate("/receive")}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white">Receive</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Rates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">Live Rates</h3>
          <button onClick={() => navigate("/rates")}
            className="text-sm text-aegis-accent-purple hover:opacity-80 flex items-center gap-1">
            See all <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mockRates.slice(0, 3).map((rate, i) => (
            <motion.div key={rate.from} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{rate.from}/{rate.to}</p>
                <p className="text-xs text-aegis-tertiary-dark mt-0.5">{rate.from} to {rate.to}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                  {rate.to === "NGN" ? `₦${rate.rate.toLocaleString()}` : `$${rate.rate.toLocaleString()}`}
                </p>
                <span className={`text-xs font-medium ${rate.change24h >= 0 ? "text-aegis-success-green" : "text-red-500"}`}>
                  {rate.change24h >= 0 ? "+" : ""}{rate.change24h}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
