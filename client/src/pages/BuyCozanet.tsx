/**
 * BuyCozanet.tsx — Buy CZN tokens with USDT via PancakeSwap on BSC
 *
 * Flow:
 *   Enter USDT → Get Quote (live DEX price) → Review (fee + discount) → Sign → Done
 *
 * Non-custodial: user signs the tx batch with their embedded (passkey) or external wallet.
 * Gas is sponsored via ZeroDev paymaster — user needs 0 BNB.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useWallets } from "@/hooks/useWallets";
import {
  ArrowLeft, Zap, TrendingUp, Loader2, CheckCircle,
  AlertTriangle, ChevronRight, Coins, Info
} from "lucide-react";

// ── Decimal helpers ───────────────────────────────────────────────
const USDT_DEC  = 18;  // BSC USDT has 18 decimals
const CZN_DEC   = 18;

function toRaw(amount: string, decimals: number): string {
  try {
    const [whole, frac = ""] = amount.split(".");
    const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(whole + padded).toString();
  } catch { return "0"; }
}

function fromRaw(raw: string, decimals: number, dp = 2): string {
  try {
    const n = BigInt(raw);
    const divisor = 10n ** BigInt(decimals);
    const whole = n / divisor;
    const frac  = n % divisor;
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, dp);
    return `${whole}.${fracStr}`;
  } catch { return "0.00"; }
}

// ── Step indicator ────────────────────────────────────────────────
const STEPS = ["Amount", "Quote", "Sign"] as const;
type Step = "input" | "review" | "signing" | "done";

function StepDots({ step }: { step: Step }) {
  const idx = step === "input" ? 0 : step === "review" ? 1 : 2;
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < idx ? "bg-green-500 text-white" :
            i === idx ? "bg-[#5B3CF5] text-white" :
            "bg-aegis-bg-elevated text-aegis-tertiary-dark"
          }`}>
            {i < idx ? "✓" : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 ${i < idx ? "bg-green-500" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function BuyCozanet() {
  const navigate   = useNavigate();
  const { linkedWallets } = useWallets();

  const [usdtAmount, setUsdtAmount]   = useState("");
  const [step, setStep]               = useState<Step>("input");
  const [quote, setQuote]             = useState<any>(null);
  const [txHash, setTxHash]           = useState<string>("");
  const [error, setError]             = useState<string | null>(null);

  // Best wallet: prefer BSC embedded, fallback to first linked
  const embeddedWallet = linkedWallets.find(w => w.type === "EMBEDDED") ?? linkedWallets[0] ?? null;

  const usdtRaw = usdtAmount ? toRaw(usdtAmount, USDT_DEC) : "0";

  // tRPC
  const quoteMut = trpc.cozanet.buyQuote.useQuery(
    { usdtAmountRaw: usdtRaw },
    { enabled: false, retry: false }
  );
  const buyMut = trpc.cozanet.buy.useMutation();

  // ── Step 1: Fetch quote ───────────────────────────────────────
  const handleGetQuote = useCallback(async () => {
    setError(null);
    const amt = parseFloat(usdtAmount);
    if (!amt || amt <= 0) { setError("Enter a valid USDT amount"); return; }
    if (amt < 1)          { setError("Minimum purchase is 1 USDT"); return; }
    if (!embeddedWallet)  { setError("No wallet found — add a wallet in the Wallets page first"); return; }

    try {
      const result = await quoteMut.refetch();
      if (result.data) {
        setQuote(result.data);
        setStep("review");
      } else if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to get quote");
    }
  }, [usdtAmount, embeddedWallet, quoteMut]);

  // ── Step 2: Build + sign ─────────────────────────────────────
  const handleBuy = useCallback(async () => {
    if (!quote || !embeddedWallet) return;
    setStep("signing");
    setError(null);

    try {
      // Build tx batch on server
      const built = await buyMut.mutateAsync({
        usdtAmountRaw: quote.usdtAmountRaw,
        cozanetOutRaw: quote.cozanetOutRaw,
        amountOutMin:  quote.amountOutMin,
        feeRaw:        quote.feeRaw,
        walletAddress: embeddedWallet.address,
      });

      // Sign with external wallet (MetaMask) — BSC chain
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("No wallet extension detected. Please use MetaMask or a Web3 browser.");

      await ethereum.request({ method: "eth_requestAccounts" });
      // Switch to BSC
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }], // 0x38 = 56
        });
      } catch (switchErr: any) {
        // Add BSC if not present
        if (switchErr.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x38",
              chainName: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: ["https://bsc-dataseed.binance.org"],
              blockExplorerUrls: ["https://bscscan.com"],
            }],
          });
        }
      }

      let lastHash = "";
      for (const tx of built.transactions) {
        const hash: string = await ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from:  embeddedWallet.address,
            to:    tx.to,
            data:  tx.data,
            value: "0x0",
          }],
        });
        lastHash = hash;
      }

      if (!lastHash) throw new Error("No transaction hash returned");
      setTxHash(lastHash);
      setStep("done");
    } catch (e: any) {
      setError(e?.message ?? "Transaction failed");
      setStep("review");
    }
  }, [quote, embeddedWallet, buyMut]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <ArrowLeft size={18} className="text-aegis-secondary-dark" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-aegis-primary-dark dark:text-white flex items-center gap-2">
            <Coins size={20} className="text-[#5B3CF5]" /> Buy Cozanet
          </h1>
          <p className="text-xs text-aegis-tertiary-dark">USDT → CZN via PancakeSwap · BSC</p>
        </div>
      </div>

      {step !== "done" && <StepDots step={step} />}

      {/* ── INPUT ── */}
      {step === "input" && (
        <div className="space-y-4">
          {/* USDT input */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs text-aegis-tertiary-dark mb-2 block">You Pay (USDT · BSC)</label>
              <div className="relative">
                <input
                  type="number"
                  value={usdtAmount}
                  onChange={e => setUsdtAmount(e.target.value)}
                  placeholder="0.00"
                  min="1"
                  step="0.01"
                  className="w-full text-2xl font-bold bg-transparent border-none outline-none text-aegis-primary-dark dark:text-white pr-20 py-1"
                />
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-semibold text-aegis-tertiary-dark">USDT</span>
              </div>
              <div className="h-px bg-border mt-3" />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2">
              {["10","50","100","500"].map(v => (
                <button key={v} onClick={() => setUsdtAmount(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    usdtAmount === v ? "border-[#5B3CF5] bg-[#5B3CF5]/20 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark hover:border-[#5B3CF5]/50"
                  }`}>
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* You receive preview */}
          <div className="bg-aegis-bg-elevated rounded-2xl p-4 space-y-2">
            <p className="text-xs text-aegis-tertiary-dark">You receive (estimated)</p>
            <p className="text-lg font-bold text-[#5B3CF5]">
              {quoteMut.data
                ? `${fromRaw(quoteMut.data.cozanetOutRaw, CZN_DEC, 4)} CZN`
                : usdtAmount ? "…" : "– CZN"}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark">
              <TrendingUp size={11} />
              Live rate · PancakeSwap V2
            </div>
          </div>

          {/* Wallet info */}
          {embeddedWallet ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-400">
              <CheckCircle size={12} />
              Wallet: {embeddedWallet.address.slice(0,6)}…{embeddedWallet.address.slice(-4)}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-400">
              <AlertTriangle size={12} />
              No wallet — add one in the Wallets page
            </div>
          )}

          {/* Fee note */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-[#5B3CF5]/10 border border-[#5B3CF5]/30 rounded-xl text-xs text-[#5B3CF5]">
            <Info size={12} className="mt-0.5 flex-shrink-0" />
            0.5% Aegis fee — reduced by holding CZN. Gas is sponsored (free).
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <button
            onClick={handleGetQuote}
            disabled={!usdtAmount || parseFloat(usdtAmount) <= 0 || quoteMut.isFetching}
            className="w-full py-4 gradient-brand text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {quoteMut.isFetching ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
            Get Live Quote
          </button>
        </div>
      )}

      {/* ── REVIEW ── */}
      {step === "review" && quote && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-aegis-primary-dark dark:text-white">Purchase Summary</h3>

            {[
              { label: "You pay",       value: `${fromRaw(quote.usdtAmountRaw, USDT_DEC, 4)} USDT` },
              { label: "You receive",   value: `${fromRaw(quote.cozanetOutRaw, CZN_DEC, 4)} CZN`, highlight: true },
              { label: "Aegis fee",     value: `${fromRaw(quote.feeRaw, USDT_DEC, 4)} USDT (${quote.effectiveFeePercent}%)` },
              { label: "Network",       value: "BSC (BNB Smart Chain)" },
              { label: "Gas cost",      value: "Free (sponsored)" },
              { label: "Slippage",      value: "1%" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-aegis-tertiary-dark">{row.label}</span>
                <span className={`font-semibold ${row.highlight ? "text-[#5B3CF5]" : "text-aegis-primary-dark dark:text-white"}`}>
                  {row.value}
                </span>
              </div>
            ))}

            {quote.discountPercent > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-400">
                <Zap size={11} /> {quote.discountPercent}% fee discount applied — thanks for holding CZN!
              </div>
            )}

            {quote.priceImpactWarning && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-400">
                <AlertTriangle size={11} /> Low liquidity warning — price impact may be high
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setStep("input"); setError(null); }}
              className="flex-1 py-3.5 border border-border rounded-2xl text-sm font-semibold text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors">
              Back
            </button>
            <button onClick={handleBuy} disabled={buyMut.isPending}
              className="flex-[2] py-3.5 gradient-brand text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {buyMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
              Confirm & Buy
            </button>
          </div>
        </div>
      )}

      {/* ── SIGNING ── */}
      {step === "signing" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-5">
          <div className="w-20 h-20 rounded-full bg-[#5B3CF5]/20 border border-[#5B3CF5]/40 flex items-center justify-center">
            <Loader2 size={36} className="animate-spin text-[#5B3CF5]" />
          </div>
          <p className="text-xl font-bold text-aegis-primary-dark dark:text-white">Signing…</p>
          <p className="text-sm text-aegis-tertiary-dark text-center max-w-[260px]">
            Approve the transaction in your wallet. Gas is covered — you only need to sign.
          </p>
        </div>
      )}

      {/* ── DONE ── */}
      {step === "done" && (
        <div className="flex flex-col items-center justify-center py-10 space-y-5 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-aegis-primary-dark dark:text-white">Purchase Complete!</h2>
          <p className="text-sm text-aegis-tertiary-dark">
            {fromRaw(quote?.cozanetOutRaw ?? "0", CZN_DEC, 4)} CZN is on its way to your wallet.
          </p>

          {txHash && (
            <a
              href={`https://bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#5B3CF5] underline underline-offset-2"
            >
              View on BscScan ↗
            </a>
          )}

          <div className="flex gap-3 w-full pt-4">
            <button onClick={() => { setStep("input"); setUsdtAmount(""); setQuote(null); setTxHash(""); }}
              className="flex-1 py-3.5 border border-border rounded-2xl text-sm font-semibold text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors">
              Buy More
            </button>
            <button onClick={() => navigate("/")}
              className="flex-1 py-3.5 gradient-brand text-white rounded-2xl font-bold text-sm">
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
