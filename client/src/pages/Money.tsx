/**
 * Money.tsx — Unified Money Hub
 *
 * 4 tabs in one page:
 *   Send    → Bank remittance (NGN) — from SendMoney.tsx
 *   Receive → Wallet QR + address   — from ReceiveMoney.tsx
 *   Fund    → On-ramp (buy crypto)  — from FundWallet.tsx
 *   Swap    → DEX swap (blockchain) — from Exchange.tsx
 *
 * Route: /money  (replaces /send, /receive, /fund, /exchange)
 * Old routes redirect here with ?tab=send|receive|fund|swap
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Download, PlusCircle, ArrowUpDown,
  ChevronDown, AlertCircle, Check, ArrowRight, Loader2,
  ShieldCheck, AlertTriangle, Zap, Search, Building2,
  Hash, User, Banknote, Copy, Share2, Wallet,
  ExternalLink, RefreshCw, Info, Star, Clock,
  CheckCheck, Shield, XCircle,
} from "lucide-react";
import { useWallets }       from "@/hooks/useWallets";
import { useCurrentUser }   from "@/hooks/useAuth";
import { useWalletStore }   from "@/hooks/useWalletStore";
import { useNgnRate }       from "@/hooks/useNgnRate";
import { trpc, getToken }   from "@/lib/trpc";
import { queryClient }      from "@/lib/queryClient";
import { parseUnits }       from "viem";
import { NIGERIAN_BANKS, type Bank } from "@/data/nigerian-banks";
import type { BuildPayload } from "@/lib/app-router-type";
import { Skeleton } from "@/components/ui/skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "send" | "receive" | "fund" | "swap";

const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "send",    label: "Send",    icon: Send,        desc: "Bank remittance" },
  { id: "receive", label: "Receive", icon: Download,    desc: "Show QR & address" },
  { id: "fund",    label: "Fund",    icon: PlusCircle,  desc: "Buy crypto" },
  { id: "swap",    label: "Swap",    icon: ArrowUpDown, desc: "DEX exchange" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Send tab — bank remittance
// ─────────────────────────────────────────────────────────────────────────────
const CHAINS = [
  { id: 56, label: "BNB Chain (BEP20)", token: "USDT", decimals: 18 },
  { id: 1,  label: "Ethereum (ERC20)",  token: "USDT", decimals: 6  },
];

type SendStep = "form" | "quoting" | "review" | "signing" | "submitted" | "error";

interface QuoteInfo {
  provider: string; estimatedFiat: number; fiatCurrency: string;
  fee: number; feePercent: number; rate: number; estimatedTime: string;
}

function SendTab() {
  const { linkedWallets } = useWallets();
  const [selWalletIdx, setSelWalletIdx] = useState(0);
  const [chain, setChain]           = useState(CHAINS[0]);
  const [accountName, setAccName]   = useState("");
  const [accountNumber, setAccNum]  = useState("");
  const [bank, setBank]             = useState<Bank | null>(null);
  const [amountNGN, setAmount]      = useState("");
  const [showWalletDrop, setWDrop]  = useState(false);
  const [showChainDrop, setCDrop]   = useState(false);
  const [showBankDrop, setBDrop]    = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [step, setStep]             = useState<SendStep>("form");
  const [error, setError]           = useState<string | null>(null);
  const [txId, setTxId]             = useState<number | null>(null);
  const [buildPayload, setBuild]    = useState<BuildPayload | null>(null);
  const [quote, setQuote]           = useState<QuoteInfo | null>(null);
  const [txHash, setTxHash]         = useState<string | null>(null);

  const wallet    = linkedWallets[selWalletIdx];
  const RATE      = quote?.rate ?? 1595;
  const ngnNum    = parseFloat(amountNGN) || 0;
  const usdtAmt   = ngnNum / RATE;
  const feeUSDT   = usdtAmt * 0.005;
  const filteredBanks = NIGERIAN_BANKS.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()) || b.code.includes(bankSearch)
  );

  const sendMut   = trpc.transactions.sendMoney.useMutation();
  const submitMut = trpc.transactions.submit.useMutation();

  function validate() {
    if (!wallet)                          return "Connect a wallet first";
    if (!accountName.trim())              return "Enter recipient account name";
    if (!/^\d{10}$/.test(accountNumber))  return "Account number must be 10 digits";
    if (!bank)                            return "Select a bank";
    if (!amountNGN || ngnNum <= 0)        return "Enter a valid NGN amount";
    if (ngnNum < 1000)                    return "Minimum transfer is ₦1,000";
    if (usdtAmt < 0.5)                   return "Amount too small — minimum 0.5 USDT";
    return null;
  }

  async function handleQuote() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null); setStep("quoting");
    try {
      const raw = parseUnits(usdtAmt.toFixed(chain.decimals === 18 ? 10 : 6), chain.decimals);
      const result = await sendMut.mutateAsync({
        referenceId: `BANK-${Date.now()}`, idempotencyKey: `SM-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        chainId: chain.id, wallet: wallet!.address,
        recipientBank: { bankCode: bank!.code, accountNumber, accountName: accountName.trim(), currency: "NGN" },
        amountRaw: raw.toString(), tokenDecimals: chain.decimals,
      });
      setTxId(result.transactionId); setBuild(result.unsignedTxs as BuildPayload);
      setQuote(result.quote); setStep("review");
    } catch (e: any) { setError(e?.message ?? "Failed to get quote"); setStep("error"); }
  }

  async function handleSign() {
    if (!txId || !buildPayload) return;
    setStep("signing"); setError(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("No wallet detected. Install MetaMask or use a Web3 browser.");
      await eth.request({ method: "eth_requestAccounts" });
      let lastHash = "";
      for (const tx of buildPayload.transactions) {
        lastHash = await eth.request({ method: "eth_sendTransaction",
          params: [{ from: wallet?.address, to: tx.to, data: tx.data, value: "0x0" }] });
      }
      if (!lastHash) throw new Error("Wallet returned no tx hash");
      await submitMut.mutateAsync({ transactionId: txId, txHash: lastHash });
      setTxHash(lastHash); setStep("submitted"); queryClient.invalidateQueries();
    } catch (e: any) {
      if (e?.code === 4001) { setError("Transaction rejected. You can try again."); setStep("review"); }
      else { setError(e?.message ?? "Signing failed"); setStep("error"); }
    }
  }

  // Submitted screen
  if (step === "submitted") return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <Check size={32} className="text-green-500"/>
      </div>
      <div className="text-center">
        <p className="font-semibold text-lg dark:text-white">Transfer Submitted</p>
        <p className="text-sm text-aegis-tertiary-dark mt-1">Recipient will receive ₦{ngnNum.toLocaleString()} in 1–3 business days</p>
      </div>
      {txHash && (
        <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-xs text-[#5B3CF5] hover:underline">
          <ExternalLink size={12}/> View on BscScan
        </a>
      )}
      <button onClick={() => { setStep("form"); setTxHash(null); setQuote(null); setAmount(""); setAccName(""); setAccNum(""); setBank(null); }}
        className="mt-2 px-6 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-medium">
        Send Another Transfer
      </button>
    </div>
  );

  // Review screen
  if (step === "review" && quote) return (
    <div className="space-y-4">
      <div className="bg-aegis-bg-elevated rounded-2xl p-4 space-y-3">
        <div className="flex justify-between text-sm"><span className="text-aegis-tertiary-dark">You send</span><span className="font-semibold dark:text-white">{usdtAmt.toFixed(4)} USDT</span></div>
        <div className="flex justify-between text-sm"><span className="text-aegis-tertiary-dark">Recipient gets</span><span className="font-semibold text-green-500">₦{quote.estimatedFiat.toLocaleString()}</span></div>
        <div className="flex justify-between text-sm"><span className="text-aegis-tertiary-dark">Fee</span><span className="dark:text-white">{feeUSDT.toFixed(4)} USDT</span></div>
        <div className="flex justify-between text-sm"><span className="text-aegis-tertiary-dark">Rate</span><span className="dark:text-white">1 USDT = ₦{quote.rate.toLocaleString()}</span></div>
        <div className="flex justify-between text-sm"><span className="text-aegis-tertiary-dark">Est. time</span><span className="dark:text-white">{quote.estimatedTime}</span></div>
        <hr className="border-border"/>
        <div className="flex justify-between text-sm"><span className="text-aegis-tertiary-dark">To</span><span className="dark:text-white font-medium">{accountName} · {bank?.name}</span></div>
        <div className="flex justify-between text-sm"><span className="text-aegis-tertiary-dark">Account</span><span className="font-mono dark:text-white">{accountNumber}</span></div>
      </div>
      {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={12}/>{error}</p>}
      <div className="flex gap-3">
        <button onClick={() => setStep("form")} className="flex-1 py-3 border border-border rounded-xl text-sm dark:text-white">Edit</button>
        <button onClick={handleSign} disabled={step === "signing"}
          className="flex-1 py-3 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          {step === "signing" ? <><Loader2 size={16} className="animate-spin"/>Signing…</> : <><ShieldCheck size={16}/>Confirm & Send</>}
        </button>
      </div>
    </div>
  );

  // Main form
  return (
    <div className="space-y-4">
      {/* Wallet selector */}
      {linkedWallets.length > 0 ? (
        <div className="relative">
          <button onClick={() => setWDrop(!showWalletDrop)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-aegis-bg-elevated border border-border rounded-xl text-sm">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center flex-shrink-0">
              <Wallet size={14} className="text-white"/>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium dark:text-white truncate">{wallet?.label ?? "Select wallet"}</p>
              <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{wallet?.address?.slice(0,10)}…{wallet?.address?.slice(-6)}</p>
            </div>
            <ChevronDown size={16} className={`text-aegis-tertiary-dark transition-transform ${showWalletDrop ? "rotate-180" : ""}`}/>
          </button>
          {showWalletDrop && (
            <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              {linkedWallets.map((w, i) => (
                <button key={w.address} onClick={() => { setSelWalletIdx(i); setWDrop(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-aegis-bg-elevated text-sm dark:text-white">
                  <Wallet size={14} className="text-[#5B3CF5]"/>
                  <span className="truncate">{w.label ?? w.address.slice(0,12)}</span>
                  {i === selWalletIdx && <Check size={14} className="ml-auto text-[#5B3CF5]"/>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-xs text-yellow-600 dark:text-yellow-400">
          <AlertTriangle size={14}/> Connect a wallet on the Wallets page first
        </div>
      )}

      {/* Bank details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-aegis-bg-elevated border border-border rounded-xl">
          <User size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
          <input value={accountName} onChange={e => setAccName(e.target.value)} placeholder="Account holder name"
            className="flex-1 bg-transparent text-sm dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"/>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-aegis-bg-elevated border border-border rounded-xl">
          <Hash size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
          <input value={accountNumber} onChange={e => setAccNum(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit account number"
            className="flex-1 bg-transparent text-sm dark:text-white font-mono placeholder:text-aegis-tertiary-dark focus:outline-none"/>
        </div>

        {/* Bank picker */}
        <div className="relative">
          <button onClick={() => setBDrop(!showBankDrop)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-aegis-bg-elevated border border-border rounded-xl text-sm">
            <Building2 size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
            <span className={`flex-1 text-left ${bank ? "dark:text-white" : "text-aegis-tertiary-dark"}`}>{bank?.name ?? "Select bank"}</span>
            <ChevronDown size={14} className={`text-aegis-tertiary-dark transition-transform ${showBankDrop ? "rotate-180" : ""}`}/>
          </button>
          {showBankDrop && (
            <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
              <div className="sticky top-0 bg-card px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2 bg-aegis-bg-elevated rounded-lg px-2 py-1.5">
                  <Search size={12} className="text-aegis-tertiary-dark"/><input autoFocus value={bankSearch} onChange={e => setBankSearch(e.target.value)} placeholder="Search bank" className="flex-1 bg-transparent text-xs dark:text-white focus:outline-none"/>
                </div>
              </div>
              {filteredBanks.map(b => (
                <button key={b.code} onClick={() => { setBank(b); setBDrop(false); setBankSearch(""); }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-aegis-bg-elevated text-sm dark:text-white">
                  {b.name}{bank?.code===b.code && <Check size={12} className="ml-auto text-[#5B3CF5]"/>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Amount + chain */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-aegis-bg-elevated border border-border rounded-xl">
          <span className="text-sm text-aegis-tertiary-dark">₦</span>
          <input type="number" value={amountNGN} onChange={e => setAmount(e.target.value)} placeholder="Amount in NGN"
            className="flex-1 bg-transparent text-sm dark:text-white focus:outline-none"/>
        </div>
        <button onClick={() => setCDrop(!showChainDrop)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-aegis-bg-elevated border border-border rounded-xl text-xs dark:text-white">
          {chain.token}<ChevronDown size={12}/>
        </button>
      </div>
      {amountNGN && ngnNum > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#5B3CF5]/10 rounded-xl text-xs text-[#5B3CF5]">
          <Zap size={12}/> ≈ {usdtAmt.toFixed(4)} USDT · Fee: {feeUSDT.toFixed(4)} USDT
        </div>
      )}

      {error && <p className="flex items-center gap-1.5 text-xs text-red-400"><AlertCircle size={12}/>{error}</p>}

      <button onClick={handleQuote} disabled={step === "quoting"}
        className="w-full py-3.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {step === "quoting" ? <><Loader2 size={16} className="animate-spin"/>Getting Quote…</> : <><ArrowRight size={16}/>Get Quote & Review</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receive tab — QR code + address
// ─────────────────────────────────────────────────────────────────────────────
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum", 56: "BNB Chain", 137: "Polygon", 42161: "Arbitrum",
};

function QRCanvas({ address }: { address: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!address) return;
    setLoading(true); setImgSrc(null);
    const url = `https://quickchart.io/qr?text=${encodeURIComponent(address)}&size=200&margin=2&ecLevel=M&format=svg`;
    const img = new Image();
    img.onload = () => { setImgSrc(url); setLoading(false); };
    img.onerror = () => { setImgSrc(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(address)}&size=200x200&margin=10`); setLoading(false); };
    img.src = url;
    setTimeout(() => { if (loading) setLoading(false); }, 3000);
  }, [address]);
  return (
    <div className="w-48 h-48 flex items-center justify-center rounded-2xl overflow-hidden border-2 border-[#5B3CF5]/30 bg-white shadow-lg mx-auto">
      {loading && <div className="w-7 h-7 border-2 border-[#5B3CF5] border-t-transparent rounded-full animate-spin"/>}
      {imgSrc && !loading && <img src={imgSrc} alt="QR" className="w-full h-full object-contain p-2"/>}
    </div>
  );
}

function ReceiveTab() {
  const { linkedWallets } = useWallets();
  const { user } = useCurrentUser();
  const { wallets: storeWallets } = useWalletStore();
  const [selIdx, setSelIdx] = useState(0);
  const [showDrop, setShowDrop] = useState(false);
  const [copied, setCopied] = useState(false);

  const embeddedAddress = (user as any)?.walletAddress as string | null ?? null;
  const allWallets = [
    ...(embeddedAddress ? [{ address: embeddedAddress, label: "My Aegis Wallet", chainId: 56 }] : []),
    ...storeWallets.map(w => ({ address: w.address, label: w.label, chainId: w.chainId })),
  ];
  const wallet = allWallets[selIdx] ?? allWallets[0];

  function copy() {
    if (!wallet?.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function share() {
    if (!wallet?.address) return;
    if (navigator.share) navigator.share({ title: "My Aegis Wallet", text: wallet.address });
    else copy();
  }

  if (!wallet) return (
    <div className="text-center py-10 text-aegis-tertiary-dark text-sm">
      <Wallet size={32} className="mx-auto mb-2 opacity-30"/>
      No wallets connected yet
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Wallet selector */}
      {allWallets.length > 1 && (
        <div className="relative">
          <button onClick={() => setShowDrop(!showDrop)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-aegis-bg-elevated border border-border rounded-xl text-sm">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center flex-shrink-0">
              <Wallet size={14} className="text-white"/>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium dark:text-white truncate">{wallet.label}</p>
              <p className="text-xs text-aegis-tertiary-dark">{CHAIN_NAMES[wallet.chainId] ?? "Multi-chain"}</p>
            </div>
            <ChevronDown size={16} className={`text-aegis-tertiary-dark transition-transform ${showDrop ? "rotate-180" : ""}`}/>
          </button>
          {showDrop && (
            <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              {allWallets.map((w, i) => (
                <button key={w.address} onClick={() => { setSelIdx(i); setShowDrop(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-aegis-bg-elevated text-sm dark:text-white">
                  <Wallet size={14} className="text-[#5B3CF5]"/>
                  <span className="flex-1 text-left truncate">{w.label}</span>
                  {i === selIdx && <Check size={14} className="text-[#5B3CF5]"/>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QR */}
      <div className="flex flex-col items-center gap-4">
        <QRCanvas address={wallet.address}/>
        <div className="flex items-center gap-2 px-4 py-2 bg-aegis-bg-elevated border border-border rounded-xl max-w-full">
          <p className="text-xs font-mono text-aegis-secondary-dark dark:text-white break-all flex-1">{wallet.address}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={copy}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-medium">
            {copied ? <><Check size={14}/>Copied!</> : <><Copy size={14}/>Copy Address</>}
          </button>
          <button onClick={share}
            className="flex items-center gap-2 px-5 py-2.5 border border-[#5B3CF5] text-[#5B3CF5] rounded-xl text-sm font-medium">
            <Share2 size={14}/>Share
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
        <Shield size={14} className="text-yellow-500 mt-0.5 flex-shrink-0"/>
        <p className="text-xs text-yellow-700 dark:text-yellow-400">
          Only send USDT, USDC, or BNB to this address. Sending unsupported tokens may result in permanent loss.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fund tab — on-ramp
// ─────────────────────────────────────────────────────────────────────────────
const AFRICAN_COUNTRIES = [
  { name: "Nigeria", code: "NG", currency: "NGN", flag: "🇳🇬" },
  { name: "Ghana",   code: "GH", currency: "GHS", flag: "🇬🇭" },
  { name: "Kenya",   code: "KE", currency: "KES", flag: "🇰🇪" },
  { name: "South Africa", code: "ZA", currency: "ZAR", flag: "🇿🇦" },
  { name: "Uganda",  code: "UG", currency: "UGX", flag: "🇺🇬" },
  { name: "Tanzania",code: "TZ", currency: "TZS", flag: "🇹🇿" },
];

function FundTab() {
  const { rate } = useNgnRate();
  const [amount, setAmount]       = useState("50000");
  const [country, setCountry]     = useState(AFRICAN_COUNTRIES[0]);
  const [showDrop, setShowDrop]   = useState(false);
  const [provider, setProvider]   = useState("transak");
  const [launching, setLaunching] = useState(false);
  const [copied, setCopied]       = useState(false);

  const hasToken = !!getToken();
  const fiatNum  = parseFloat(amount) || 0;
  const usdtEst  = rate > 0 ? (fiatNum / rate).toFixed(2) : "—";

  const rampQuery = trpc.ramps.onrampAll.useQuery(
    { amount: fiatNum, currency: country.currency, wallet: "pending" },
    { enabled: hasToken && fiatNum > 0, staleTime: 60_000 }
  );

  const providers = [
    { id: "transak", name: "Transak", badge: "Popular", fee: "1%", time: "5 min", color: "#5B3CF5" },
    { id: "moonpay", name: "MoonPay", badge: "Fast",    fee: "1.5%", time: "3 min", color: "#3B5BDB" },
    { id: "yellowcard", name: "Yellow Card", badge: "Africa", fee: "0.8%", time: "10 min", color: "#03CD69" },
  ];

  function handleLaunch() {
    const data = rampQuery.data as any;
    const url = data?.[provider]?.url ?? data?.transak?.url;
    if (url) { setLaunching(true); window.open(url, "_blank"); setTimeout(() => setLaunching(false), 2000); }
  }

  return (
    <div className="space-y-4">
      {/* Country + amount */}
      <div className="flex gap-2">
        <div className="relative">
          <button onClick={() => setShowDrop(!showDrop)}
            className="flex items-center gap-2 px-3 py-2.5 bg-aegis-bg-elevated border border-border rounded-xl text-sm min-w-[120px]">
            <span>{country.flag}</span><span className="dark:text-white">{country.currency}</span>
            <ChevronDown size={14} className="text-aegis-tertiary-dark"/>
          </button>
          {showDrop && (
            <div className="absolute z-20 top-full mt-1 bg-card border border-border rounded-xl shadow-lg min-w-[160px] overflow-hidden">
              {AFRICAN_COUNTRIES.map(c => (
                <button key={c.code} onClick={() => { setCountry(c); setShowDrop(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-aegis-bg-elevated text-sm dark:text-white">
                  {c.flag} {c.name}{country.code===c.code && <Check size={12} className="ml-auto text-[#5B3CF5]"/>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-aegis-bg-elevated border border-border rounded-xl">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount"
            className="flex-1 bg-transparent text-sm dark:text-white focus:outline-none"/>
        </div>
      </div>

      {fiatNum > 0 && rate > 0 && (
        <div className="px-4 py-2 bg-[#5B3CF5]/10 rounded-xl text-xs text-[#5B3CF5] flex items-center gap-2">
          <Zap size={12}/> ≈ {usdtEst} USDT at ₦{rate.toLocaleString()}/USDT
        </div>
      )}

      {/* Provider selection */}
      <div className="space-y-2">
        {providers.map(p => (
          <button key={p.id} onClick={() => setProvider(p.id)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${provider===p.id ? "border-[#5B3CF5] bg-[#5B3CF5]/10" : "border-border bg-aegis-bg-elevated"}`}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: p.color }}>{p.name[0]}</div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold dark:text-white">{p.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#5B3CF5]/20 text-[#5B3CF5]">{p.badge}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-aegis-tertiary-dark">Fee {p.fee}</span>
                <span className="text-xs text-aegis-tertiary-dark flex items-center gap-1"><Clock size={10}/>{p.time}</span>
              </div>
            </div>
            {provider===p.id && <Check size={16} className="text-[#5B3CF5] flex-shrink-0"/>}
          </button>
        ))}
      </div>

      <button onClick={handleLaunch} disabled={!hasToken || fiatNum <= 0 || launching}
        className="w-full py-3.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
        {launching ? <><Loader2 size={16} className="animate-spin"/>Opening…</> : <><ExternalLink size={16}/>Fund with {providers.find(p=>p.id===provider)?.name}</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Swap tab — DEX exchange
// ─────────────────────────────────────────────────────────────────────────────
const TOKEN_META: Record<string, { color: string }> = {
  USDT: { color: "#26A17B" }, USDC: { color: "#2775CA" },
  BNB:  { color: "#F3BA2F" }, ETH: { color: "#627EEA" }, MATIC: { color: "#8247E5" },
};
const FALLBACK_TOKENS = [
  { symbol: "USDT", balance: 0, network: "bsc" },
  { symbol: "USDC", balance: 0, network: "bsc" },
  { symbol: "BNB",  balance: 0, network: "bsc" },
  { symbol: "ETH",  balance: 0, network: "ethereum" },
];

let _pCache: Record<string,number> = {};
let _pFetchedAt = 0;
async function getBinancePrices(): Promise<Record<string,number>> {
  if (Date.now() - _pFetchedAt < 60_000) return _pCache;
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbols=["ETHUSDT","BNBUSDT","MATICUSDT"]', { signal: AbortSignal.timeout(4000) });
    const arr: {symbol:string;price:string}[] = await r.json();
    const map: Record<string,number> = { USDT: 1, USDC: 1 };
    arr.forEach(a => {
      if (a.symbol==="ETHUSDT")   map["ETH"]   = parseFloat(a.price);
      if (a.symbol==="BNBUSDT")   map["BNB"]   = parseFloat(a.price);
      if (a.symbol==="MATICUSDT") map["MATIC"] = parseFloat(a.price);
    });
    _pCache = map; _pFetchedAt = Date.now(); return map;
  } catch { return _pCache; }
}

function SwapTab() {
  const { wallets } = useWalletStore();
  const [prices, setPrices] = useState<Record<string,number>>({ USDT:1, USDC:1, BNB:620, ETH:3500, MATIC:0.85 });
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx]     = useState(1);
  const [fromAmt, setFromAmt] = useState("");
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo]     = useState(false);
  const [slippage, setSlip]     = useState(0.5);
  const [refreshing, setRef]    = useState(false);

  const tokens = useMemo(() => {
    const seen = new Set<string>();
    const out: { symbol: string; balance: number; network: string }[] = [];
    wallets.forEach(w => {
      (w as any).assets?.forEach((a: any) => {
        const key = `${a.network}:${a.token}`;
        if (!seen.has(key)) { seen.add(key); out.push({ symbol: a.token, balance: parseFloat(a.balance ?? "0"), network: a.network }); }
      });
    });
    return out.length ? out : FALLBACK_TOKENS;
  }, [wallets]);

  const from = tokens[Math.min(fromIdx, tokens.length-1)];
  const to   = tokens[Math.min(toIdx,   tokens.length-1)];
  const fromPrice = prices[from?.symbol] ?? 0;
  const toPrice   = prices[to?.symbol]   ?? 0;
  const fromNum   = parseFloat(fromAmt) || 0;
  const toAmt     = fromNum > 0 && toPrice > 0 ? ((fromNum * fromPrice) / toPrice * (1 - slippage/100)).toFixed(6) : "";
  const impact    = fromNum * fromPrice < 100 ? 0 : 0.1;

  useEffect(() => { getBinancePrices().then(setPrices); }, []);

  async function refresh() {
    setRef(true); await getBinancePrices().then(setPrices); setRef(false);
  }

  function swapTokens() {
    const tmp = fromIdx; setFromIdx(toIdx); setToIdx(tmp);
    setFromAmt(toAmt);
  }

  function getDexUrl() {
    const net = from?.network;
    if (net === "bsc")      return `https://pancakeswap.finance/swap?inputCurrency=${from.symbol}&outputCurrency=${to.symbol}`;
    if (net === "ethereum") return `https://app.uniswap.org/#/swap?inputCurrency=${from.symbol}&outputCurrency=${to.symbol}`;
    if (net === "polygon")  return `https://quickswap.exchange/#/swap`;
    if (net === "arbitrum") return `https://app.uniswap.org/#/swap`;
    return "https://pancakeswap.finance/swap";
  }

  const DEX_NAME: Record<string, string> = { bsc: "PancakeSwap", ethereum: "Uniswap", polygon: "QuickSwap", arbitrum: "Uniswap" };

  function TokenBtn({ idx, setIdx, show, setShow }: { idx: number; setIdx: (i: number) => void; show: boolean; setShow: (b: boolean) => void }) {
    const tok = tokens[Math.min(idx, tokens.length-1)];
    const color = TOKEN_META[tok?.symbol]?.color ?? "#5B3CF5";
    return (
      <div className="relative">
        <button onClick={() => setShow(!show)}
          className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated border border-border rounded-xl min-w-[110px]">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{background:color}}>{tok?.symbol?.[0]}</div>
          <span className="text-sm font-semibold dark:text-white">{tok?.symbol}</span>
          <ChevronDown size={14} className="text-aegis-tertiary-dark ml-auto"/>
        </button>
        {show && (
          <div className="absolute z-20 top-full mt-1 bg-card border border-border rounded-xl shadow-xl min-w-[160px] max-h-48 overflow-y-auto">
            {tokens.map((t, i) => (
              <button key={`${t.network}:${t.symbol}`} onClick={() => { setIdx(i); setShow(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-aegis-bg-elevated text-sm">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{background: TOKEN_META[t.symbol]?.color ?? "#5B3CF5"}}>{t.symbol[0]}</div>
                <div className="text-left flex-1">
                  <p className="font-medium dark:text-white">{t.symbol}</p>
                  <p className="text-xs text-aegis-tertiary-dark">{t.network} · {t.balance > 0 ? t.balance.toFixed(4) : "0"}</p>
                </div>
                {i===idx && <Check size={12} className="text-[#5B3CF5]"/>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rate bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-aegis-bg-elevated rounded-xl text-xs">
        <span className="text-aegis-tertiary-dark">1 {from?.symbol} ≈ {fromPrice > 0 && toPrice > 0 ? (fromPrice/toPrice).toFixed(4) : "—"} {to?.symbol}</span>
        <button onClick={refresh} className="text-[#5B3CF5] flex items-center gap-1">
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""}/>Refresh
        </button>
      </div>

      {/* From */}
      <div className="bg-aegis-bg-elevated border border-border rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-aegis-tertiary-dark">From</span>
          {from && <span className="text-xs text-aegis-tertiary-dark">Balance: {from.balance > 0 ? from.balance.toFixed(4) : "0"} {from.symbol}</span>}
        </div>
        <div className="flex items-center gap-3">
          <input type="number" value={fromAmt} onChange={e => setFromAmt(e.target.value)} placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-bold dark:text-white focus:outline-none placeholder:text-aegis-tertiary-dark"/>
          <TokenBtn idx={fromIdx} setIdx={setFromIdx} show={showFrom} setShow={setShowFrom}/>
        </div>
        {fromNum > 0 && fromPrice > 0 && <p className="text-xs text-aegis-tertiary-dark">≈ ${(fromNum * fromPrice).toFixed(2)}</p>}
      </div>

      {/* Swap arrow */}
      <div className="flex justify-center -my-1">
        <button onClick={swapTokens} className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center shadow-lg">
          <ArrowUpDown size={16} className="text-white"/>
        </button>
      </div>

      {/* To */}
      <div className="bg-aegis-bg-elevated border border-border rounded-2xl p-4 space-y-2 -mt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-aegis-tertiary-dark">To</span>
          {to && <span className="text-xs text-aegis-tertiary-dark">Balance: {to.balance > 0 ? to.balance.toFixed(4) : "0"} {to.symbol}</span>}
        </div>
        <div className="flex items-center gap-3">
          <p className="flex-1 text-2xl font-bold text-aegis-tertiary-dark">{toAmt || "0.0"}</p>
          <TokenBtn idx={toIdx} setIdx={setToIdx} show={showTo} setShow={setShowTo}/>
        </div>
        {toAmt && toPrice > 0 && <p className="text-xs text-aegis-tertiary-dark">≈ ${(parseFloat(toAmt) * toPrice).toFixed(2)}</p>}
      </div>

      {/* Slippage */}
      <div className="flex items-center gap-3 px-4 py-3 bg-aegis-bg-elevated border border-border rounded-xl">
        <Info size={13} className="text-aegis-tertiary-dark flex-shrink-0"/>
        <span className="text-xs text-aegis-tertiary-dark flex-1">Slippage tolerance</span>
        {[0.1, 0.5, 1.0].map(v => (
          <button key={v} onClick={() => setSlip(v)}
            className={`text-xs px-2 py-1 rounded-lg ${slippage===v ? "bg-[#5B3CF5] text-white" : "bg-border text-aegis-tertiary-dark"}`}>
            {v}%
          </button>
        ))}
      </div>

      {fromNum > 0 && toAmt && (
        <div className="px-4 py-2 bg-[#5B3CF5]/10 rounded-xl text-xs text-[#5B3CF5] flex items-center gap-2">
          <Zap size={12}/> Routing via {DEX_NAME[from?.network ?? "bsc"] ?? "DEX"} · Price impact {impact.toFixed(2)}%
        </div>
      )}

      <a href={getDexUrl()} target="_blank" rel="noreferrer"
        className="w-full py-3.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
        <ExternalLink size={16}/>Swap on {DEX_NAME[from?.network ?? "bsc"] ?? "DEX"}
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main unified page
// ─────────────────────────────────────────────────────────────────────────────
export default function Money() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get("tab") as Tab) ?? "send";
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.find(t => t.id === tabParam) ? tabParam : "send"
  );

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  }

  const TAB_COMPONENTS: Record<Tab, React.ReactNode> = {
    send:    <SendTab />,
    receive: <ReceiveTab />,
    fund:    <FundTab />,
    swap:    <SwapTab />,
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-5 pb-24">
      {/* Tab selector */}
      <div className="grid grid-cols-4 gap-1.5 bg-aegis-bg-elevated p-1.5 rounded-2xl border border-border">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all ${
                active ? "bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] text-white shadow-lg" : "text-aegis-tertiary-dark hover:text-aegis-secondary-dark"
              }`}>
              <Icon size={18} strokeWidth={active ? 2.5 : 1.5}/>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab description */}
      <div className="flex items-center gap-2 text-xs text-aegis-tertiary-dark px-1">
        {(() => { const t = TABS.find(t => t.id === activeTab)!; const Icon = t.icon; return <><Icon size={12}/>{t.desc}</> })()}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {TAB_COMPONENTS[activeTab]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
