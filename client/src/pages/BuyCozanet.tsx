/**
 * BuyCozanet.tsx — Buy CZN tokens via PancakeSwap on BSC
 *
 * Verified 2026-06-05:
 *   Contract: 0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA
 *   Decimals: 9 (NOT 18)
 *   Route: USDT → WBNB → CZN (no direct USDT/CZN pair)
 *   Gas: sponsored by Aegis (user pays 0 BNB)
 *   Fee: deducted in USDT from user's wallet
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useWallets } from "@/hooks/useWallets";
import {
  ArrowLeft, Zap, TrendingUp, Loader2, CheckCircle,
  AlertTriangle, ChevronRight, Coins, Info, HelpCircle,
  ExternalLink, X, Copy, ArrowRight, Shield, Wallet,
} from "lucide-react";

// ── Token constants (verified on-chain) ───────────────────────────
const CZN_ADDRESS  = "0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA";
const CZN_DECIMALS = 9;   // ⚠️ 9, not 18
const USDT_DECIMALS = 18;

const PANCAKESWAP_URL = `https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${CZN_ADDRESS}`;
const BSCSCAN_URL     = `https://bscscan.com/token/${CZN_ADDRESS}`;

function toRaw(amount: string, decimals: number): string {
  try {
    const [whole, frac = ""] = amount.split(".");
    const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(whole + padded).toString();
  } catch { return "0"; }
}

function fromRaw(raw: string | undefined, decimals: number, dp = 4): string {
  try {
    if (!raw || raw === "0") return "0." + "0".repeat(dp);
    const n = BigInt(raw);
    const divisor = 10n ** BigInt(decimals);
    const whole = n / divisor;
    const frac  = n % divisor;
    const fracStr = frac.toString().padStart(decimals, "0").slice(0, dp);
    return `${whole}.${fracStr}`;
  } catch { return "0.00"; }
}

// ── Step indicator ─────────────────────────────────────────────────
const STEPS = ["Amount", "Review", "Confirm"] as const;
type Step = "input" | "review" | "signing" | "done";

function StepDots({ step }: { step: Step }) {
  const idx = step === "input" ? 0 : step === "review" ? 1 : 2;
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < idx  ? "bg-green-500 text-white"   :
            i === idx ? "bg-[#5B3CF5] text-white"  :
            "bg-aegis-bg-elevated text-aegis-tertiary-dark"
          }`}>{i < idx ? "✓" : i + 1}</div>
          {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < idx ? "bg-green-500" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── How to Buy Guide Modal ─────────────────────────────────────────
function GuideModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    navigator.clipboard.writeText(CZN_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#5B3CF5]/20 flex items-center justify-center">
              <HelpCircle size={16} className="text-[#5B3CF5]"/>
            </div>
            <h2 className="font-bold dark:text-white">How to Get CZN</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors">
            <X size={16} className="text-aegis-tertiary-dark"/>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Option 1: Buy in Aegis */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#5B3CF5] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
              <h3 className="font-semibold dark:text-white">Buy directly in Aegis (easiest)</h3>
            </div>
            <div className="ml-8 space-y-2 text-sm text-aegis-secondary-dark">
              <p>Use this page — enter a USDT amount, get a live quote, and confirm in one tap.</p>
              <div className="flex items-start gap-2 p-3 bg-[#5B3CF5]/10 border border-[#5B3CF5]/20 rounded-xl">
                <Shield size={13} className="text-[#5B3CF5] mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-[#5B3CF5]">Gas is paid by Aegis. You only need USDT — no BNB required. Fee is deducted in USDT from your wallet.</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-border"/>

          {/* Option 2: PancakeSwap */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
              <h3 className="font-semibold dark:text-white">Buy on PancakeSwap (manually)</h3>
            </div>
            <div className="ml-8 space-y-3">
              {[
                { step: "Open PancakeSwap on BSC Chain", desc: "Go to pancakeswap.finance and ensure BSC network is selected" },
                { step: "Paste CZN contract address", desc: "PancakeSwap may not find CZN by name — paste the contract address directly" },
                { step: "Set USDT as input token", desc: "PancakeSwap routes USDT → WBNB → CZN automatically" },
                { step: "Set slippage to 5-10%", desc: "CZN may have a transfer tax — higher slippage prevents failed transactions" },
                { step: "Confirm in your wallet", desc: "You need BNB for gas when using PancakeSwap directly" },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-aegis-bg-elevated border border-border text-xs text-aegis-tertiary-dark flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</div>
                  <div>
                    <p className="text-sm font-medium dark:text-white">{item.step}</p>
                    <p className="text-xs text-aegis-tertiary-dark mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}

              {/* Contract address copy */}
              <div className="p-3 bg-aegis-bg-elevated border border-border rounded-xl">
                <p className="text-xs text-aegis-tertiary-dark mb-1.5">CZN Contract Address (BSC)</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-[#5B3CF5] font-mono flex-1 truncate">{CZN_ADDRESS}</code>
                  <button onClick={copyAddress}
                    className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${copied ? "bg-green-500/20 text-green-400" : "hover:bg-card text-aegis-tertiary-dark"}`}>
                    {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
                  </button>
                </div>
              </div>

              <a href={PANCAKESWAP_URL} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-semibold hover:bg-yellow-500/30 transition-colors">
                Open PancakeSwap <ExternalLink size={13}/>
              </a>
            </div>
          </div>

          <div className="h-px bg-border"/>

          {/* Safety warnings */}
          <div className="space-y-2">
            <h3 className="font-semibold dark:text-white flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400"/> Safety Tips
            </h3>
            <div className="space-y-2">
              {[
                "Only buy from PancakeSwap or in-app — no other DEXes are verified",
                "Always verify the contract address matches exactly",
                "Never send funds to the contract address directly",
                "BSC network only — do not buy on Ethereum or other chains",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-aegis-secondary-dark">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-2">
            <a href={BSCSCAN_URL} target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-border rounded-xl text-xs text-aegis-tertiary-dark hover:border-[#5B3CF5]/50 hover:text-[#5B3CF5] transition-colors">
              BSCScan <ExternalLink size={11}/>
            </a>
            <a href={PANCAKESWAP_URL} target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-border rounded-xl text-xs text-aegis-tertiary-dark hover:border-yellow-500/50 hover:text-yellow-400 transition-colors">
              PancakeSwap <ExternalLink size={11}/>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function BuyCozanet() {
  const navigate   = useNavigate();
  const { linkedWallets } = useWallets();

  const [usdtAmount, setUsdtAmount] = useState("");
  const [step, setStep]             = useState<Step>("input");
  const [quote, setQuote]           = useState<any>(null);
  const [txHash, setTxHash]         = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [showGuide, setShowGuide]   = useState(false);
  const [copied, setCopied]         = useState(false);

  const embeddedWallet = linkedWallets.find(w => w.type === "EMBEDDED") ?? linkedWallets[0] ?? null;
  const usdtRaw = usdtAmount ? toRaw(usdtAmount, USDT_DECIMALS) : "0";

  const quoteMut = trpc.cozanet.buyQuote.useQuery(
    { usdtAmountRaw: usdtRaw },
    { enabled: false, retry: false }
  );
  const buyMut = trpc.cozanet.buy.useMutation();

  function copyAddress() {
    navigator.clipboard.writeText(CZN_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Step 1: Get quote ─────────────────────────────────────────
  const handleGetQuote = useCallback(async () => {
    setError(null);
    const amt = parseFloat(usdtAmount);
    if (!amt || amt <= 0)  { setError("Enter a valid USDT amount"); return; }
    if (amt < 1)           { setError("Minimum is 1 USDT"); return; }
    if (!embeddedWallet)   { setError("No wallet found — check Wallets page"); return; }

    try {
      const result = await quoteMut.refetch();
      if (result.data) {
        setQuote(result.data);
        setStep("review");
      } else if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (e: any) {
      setError(e?.message ?? "Quote failed — check your internet connection");
    }
  }, [usdtAmount, embeddedWallet, quoteMut]);

  // ── Step 2: Sign + send ───────────────────────────────────────
  const handleBuy = useCallback(async () => {
    if (!quote || !embeddedWallet) return;
    setStep("signing");
    setError(null);

    try {
      const built = await buyMut.mutateAsync({
        usdtAmountRaw: quote.usdtAmountRaw,
        cozanetOutRaw: quote.cozanetOutRaw,
        amountOutMin:  quote.amountOutMin,
        feeRaw:        quote.feeRaw,
        walletAddress: embeddedWallet.address,
      });

      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error("No wallet extension — use MetaMask or a Web3 browser");

      await ethereum.request({ method: "eth_requestAccounts" });

      // Switch to BSC
      try {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await ethereum.request({ method: "wallet_addEthereumChain", params: [{
            chainId: "0x38", chainName: "BNB Smart Chain",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: ["https://bsc-dataseed.binance.org"],
            blockExplorerUrls: ["https://bscscan.com"],
          }] });
        }
      }

      let lastHash = "";
      for (const tx of built.transactions) {
        lastHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: embeddedWallet.address, to: tx.to, data: tx.data, value: "0x0" }],
        });
      }

      if (!lastHash) throw new Error("No transaction hash returned");
      setTxHash(lastHash);
      setStep("done");
    } catch (e: any) {
      setError(e?.message ?? "Transaction failed");
      setStep("review");
    }
  }, [quote, embeddedWallet, buyMut]);

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24 lg:pb-6">
      {showGuide && <GuideModal onClose={() => setShowGuide(false)}/>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
            <ArrowLeft size={18} className="text-aegis-secondary-dark"/>
          </button>
          <div>
            <h1 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <Coins size={20} className="text-[#5B3CF5]"/> Buy CZN
            </h1>
            <p className="text-xs text-aegis-tertiary-dark">USDT → WBNB → CZN · PancakeSwap · BSC</p>
          </div>
        </div>
        <button onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:border-[#5B3CF5]/50 text-xs text-aegis-tertiary-dark hover:text-[#5B3CF5] transition-colors">
          <HelpCircle size={13}/> Guide
        </button>
      </div>

      {step !== "done" && <StepDots step={step}/>}

      {/* ── INPUT ── */}
      {step === "input" && (
        <div className="space-y-4">
          {/* Token info strip */}
          <div className="flex items-center justify-between px-4 py-3 bg-aegis-bg-elevated border border-border rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#5B3CF5]/20 flex items-center justify-center">
                <span className="text-xs font-bold text-[#5B3CF5]">C</span>
              </div>
              <div>
                <p className="text-sm font-semibold dark:text-white">Cozanet (CZN)</p>
                <p className="text-xs text-aegis-tertiary-dark">BEP-20 · 9 decimals</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copyAddress}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${copied ? "border-green-500/40 text-green-400" : "border-border text-aegis-tertiary-dark hover:border-[#5B3CF5]/40"}`}>
                {copied ? <CheckCircle size={11}/> : <Copy size={11}/>}
                {copied ? "Copied!" : CZN_ADDRESS.slice(0,6)+"…"+CZN_ADDRESS.slice(-4)}
              </button>
            </div>
          </div>

          {/* USDT input */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <label className="text-xs text-aegis-tertiary-dark block">You Pay (USDT · BSC)</label>
            <div className="relative">
              <input
                type="number"
                value={usdtAmount}
                onChange={e => setUsdtAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                className="w-full text-3xl font-bold bg-transparent border-none outline-none dark:text-white pr-20"
              />
              <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-bold text-aegis-tertiary-dark">USDT</span>
            </div>
            <div className="h-px bg-border"/>
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

          {/* You receive */}
          <div className="bg-aegis-bg-elevated rounded-2xl p-4 space-y-1">
            <p className="text-xs text-aegis-tertiary-dark">You receive (estimated)</p>
            <p className="text-2xl font-bold text-[#5B3CF5]">
              {quoteMut.data
                ? `${fromRaw(quoteMut.data.cozanetOutRaw, CZN_DECIMALS, 2)} CZN`
                : usdtAmount ? "…" : "– CZN"}
            </p>
            <div className="flex items-center gap-2 text-xs text-aegis-tertiary-dark">
              <TrendingUp size={11}/>
              Live · PancakeSwap V2 · Route: USDT→WBNB→CZN
            </div>
          </div>

          {/* Wallet */}
          {embeddedWallet ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-400">
              <Wallet size={12}/>
              Aegis Wallet: {embeddedWallet.address.slice(0,6)}…{embeddedWallet.address.slice(-4)}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-400">
              <AlertTriangle size={12}/> No wallet — check the Wallets page
            </div>
          )}

          {/* Fee + gas note */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-[#5B3CF5]/10 border border-[#5B3CF5]/30 rounded-xl text-xs text-[#5B3CF5]">
            <Shield size={12} className="mt-0.5 flex-shrink-0"/>
            <span>0.5% Aegis fee deducted in USDT · <strong>Gas is free</strong> — Aegis sponsors all network fees. You need 0 BNB.</span>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              <AlertTriangle size={12}/> {error}
            </div>
          )}

          <button
            onClick={handleGetQuote}
            disabled={!usdtAmount || parseFloat(usdtAmount) <= 0 || quoteMut.isFetching}
            className="w-full py-4 gradient-brand text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50">
            {quoteMut.isFetching ? <Loader2 size={18} className="animate-spin"/> : <Zap size={18}/>}
            Get Live Quote
          </button>

          {/* Fallback: direct PancakeSwap link */}
          <a href={PANCAKESWAP_URL} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 border border-border rounded-2xl text-sm text-aegis-tertiary-dark hover:border-yellow-500/50 hover:text-yellow-400 transition-colors">
            <ExternalLink size={14}/> Or buy on PancakeSwap directly
          </a>
        </div>
      )}

      {/* ── REVIEW ── */}
      {step === "review" && quote && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold dark:text-white">Purchase Summary</h3>

            {/* Route visualization */}
            <div className="flex items-center justify-center gap-2 py-3 bg-aegis-bg-elevated rounded-xl">
              <div className="text-center">
                <p className="text-xs text-aegis-tertiary-dark">You Pay</p>
                <p className="text-sm font-bold dark:text-white">{fromRaw(quote.usdtAmountRaw, USDT_DECIMALS, 2)} USDT</p>
              </div>
              <ArrowRight size={14} className="text-aegis-tertiary-dark"/>
              <div className="text-center px-2 py-1 bg-yellow-500/10 rounded-lg">
                <p className="text-xs text-yellow-400">via WBNB</p>
              </div>
              <ArrowRight size={14} className="text-aegis-tertiary-dark"/>
              <div className="text-center">
                <p className="text-xs text-aegis-tertiary-dark">You Receive</p>
                <p className="text-sm font-bold text-[#5B3CF5]">{fromRaw(quote.cozanetOutRaw, CZN_DECIMALS, 2)} CZN</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              {[
                { label: "Price",     value: `1 CZN ≈ $${quote.pricePerToken} USDT` },
                { label: "Aegis fee", value: `${fromRaw(quote.feeRaw, USDT_DECIMALS, 4)} USDT (${quote.effectiveFeePercent}%)`, note: "charged in USDT" },
                { label: "Gas",       value: "Free (Aegis sponsored)", green: true },
                { label: "Slippage",  value: "1% protection" },
                { label: "Network",   value: "BSC (BNB Smart Chain)" },
                { label: "Route",     value: "USDT → WBNB → CZN" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-aegis-tertiary-dark">{row.label}</span>
                  <div className="text-right">
                    <span className={`font-semibold ${row.green ? "text-green-400" : "dark:text-white"}`}>{row.value}</span>
                    {row.note && <p className="text-[10px] text-aegis-tertiary-dark">{row.note}</p>}
                  </div>
                </div>
              ))}
            </div>

            {quote.discountPercent > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-400">
                <Zap size={11}/> {quote.discountPercent}% discount — you're holding CZN!
              </div>
            )}

            {quote.priceImpactWarning && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-400">
                <AlertTriangle size={11}/> High price impact — consider a smaller amount
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              <AlertTriangle size={12}/> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setStep("input"); setError(null); }}
              className="flex-1 py-3.5 border border-border rounded-2xl text-sm font-semibold text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors">
              Back
            </button>
            <button onClick={handleBuy} disabled={buyMut.isPending}
              className="flex-[2] py-3.5 gradient-brand text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {buyMut.isPending ? <Loader2 size={18} className="animate-spin"/> : <ChevronRight size={18}/>}
              Confirm & Buy
            </button>
          </div>
        </div>
      )}

      {/* ── SIGNING ── */}
      {step === "signing" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
          <div className="w-20 h-20 rounded-full bg-[#5B3CF5]/20 border border-[#5B3CF5]/40 flex items-center justify-center">
            <Loader2 size={36} className="animate-spin text-[#5B3CF5]"/>
          </div>
          <p className="text-xl font-bold dark:text-white">Processing…</p>
          <p className="text-sm text-aegis-tertiary-dark max-w-[260px]">
            Signing transactions. Gas is sponsored by Aegis — you only sign, no BNB needed.
          </p>
        </div>
      )}

      {/* ── DONE ── */}
      {step === "done" && (
        <div className="flex flex-col items-center justify-center py-10 space-y-5 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
            <CheckCircle size={40} className="text-green-400"/>
          </div>
          <h2 className="text-2xl font-bold dark:text-white">Swap Complete!</h2>
          <p className="text-sm text-aegis-tertiary-dark">
            ~{fromRaw(quote?.cozanetOutRaw ?? "0", CZN_DECIMALS, 2)} CZN arriving in your wallet.
          </p>
          <p className="text-xs text-aegis-tertiary-dark px-4">
            Aegis fee was deducted in USDT · Gas was free
          </p>

          {txHash && (
            <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#5B3CF5] underline underline-offset-2">
              View on BSCScan <ExternalLink size={11}/>
            </a>
          )}

          <div className="flex gap-3 w-full max-w-xs">
            <button onClick={() => { setStep("input"); setQuote(null); setTxHash(""); setUsdtAmount(""); }}
              className="flex-1 py-3 border border-border rounded-2xl text-sm font-semibold text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors">
              Buy More
            </button>
            <button onClick={() => navigate("/")}
              className="flex-1 py-3 gradient-brand text-white rounded-2xl font-semibold text-sm">
              Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
