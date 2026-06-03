/**
 * SendMoney.tsx — Bank-to-bank remittance flow
 *
 * Steps:
 *   form       → User enters bank details + NGN amount
 *   quoting    → trpc.transactions.sendMoney (quote + create + build + pending_sig)
 *   review     → Show Transak quote, fee, rate. User confirms.
 *   signing    → window.ethereum sign & broadcast
 *   submitted  → Show tx hash, link to Transactions page
 *   error      → Show error with retry
 */

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Send, ChevronDown, AlertCircle, Check, ArrowRight,
  Loader2, ShieldCheck, AlertTriangle, Zap, Search,
  Building2, Hash, User, Banknote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallets } from "@/hooks/useWallets";
import { trpc } from "@/lib/trpc";
import { parseUnits } from "viem";
import { queryClient } from "@/lib/queryClient";
import { NIGERIAN_BANKS, type Bank } from "@/data/nigerian-banks";
import type { BuildPayload } from "@/lib/app-router-type";

// ── Supported networks for the send ───────────────────────────────
const CHAINS = [
  { id: 56, label: "BNB Chain (BEP20)", token: "USDT", decimals: 18 },
  { id: 1,  label: "Ethereum (ERC20)",  token: "USDT", decimals: 6  },
];
const DEFAULT_CHAIN = CHAINS[0]; // BNB is cheapest

// ── Flow state machine ─────────────────────────────────────────────
type Step =
  | "form"      // filling bank details
  | "quoting"   // server call in progress
  | "review"    // show quote, confirm
  | "signing"   // wallet signing
  | "submitted" // done
  | "error";

// ── Quote result returned from sendMoney ──────────────────────────
interface QuoteInfo {
  provider:      string;
  estimatedFiat: number;
  fiatCurrency:  string;
  fee:           number;
  feePercent:    number;
  rate:          number;
  estimatedTime: string;
}

