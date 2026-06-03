/**
 * Rewards.tsx — Buy Cozanet (CZN) Points — gas-sponsored, one-tap
 * 
 * Uses live cozanet.getStatus for discount tier data.
 * Shows USDT → CZN swap with fee breakdown + discount preview.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, TrendingUp, ChevronRight, Zap,
  CheckCircle2, Loader2, Info, AlertTriangle, ArrowDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useNgnRate } from "@/hooks/useNgnRate";
import { useWalletStore } from "@/hooks/useWalletStore";

const NGN_PER_USDT = 1595.20;

// CZN price fallback (will be overridden by live data)
const CZN_PRICE_FALLBACK = 0.0008;

// Tier display
const TIERS = [
  { label: "Starter",   min: 0,    max: 99,   discount: "0%",  color: "text-aegis-tertiary-dark" },
  { label: "Bronze",    min: 100,  max: 499,  discount: "10%", color: "text-yellow-600" },
  { label: "Silver",    min: 500,  max: 1999, discount: "25%", color: "text-blue-500" },
  { label: "Gold",      min: 2000, max: 9999, discount: "40%", color: "text-yellow-500" },
  { label: "Platinum",  min: 10000, max: Infinity, discount: "60%", color: "text-purple-500" },
];

type BuyStep = "form" | "confirm" | "success";

export default function Rewards() {
  const { totalUsd } = useWalletStore();
  const { rate: ngnRate } = useNgnRate();
  const [usdtAmount, setUsdtAmount] = useState("");
  const [step, setStep] = useState<BuyStep>("form");
  const [txId, setTxId] = useState<string | null>(null);

  // Live CZN status
  const { data: cznStatus, isLoading: cznLoading } = trpc.cozanet.getStatus.useQuery(
    { exampleAmountUsdt: parseFloat(usdtAmount) || 100 },
    { staleTime: 60_000, retry: 1 }
  );

  const cznPrice    = cznStatus?.priceUsd ?? CZN_PRICE_FALLBACK;
  const cznBalance  = parseFloat(cznStatus?.pointsBalance ?? "0");
  const discPct     = cznStatus?.discountPercent ?? 0;
  const effFeePct   = cznStatus?.effectiveFeePercent ?? 1.0;

  const usdtNum     = parseFloat(usdtAmount) || 0;
  const fee         = usdtNum * (effFeePct / 100);
  const netUsdt     = usdtNum - fee;
  const estimatedCzn = cznPrice > 0 ? netUsdt / cznPrice : 0;

  // Find current tier
  const currentTier = TIERS.findLast(t => cznBalance >= t.min) ?? TIERS[0];

  function handleBuy() {
    if (usdtNum <= 0) return;
    // Simulate a purchase (real tx builder integration goes here)
    setStep("confirm");
  }

  function handleConfirm() {
    setStep("success");
    setTxId(`0x${Math.random().toString(16).slice(2, 12)}...${Math.random().toString(16).slice(2, 8)}`);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark">Buy CZN to save on fees and earn rewards</p>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] rounded-2xl p-6 text-white"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Your CZN Balance</p>
            <p className="text-3xl font-bold">{cznLoading ? "—" : cznBalance.toFixed(2)}</p>
            <p className="text-sm text-white/60 mt-0.5">
              ≈ ${(cznBalance * cznPrice).toFixed(4)} USD
            </p>
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${currentTier.color} bg-white/10 rounded-full px-3 py-1`}>
              {currentTier.label}
            </div>
            <p className="text-xs text-white/60 mt-1">{currentTier.discount} fee discount</p>
          </div>
        </div>

        {/* Tier progress bar */}
        {cznBalance < 10000 && (
          <div className="mt-4">
            {(() => {
              const nextTier = TIERS.find(t => t.min > cznBalance);
              if (!nextTier) return null;
              const progress = Math.min(100, (cznBalance / nextTier.min) * 100);
              return (
                <>
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>{currentTier.label}</span>
                    <span>{nextTier.label} ({nextTier.min} CZN)</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </motion.div>

      <AnimatePresence mode="wait">

        {/* BUY FORM */}
        {step === "form" && (
          <motion.div key="form" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="space-y-4">

            {/* USDT input */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-3 block">You Pay</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated rounded-xl">
                  <span className="text-sm font-semibold text-aegis-primary-dark dark:text-white">USDT</span>
                </div>
                <input
                  type="number"
                  min="1"
                  placeholder="0.00"
                  value={usdtAmount}
                  onChange={e => setUsdtAmount(e.target.value)}
                  className="flex-1 text-2xl font-bold bg-transparent text-aegis-primary-dark dark:text-white focus:outline-none placeholder:text-aegis-tertiary-dark"
                />
              </div>
              {usdtNum > 0 && (
                <p className="text-xs text-aegis-tertiary-dark mt-2">
                  ≈ ₦{(usdtNum * (ngnRate || NGN_PER_USDT)).toLocaleString("en-US", { minimumFractionDigits: 2 })} NGN
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {[10, 50, 100, 500].map(v => (
                  <button key={v} onClick={() => setUsdtAmount(String(v))}
                    className="px-3 py-1 text-xs bg-aegis-bg-elevated rounded-lg text-aegis-secondary-dark hover:bg-aegis-accent-purple/10 hover:text-aegis-accent-purple transition-colors">
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-xl bg-aegis-bg-elevated border border-border flex items-center justify-center">
                <ArrowDown size={16} className="text-aegis-tertiary-dark" />
              </div>
            </div>

            {/* CZN output */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-3 block">You Receive</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                  <Sparkles size={14} className="text-yellow-600" />
                  <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">CZN</span>
                </div>
                <p className="text-2xl font-bold text-aegis-primary-dark dark:text-white">
                  {usdtNum > 0 ? estimatedCzn.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "0"}
                </p>
              </div>
            </div>

            {/* Fee breakdown */}
            {usdtNum > 0 && (
              <div className="bg-aegis-bg-elevated rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-aegis-tertiary-dark">Amount</span>
                  <span className="font-medium text-aegis-primary-dark dark:text-white">${usdtNum.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-aegis-tertiary-dark flex items-center gap-1">
                    Fee ({effFeePct}%)
                    {discPct > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{discPct}% off</span>}
                  </span>
                  <span className="font-medium text-aegis-primary-dark dark:text-white">${fee.toFixed(4)} USDT</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span className="text-aegis-primary-dark dark:text-white">You get ≈</span>
                  <span className="text-yellow-600 dark:text-yellow-400">{estimatedCzn.toLocaleString("en-US", { maximumFractionDigits: 0 })} CZN</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark mt-1">
                  <Zap size={12} className="text-green-500" />
                  <span>Gas sponsored by Cozanet — no BNB needed</span>
                </div>
              </div>
            )}

            <button
              onClick={handleBuy}
              disabled={usdtNum <= 0}
              className="w-full py-3.5 gradient-brand text-white rounded-xl font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Sparkles size={18} /> Buy {usdtNum > 0 ? estimatedCzn.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"} CZN
            </button>

            {/* Tier table */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-3">Discount Tiers</p>
              <div className="space-y-2">
                {TIERS.map(t => (
                  <div key={t.label} className={`flex items-center justify-between text-sm p-2 rounded-lg ${cznBalance >= t.min && (TIERS[TIERS.indexOf(t)+1]?.min ?? Infinity) > cznBalance ? "bg-aegis-bg-elevated" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={12} className={t.color} />
                      <span className={`font-medium ${t.color}`}>{t.label}</span>
                      <span className="text-xs text-aegis-tertiary-dark">{t.min === 0 ? "0" : t.min.toLocaleString()}+ CZN</span>
                    </div>
                    <span className={`font-semibold ${t.color}`}>{t.discount}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* CONFIRM */}
        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-aegis-primary-dark dark:text-white">Confirm Purchase</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-aegis-tertiary-dark">You pay</span><span className="font-semibold">${usdtNum.toFixed(2)} USDT</span></div>
              <div className="flex justify-between"><span className="text-aegis-tertiary-dark">You receive ≈</span><span className="font-semibold text-yellow-600">{estimatedCzn.toLocaleString("en-US", {maximumFractionDigits:0})} CZN</span></div>
              <div className="flex justify-between"><span className="text-aegis-tertiary-dark">Fee</span><span>${fee.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-aegis-tertiary-dark">Gas</span><span className="text-green-600">Sponsored ⚡</span></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep("form")} className="flex-1 py-3 border border-border rounded-xl text-sm text-aegis-secondary-dark">Cancel</button>
              <button onClick={handleConfirm} className="flex-1 py-3 gradient-brand text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Sparkles size={16} /> Confirm with Face ID
              </button>
            </div>
          </motion.div>
        )}

        {/* SUCCESS */}
        {step === "success" && (
          <motion.div key="success" initial={{ opacity:0,scale:.95 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0 }}
            className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-aegis-primary-dark dark:text-white mb-1">Purchase Successful!</h3>
              <p className="text-sm text-aegis-secondary-dark">You received approximately</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{estimatedCzn.toLocaleString("en-US",{maximumFractionDigits:0})} CZN</p>
            </div>
            {txId && (
              <p className="text-[11px] font-mono text-aegis-tertiary-dark bg-aegis-bg-elevated rounded-lg p-2">Tx: {txId}</p>
            )}
            <p className="text-xs text-aegis-tertiary-dark">Your balance will update in a few seconds</p>
            <button onClick={() => { setStep("form"); setUsdtAmount(""); }} className="w-full py-3 gradient-brand text-white rounded-xl text-sm font-semibold">
              Buy More CZN
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
