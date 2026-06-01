import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send, Download, PlusCircle, ArrowLeftRight, Eye, EyeOff,
  TrendingUp, ChevronRight, Wallet, Plus, RefreshCw,
} from "lucide-react";
import { quickActions } from "@/data/mockData";
import { useState } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useCurrentUser } from "@/hooks/useAuth";
import { useRates } from "@/hooks/useRates";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const { user } = useCurrentUser();
  const { portfolio, portfolioLoading, linkedWallets, linkedWalletsLoading } = useWallets();
  const { prices } = useRates();

  // Live USDT/NGN rate from CoinGecko (fallback 0)
  const usdtPriceUsd = prices["ethereum:USDT"] ?? 1;
  // Approximate NGN rate using BTC/ETH cross — for display, use a fixed NGN/USD rate from rates page
  const NGN_PER_USD = 1595.20; // This will be live once rates page fetches it
  const totalUsd = parseFloat(portfolio?.totalValueUsd ?? "0");
  const totalNgn = totalUsd * NGN_PER_USD;

  // Per-wallet enriched breakdown
  const perWallet = portfolio?.perWallet ?? [];

  const firstName = user?.name?.split(" ")[0] ?? "there";

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
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Total Balance</span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {portfolioLoading ? (
                <Skeleton className="h-10 w-48 bg-white/20 rounded-lg" />
              ) : (
                <>
                  <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                    {showBalance
                      ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "••••••"}
                  </h3>
                  <p className="text-sm text-white/70 mt-1">
                    {showBalance
                      ? `≈ ₦${totalNgn.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "••••••"}
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate("/fund")}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <PlusCircle size={16} /> Add Funds
              </button>
              <button
                onClick={() => navigate("/send")}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <Send size={16} /> Send Money
              </button>
              <button
                onClick={() => navigate("/receive")}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <Download size={16} /> Receive
              </button>
            </div>
          </div>

          {/* Live rate mini card */}
          <div className="glass-panel rounded-xl p-4 text-white min-w-[200px]">
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
              Live Rates
            </span>
            <div className="mt-2 space-y-1.5">
              {Object.entries(prices).slice(0, 3).map(([key, price]) => {
                const symbol = key.split(":")[1];
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-white/60">{symbol}</span>
                    <span className="text-sm font-semibold">
                      ${(price as number).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={12} className="text-green-300" />
              <span className="text-xs text-green-300">Live via CoinGecko</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map((action, index) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => navigate(action.href)}
            whileHover={{ y: -4 }}
            className="group p-4 sm:p-5 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all text-left"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:-translate-y-1"
              style={{ background: action.gradient }}
            >
              {action.icon === "Send" && <Send size={18} className="text-white" />}
              {action.icon === "Download" && <Download size={18} className="text-white" />}
              {action.icon === "PlusCircle" && <PlusCircle size={18} className="text-white" />}
              {action.icon === "ArrowLeftRight" && <ArrowLeftRight size={18} className="text-white" />}
            </div>
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{action.title}</h3>
            <p className="text-xs text-aegis-secondary-dark mt-0.5">{action.description}</p>
          </motion.button>
        ))}
      </div>

      {/* My Wallets — real data */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">My Wallets</h3>
          <button
            onClick={() => navigate("/wallets")}
            className="text-sm text-aegis-accent-purple hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        {linkedWalletsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : linkedWallets.length === 0 ? (
          /* Empty state — prompt to connect wallet */
          <motion.button
            onClick={() => navigate("/wallets")}
            whileHover={{ y: -2 }}
            className="w-full border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 p-10 hover:border-aegis-accent-purple/40 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-aegis-bg-elevated flex items-center justify-center">
              <Plus size={24} className="text-aegis-accent-purple" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Connect Your First Wallet</p>
              <p className="text-xs text-aegis-tertiary-dark mt-0.5">Add an EVM wallet to see your real balance</p>
            </div>
          </motion.button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {perWallet.slice(0, 4).map((wData, index) => {
              const walletTotalUsd = parseFloat(wData.totalValueUsd);
              const walletTotalNgn = walletTotalUsd * NGN_PER_USD;
              const linked = linkedWallets.find(
                (lw) => lw.address.toLowerCase() === wData.wallet.toLowerCase()
              );
              return (
                <motion.div
                  key={wData.wallet}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <div className="h-2 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB]" />
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                        <Wallet size={14} className="text-aegis-accent-purple" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white truncate">
                          {linked?.label ?? `Wallet ${index + 1}`}
                        </p>
                        <p className="text-[10px] text-aegis-tertiary-dark font-mono truncate">
                          {wData.wallet.slice(0, 6)}…{wData.wallet.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-aegis-primary-dark dark:text-white">
                      ${walletTotalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-aegis-secondary-dark mt-0.5">
                      ≈ ₦{walletTotalNgn.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <div className="mt-3 text-xs text-aegis-tertiary-dark">
                      {wData.assets.length} asset{wData.assets.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Transactions — from real tRPC once TX module is live */}
      <RecentTransactions />
    </div>
  );
}

function RecentTransactions() {
  const { data, isLoading } = trpc.wallets.listWallets.useQuery();
  // Placeholder until Transaction State Machine is built
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">Recent Transactions</h3>
        <button className="text-sm text-aegis-accent-purple hover:opacity-80 flex items-center gap-1">
          View all <ChevronRight size={14} />
        </button>
      </div>
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
        <RefreshCw size={20} className="text-aegis-tertiary-dark" />
        <p className="text-sm text-aegis-secondary-dark">Transaction history coming in Phase 2</p>
        <p className="text-xs text-aegis-tertiary-dark">Transaction State Machine is the next module to be built</p>
      </div>
    </div>
  );
}