export default function SendMoney() {
  const navigate = useNavigate();
  const { linkedWallets } = useWallets();

  // ── Form state ─────────────────────────────────────────────────
  const [selectedWalletIdx, setSelectedWalletIdx] = useState(0);
  const [selectedChain, setSelectedChain]         = useState(DEFAULT_CHAIN);
  const [accountName, setAccountName]             = useState("");
  const [accountNumber, setAccountNumber]         = useState("");
  const [selectedBank, setSelectedBank]           = useState<Bank | null>(null);
  const [amountNGN, setAmountNGN]                 = useState("");
  const [showWalletDrop, setShowWalletDrop]       = useState(false);
  const [showChainDrop, setShowChainDrop]         = useState(false);
  const [showBankDrop, setShowBankDrop]           = useState(false);
  const [bankSearch, setBankSearch]               = useState("");

  // ── Flow state ─────────────────────────────────────────────────
  const [step, setStep]                   = useState<Step>("form");
  const [error, setError]                 = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<number | null>(null);
  const [buildPayload, setBuildPayload]   = useState<BuildPayload | null>(null);
  const [quoteInfo, setQuoteInfo]         = useState<QuoteInfo | null>(null);
  const [txHash, setTxHash]               = useState<string | null>(null);

  const selectedWallet = linkedWallets[selectedWalletIdx];

  // Live USDT estimate (1 USDT ≈ 1595 NGN — updated by server quote)
  const LIVE_RATE = quoteInfo?.rate ?? 1595;
  const amountNGNNum  = parseFloat(amountNGN) || 0;
  const amountUSDT    = amountNGNNum / LIVE_RATE;
  const feeUSDT       = amountUSDT * 0.005;

  // ── tRPC mutations ─────────────────────────────────────────────
  const sendMoneyMut = trpc.transactions.sendMoney.useMutation();
  const submitMut    = trpc.transactions.submit.useMutation();

  // ── Filtered bank list ─────────────────────────────────────────
  const filteredBanks = NIGERIAN_BANKS.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
    b.code.includes(bankSearch)
  );

  // ── Validation ─────────────────────────────────────────────────
  function validate(): string | null {
    if (!selectedWallet)           return "Connect a wallet first on the Wallets page";
    if (!accountName.trim())       return "Enter the recipient's account name";
    if (!/^\d{10}$/.test(accountNumber)) return "Account number must be exactly 10 digits";
    if (!selectedBank)             return "Select a bank";
    if (!amountNGN || amountNGNNum <= 0) return "Enter a valid NGN amount";
    if (amountNGNNum < 1000)       return "Minimum transfer is ₦1,000";
    if (amountUSDT < 0.5)         return "Amount too small — minimum is 0.5 USDT";
    return null;
  }

  // ── Step 1: Get quote + build ──────────────────────────────────
  async function handleGetQuote() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setStep("quoting");

    try {
      const amountRaw = parseUnits(amountUSDT.toFixed(selectedChain.decimals === 18 ? 10 : 6), selectedChain.decimals);
      const idempotencyKey = `SM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const result = await sendMoneyMut.mutateAsync({
        referenceId:    `BANK-${Date.now()}`,
        idempotencyKey,
        chainId:        selectedChain.id,
        wallet:         selectedWallet!.address,
        recipientBank: {
          bankCode:      selectedBank!.code,
          accountNumber,
          accountName:   accountName.trim(),
          currency:      "NGN",
        },
        amountRaw:     amountRaw.toString(),
        tokenDecimals: selectedChain.decimals,
      });

      setTransactionId(result.transactionId);
      setBuildPayload(result.unsignedTxs as BuildPayload);
      setQuoteInfo(result.quote);
      setStep("review");
    } catch (e: any) {
      setError(e?.message ?? "Failed to get quote — please try again.");
      setStep("error");
    }
  }

  // ── Step 2: Sign + broadcast ───────────────────────────────────
  async function handleSign() {
    if (!transactionId || !buildPayload) return;
    setStep("signing");
    setError(null);

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error(
          "No wallet detected. Please install MetaMask or use a Web3-enabled browser."
        );
      }

      await ethereum.request({ method: "eth_requestAccounts" });

      // Send each tx in the payload sequentially
      let lastHash = "";
      for (const tx of buildPayload.transactions) {
        const hash: string = await ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from:  selectedWallet?.address,
            to:    tx.to,
            data:  tx.data,
            value: "0x0",
          }],
        });
        lastHash = hash;
      }

      if (!lastHash) throw new Error("Wallet returned no transaction hash");

      // Record on server → SUBMITTED
      await submitMut.mutateAsync({ transactionId, txHash: lastHash });

      setTxHash(lastHash);
      setStep("submitted");
      queryClient.invalidateQueries();
    } catch (e: any) {
      if (e?.code === 4001) {
        // User rejected in wallet
        setError("You rejected the transaction. You can try signing again.");
        setStep("review");
      } else {
        setError(e?.message ?? "Signing failed — please try again.");
        setStep("error");
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SCREENS
  // ═══════════════════════════════════════════════════════════════

  // ── SUBMITTED ─────────────────────────────────────────────────
  if (step === "submitted" && txHash) {
    return (
      <div className="max-w-lg mx-auto pb-20 lg:pb-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-5 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <Check size={32} className="text-aegis-success-green" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">
              Transfer Submitted!
            </h2>
            <p className="text-sm text-aegis-secondary-dark mt-1">
              Your USDT is on its way to{" "}
              <span className="font-medium text-aegis-primary-dark dark:text-white">
                {quoteInfo?.provider ?? "Transak"}
              </span>
              . A bank payout of{" "}
              <span className="font-medium text-aegis-success-green">
                ₦{quoteInfo ? quoteInfo.estimatedFiat.toLocaleString("en-NG", { minimumFractionDigits: 2 }) : "—"}
              </span>{" "}
              will be initiated once the on-chain transfer confirms.
            </p>
          </div>

          <div className="bg-aegis-bg-elevated rounded-xl px-4 py-3 w-full text-left space-y-1">
            <p className="text-xs text-aegis-tertiary-dark">Transaction Hash</p>
            <p className="text-xs font-mono text-aegis-primary-dark dark:text-white break-all">
              {txHash}
            </p>
            <p className="text-xs text-aegis-tertiary-dark mt-2">
              Est. settlement: {quoteInfo?.estimatedTime ?? "5–10 min"} after block confirmation
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => navigate("/transactions")}
              className="flex-1 py-3 gradient-brand text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            >
              View Transactions <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                setStep("form"); setTransactionId(null);
                setBuildPayload(null); setTxHash(null);
                setQuoteInfo(null); setAmountNGN("");
                setAccountName(""); setAccountNumber("");
                setSelectedBank(null);
              }}
              className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated"
            >
              Send Again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── REVIEW ─────────────────────────────────────────────────────
  if (step === "review" && quoteInfo && buildPayload) {
    return (
      <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-aegis-primary-dark dark:text-white">
            Review Transfer
          </h3>
          <p className="text-sm text-aegis-secondary-dark mt-1">
            Confirm details then sign with your wallet
          </p>
        </div>

        {/* Simulation badge */}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
          buildPayload.simulation.passed
            ? "bg-green-50 dark:bg-green-900/20 text-aegis-success-green"
            : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600"
        }`}>
          {buildPayload.simulation.passed
            ? <><ShieldCheck size={16} /> Simulation passed — transfer should succeed</>
            : <><AlertTriangle size={16} /> Simulation warning — check details carefully</>
          }
        </div>

        {buildPayload.simulation.warnings.map((w, i) => (
          <div key={i} className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
            <p className="text-xs text-yellow-700 dark:text-yellow-400">{w}</p>
          </div>
        ))}

        {/* Transfer summary */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {[
            { label: "Recipient",       value: accountName },
            { label: "Bank",            value: selectedBank?.name ?? "—" },
            { label: "Account Number",  value: accountNumber },
            { label: "Amount (NGN)",    value: `₦${amountNGNNum.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` },
            { label: "USDT to Send",    value: `${amountUSDT.toFixed(6)} USDT` },
            { label: "Rate",            value: `1 USDT ≈ ₦${quoteInfo.rate.toLocaleString("en-NG")}` },
            { label: "Provider Fee",    value: `₦${quoteInfo.fee.toLocaleString("en-NG", { minimumFractionDigits: 2 })} (${quoteInfo.feePercent.toFixed(1)}%)` },
            { label: "Recipient Gets",  value: `₦${quoteInfo.estimatedFiat.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` },
            { label: "Est. Time",       value: quoteInfo.estimatedTime },
            { label: "Provider",        value: quoteInfo.provider },
            { label: "Network",         value: selectedChain.label },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-aegis-tertiary-dark">{label}</span>
              <span className={`text-xs font-medium text-right max-w-[200px] ${
                label === "Recipient Gets"
                  ? "text-aegis-success-green"
                  : "text-aegis-primary-dark dark:text-white"
              }`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* On-chain txs */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">
            Transactions to sign ({buildPayload.transactions.length})
          </p>
          {buildPayload.transactions.map((tx, i) => (
            <div key={i} className="bg-aegis-bg-elevated rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-aegis-primary-dark dark:text-white mb-0.5">
                {i + 1}. {tx.label}
              </p>
              <p className="text-[10px] font-mono text-aegis-tertiary-dark truncate">{tx.to}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => { setStep("form"); setError(null); }}
            className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated"
          >
            ← Back
          </button>
          <button
            onClick={handleSign}
            className="flex-1 py-3 gradient-brand text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-glow"
          >
            <Zap size={16} /> Sign & Send
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING ─────────────────────────────────────────────────────
  if (step === "quoting" || step === "signing") {
    const messages: Record<string, string> = {
      quoting: "Getting quote from Transak…",
      signing: "Waiting for wallet signature…",
    };
    const subs: Record<string, string> = {
      quoting: "Calculating rate, fee, and deposit address",
      signing: "Check your wallet app to confirm",
    };
    return (
      <div className="max-w-lg mx-auto pb-20 lg:pb-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-4 text-center"
        >
          <Loader2 size={40} className="text-aegis-accent-purple animate-spin" />
          <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">
            {messages[step]}
          </p>
          <p className="text-xs text-aegis-tertiary-dark">{subs[step]}</p>
        </motion.div>
      </div>
    );
  }

  // ── FORM (default) ──────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-5">
      <p className="text-sm text-aegis-secondary-dark">
        Send money directly to any Nigerian bank account — powered by USDT
      </p>

      {/* From Wallet */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
          From Wallet
        </label>
        {linkedWallets.length === 0 ? (
          <button
            onClick={() => navigate("/wallets")}
            className="w-full p-3 rounded-lg border border-dashed border-border text-sm text-aegis-tertiary-dark hover:border-aegis-accent-purple/40 transition-colors"
          >
            + Connect a wallet first
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowWalletDrop(!showWalletDrop)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-aegis-accent-purple">
                  {(selectedWallet?.label ?? "W")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">
                  {selectedWallet?.label ?? `Wallet ${selectedWalletIdx + 1}`}
                </p>
                <p className="text-xs text-aegis-tertiary-dark font-mono truncate">
                  {selectedWallet?.address}
                </p>
              </div>
              <ChevronDown size={16} className="text-aegis-tertiary-dark flex-shrink-0" />
            </button>
            {showWalletDrop && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="mt-2 border border-border rounded-lg overflow-hidden bg-card">
                {linkedWallets.map((lw, i) => (
                  <button key={lw.address}
                    onClick={() => { setSelectedWalletIdx(i); setShowWalletDrop(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors text-left">
                    <p className="text-sm text-aegis-primary-dark dark:text-white">
                      {lw.label ?? `Wallet ${i + 1}`}
                    </p>
                    <p className="text-xs text-aegis-tertiary-dark font-mono ml-auto">
                      {lw.address.slice(0, 6)}…{lw.address.slice(-4)}
                    </p>
                  </button>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Network */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
          Network
        </label>
        <button
          onClick={() => setShowChainDrop(!showChainDrop)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
        >
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedChain.label}</p>
            <p className="text-xs text-aegis-tertiary-dark">Token: {selectedChain.token}</p>
          </div>
          <ChevronDown size={16} className="text-aegis-tertiary-dark flex-shrink-0" />
        </button>
        {showChainDrop && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className="mt-2 border border-border rounded-lg overflow-hidden bg-card">
            {CHAINS.map((c) => (
              <button key={c.id} onClick={() => { setSelectedChain(c); setShowChainDrop(false); }}
                className="w-full flex items-center justify-between p-3 hover:bg-aegis-bg-elevated transition-colors">
                <span className="text-sm text-aegis-primary-dark dark:text-white">{c.label}</span>
                <span className="text-xs text-aegis-tertiary-dark">{c.token}</span>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Bank Details */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider block">
          Recipient Bank Details
        </label>

        {/* Account Name */}
        <div>
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
            <input
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="Account holder name"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
            />
          </div>
        </div>

        {/* Account Number */}
        <div>
          <div className="relative">
            <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
            <input
              type="text"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit account number"
              maxLength={10}
              inputMode="numeric"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm font-mono text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
            />
          </div>
          {accountNumber.length > 0 && accountNumber.length < 10 && (
            <p className="text-[11px] text-aegis-tertiary-dark mt-1">
              {10 - accountNumber.length} more digit{10 - accountNumber.length !== 1 ? "s" : ""} needed
            </p>
          )}
          {accountNumber.length === 10 && (
            <p className="text-[11px] text-aegis-success-green mt-1 flex items-center gap-1">
              <Check size={10} /> Valid length
            </p>
          )}
        </div>

        {/* Bank Selector */}
        <div className="relative">
          <button
            onClick={() => setShowBankDrop(!showBankDrop)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors bg-aegis-bg-elevated"
          >
            <Building2 size={15} className="text-aegis-tertiary-dark flex-shrink-0" />
            <span className={`flex-1 text-left text-sm ${selectedBank ? "text-aegis-primary-dark dark:text-white" : "text-aegis-tertiary-dark"}`}>
              {selectedBank?.name ?? "Select bank"}
            </span>
            <ChevronDown size={14} className="text-aegis-tertiary-dark flex-shrink-0" />
          </button>

          {showBankDrop && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden"
            >
              {/* Search */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={e => setBankSearch(e.target.value)}
                    placeholder="Search banks…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-aegis-bg-elevated rounded-lg border border-border text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              {/* List */}
              <div className="max-h-48 overflow-y-auto">
                {filteredBanks.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-aegis-tertiary-dark">No banks found</p>
                ) : (
                  filteredBanks.map(b => (
                    <button
                      key={b.code}
                      onClick={() => { setSelectedBank(b); setShowBankDrop(false); setBankSearch(""); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-aegis-bg-elevated transition-colors text-left ${
                        selectedBank?.code === b.code ? "bg-purple-50 dark:bg-purple-900/10" : ""
                      }`}
                    >
                      <span className="text-sm text-aegis-primary-dark dark:text-white">{b.name}</span>
                      <span className="text-xs text-aegis-tertiary-dark font-mono">{b.code}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Amount in NGN */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
          Amount (NGN)
        </label>
        <div className="relative">
          <Banknote size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
          <input
            type="number"
            min="0"
            step="100"
            value={amountNGN}
            onChange={e => setAmountNGN(e.target.value)}
            placeholder="0"
            className="w-full pl-9 pr-14 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-aegis-tertiary-dark">NGN</span>
        </div>

        {amountNGNNum > 0 && (
          <div className="mt-3 space-y-1.5 pt-3 border-t border-border">
            {[
              { label: "≈ USDT needed",    value: `${amountUSDT.toFixed(6)} USDT` },
              { label: "Protocol fee",     value: `${feeUSDT.toFixed(6)} USDT (0.5%)` },
              { label: "Total USDT",       value: `${(amountUSDT + feeUSDT).toFixed(6)} USDT` },
              { label: "Rate (est.)",      value: `1 USDT ≈ ₦${LIVE_RATE.toLocaleString("en-NG")}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-aegis-tertiary-dark">{label}</span>
                <span className="font-medium text-aegis-secondary-dark">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (step === "form" || step === "error") && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleGetQuote}
        disabled={linkedWallets.length === 0 || step === "quoting"}
        className="w-full py-4 gradient-brand text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow transition-opacity"
      >
        <Send size={16} />
        {linkedWallets.length === 0
          ? "Connect a wallet first"
          : "Get Quote & Review"}
      </button>

      <p className="text-center text-xs text-aegis-tertiary-dark">
        Non-custodial · Powered by {" "}
        <span className="text-aegis-accent-purple">Transak</span> ·{" "}
        <span className="text-aegis-accent-purple">Cozanet</span>
      </p>
    </div>
  );
}
