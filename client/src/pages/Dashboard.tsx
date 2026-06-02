import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Send, Download, PlusCircle, ArrowLeftRight, Eye, EyeOff,
  TrendingUp, ChevronRight, Wallet, Plus, RefreshCw,
} from "lucide-react";
import {
  quickActions, wallets as mockWallets, exchangeRates as mockRates, userProfile,
} from "@/data/mockData";
import { useState } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useCurrentUser } from "@/hooks/useAuth";
import { useRates } from "@/hooks/useRates";
import { Skeleton } from "@/components/ui/skeleton";

const NGN_PER_USD = 1595.20;

export default function Dashboard() {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const { user } = useCurrentUser();
  const { portfolio, portfolioLoading, linkedWallets, linkedWalletsLoading } = useWallets();
  const { prices } = useRates();

  // Use real data if available, fall back to mock
  const hasRealWallets = linkedWallets.length > 0;
  const totalUsd = hasRealWallets
    ? parseFloat(portfolio?.totalValueUsd ?? "0")
    : mockWallets.reduce((s, w) => s + w.balance, 0);
  const totalNgn = hasRealWallets
    ? totalUsd * NGN_PER_USD
    : mockWallets.reduce((s, w) => s + w.fiatValue, 0);

  const firstName = user?.name?.split(" ")[0] ?? userProfile.name.split(" ")[0];

  // Live USDT rate from prices or mock
  const usdtNgn = mockRates.find(r => r.from === "USDT")?.rate ?? 1595.20;

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
          <svg width="100%" height="100%"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/></svg>
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
                {showBalance ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "••••••"}
              </h3>
              <p className="text-sm text-white/70 mt-1">
                {showBalance ? `≈ ₦${totalNgn.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "••••••"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate("/fund")} className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2">
                <PlusCircle size={16} /> Add Funds
              </button>
              <button onClick={() => navigate("/send")} className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2">
                <Send size={16} /> Send Money
              </button>
              <button onClick={() => navigate("/receive")} className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2">
                <Download size={16} /> Receive
              </button>
            </div>
          </div>
          {/* Rate card */}
          <div className="glass-panel rounded-xl p-4 text-white min-w-[200px]">
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Today's Rate</span>
            <div className="mt-2">
              <p className="text-xs text-white/60">1 USDT =</p>
              <p className="text-2xl font-semibold">₦{usdtNgn.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp size={12} className="text-green-300" />
                <span className="text-xs text-green-300">+0.45%</span>
                <span className="text-xs text-white/40 ml-1">Live</span>
              </div>
            </div>
            <svg className="w-full h-10 mt-2" viewBox="0 0 200 40">
              <path d="M0,30 Q20,25 40,28 T80,20 T120,22 T160,15 T200,10" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
              <path d="M0,30 Q20,25 40,28 T80,20 T120,22 T160,15 T200,10 L200,40 L0,40 Z" fill="rgba(255,255,255,0.05)"/>
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map((action, index) => (
          <motion.button key={action.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }} onClick={() => navigate(action.href)} whileHover={{ y: -4 }}
            className="group p-4 sm:p-5 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all text-left">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: action.gradient }}>
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

      {/* Wallets — real if connected, mock otherwise */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">My Wallets</h3>
          <button onClick={() => navigate("/wallets")}
            className="text-sm text-aegis-accent-purple hover:opacity-80 transition-opacity flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(hasRealWallets
            ? (portfolio?.perWallet ?? []).slice(0, 4)
            : mockWallets.slice(0, 4).map((w) => ({ _mock: true, wallet: w.address, label: w.name, totalValueUsd: w.fiatValue.toString(), assets: [] }))
          ).map((wData: any, index: number) => {
            const walletUsd = hasRealWallets ? parseFloat(wData.totalValueUsd) : parseFloat(wData.totalValueUsd) / NGN_PER_USD;
            const walletNgn = walletUsd * NGN_PER_USD;
            const linked = linkedWallets.find(lw => lw.address.toLowerCase() === wData.wallet?.toLowerCase());
            return (
              <motion.div key={wData.wallet ?? index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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
                        {linked?.label ?? wData.label ?? `Wallet ${index + 1}`}
                      </p>
                      <p className="text-[10px] text-aegis-tertiary-dark font-mono truncate">
                        {wData.wallet ? `${wData.wallet.slice(0,6)}…${wData.wallet.slice(-4)}` : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-aegis-primary-dark dark:text-white">
                    ${walletUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-aegis-secondary-dark mt-0.5">
                    ≈ ₦{walletNgn.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => navigate("/send")}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white">Send</button>
                    <button onClick={() => navigate("/receive")}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white">Receive</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions placeholder */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">Recent Transactions</h3>
          <button onClick={() => navigate("/transactions")}
            className="text-sm text-aegis-accent-purple hover:opacity-80 flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]">
          <RefreshCw size={20} className="text-aegis-tertiary-dark" />
          <p className="text-sm text-aegis-secondary-dark">Connect your wallet to see live transactions</p>
          <button onClick={() => navigate("/wallets")}
            className="text-xs text-aegis-accent-purple hover:opacity-80 mt-1">Go to Wallets →</button>
        </div>
      </div>
    </div>
  );
}
