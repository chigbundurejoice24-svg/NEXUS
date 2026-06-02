/**
 * SendMoney.tsx
 *
 * Full transaction flow:
 *   1. Fill form → create (CREATED)
 *   2. Auto-advance → QUOTED (quote fee)
 *   3. Build (QUOTED → SIMULATED) — constructs on-chain payload
 *   4. Request Signature (SIMULATED → PENDING_SIGNATURE)
 *   5. User signs (external wallet for now) → submit (SUBMITTED)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Send, ChevronDown, AlertCircle, Check, ArrowRight, Loader2,
  ShieldCheck, AlertTriangle, Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallets } from "@/hooks/useWallets";
import { trpc } from "@/lib/trpc";
import { isAddress, parseUnits, formatUnits } from "viem";
import { queryClient } from "@/lib/queryClient";
import type { BuildPayload } from "@/lib/app-router-type";

const CHAINS: { id: number; label: string; token: string; decimals: number }[] = [
  { id: 1,     label: "Ethereum (ERC20)",  token: "USDT", decimals: 6  },
  { id: 56,    label: "BNB Chain (BEP20)", token: "USDT", decimals: 18 },
  { id: 137,   label: "Polygon",           token: "USDT", decimals: 6  },
  { id: 42161, label: "Arbitrum",          token: "USDT", decimals: 6  },
];

const NGN_PER_USD = 1595.20;

type FlowStep =
  | "form"               // User is filling the form
  | "creating"           // Calling create + transition to QUOTED
  | "building"           // Calling build (QUOTED → SIMULATED)
  | "review"             // Show simulation result, ask user to sign
  | "signing"            // Waiting for wallet signature
  | "submitted"          // tx hash received
  | "error";             // something went wrong

export default function SendMoney() {
  const navigate = useNavigate();
  const { linkedWallets } = useWallets();

  // Form state
  const [selectedWalletIdx, setSelectedWalletIdx] = useState(0);
  const [selectedChain, setSelectedChain]         = useState(CHAINS[1]);
  const [recipient, setRecipient]                 = useState("");
  const [amount, setAmount]                       = useState("");
  const [reference, setReference]                 = useState("");
  const [showWalletDrop, setShowWalletDrop]       = useState(false);
  const [showChainDrop, setShowChainDrop]         = useState(false);

  // Flow state
  const [step, setStep]                   = useState<FlowStep>("form");
  const [error, setError]                 = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<number | null>(null);
  const [buildPayload, setBuildPayload]   = useState<BuildPayload | null>(null);
  const [txHash, setTxHash]               = useState<string | null>(null);

  const selectedWallet = linkedWallets[selectedWalletIdx];

  // Fee preview (0.5% base)
  const amountNum  = parseFloat(amount) || 0;
  const feePreview = amountNum * 0.005;
  const totalPreview = amountNum + feePreview;

  // ── tRPC mutations ─────────────────────────────────────────────
  const createTx    = trpc.transactions.create.useMutation();
  const transitionTx = trpc.transactions.transition.useMutation();
  const buildTx     = trpc.transactions.build.useMutation();
  const reqSig      = trpc.transactions.requestSignature.useMutation();
  const submitTx    = trpc.transactions.submit.useMutation();

  // ── Step 1: Validate + Create ──────────────────────────────────
  async function handleSend() {
    setError(null);

    if (!selectedWallet) {
      setError("Please connect a wallet first on the Wallets page");
      return;
    }
    if (!isAddress(recipient)) {
      setError("Invalid recipient address — must be a valid 0x EVM address");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount greater than zero");
      return;
    }
    if (!reference.trim()) {
      setError("Please enter a reference / memo for this transfer");
      return;
    }

    let amountRaw: bigint;
    try {
      amountRaw = parseUnits(amount, selectedChain.decimals);
    } catch {
      setError("Invalid amount — please enter a valid number");
      return;
    }

    const idempotencyKey = `${reference.trim()}-${selectedWallet.address}-${recipient.toLowerCase()}-${amountRaw}-${selectedChain.id}`;

    setStep("creating");

    try {
      // Create transaction (CREATED state)
      const { transactionId: txId } = await createTx.mutateAsync({
        referenceId:    reference.trim(),
        idempotencyKey,
        chainId:        selectedChain.id,
        wallet:         selectedWallet.address,
        recipient:      recipient.toLowerCase(),
        amountRaw:      amountRaw.toString(),
        tokenDecimals:  selectedChain.decimals,
      });

      setTransactionId(txId);

      // Advance to QUOTED (apply fee)
      await transitionTx.mutateAsync({ transactionId: txId, toState: "QUOTED" });

      // Build payload (QUOTED → SIMULATED, on-chain simulation)
      setStep("building");
      const payload = await buildTx.mutateAsync({ transactionId: txId });
      setBuildPayload(payload as BuildPayload);

      // Advance to PENDING_SIGNATURE
      await reqSig.mutateAsync({ transactionId: txId });

      // Show review screen
      setStep("review");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  // ── Step 2: Sign with external wallet ─────────────────────────
  async function handleSign() {
    if (!transactionId || !buildPayload) return;
    setStep("signing");
    setError(null);

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error(
          "No wallet detected. Please install MetaMask or connect an EVM wallet."
        );
      }

      await ethereum.request({ method: "eth_requestAccounts" });

      // Send transactions sequentially via eth_sendTransaction
      let lastHash = "";
      for (const tx of buildPayload.transactions) {
        const hash: string = await ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: selectedWallet?.address,
            to:   tx.to,
            data: tx.data,
            value: "0x0",
          }],
        });
        lastHash = hash;
      }

      if (!lastHash) throw new Error("Wallet returned no transaction hash");

      // Record on server
      await submitTx.mutateAsync({
        transactionId,
        txHash: lastHash,
      });

      setTxHash(lastHash);
      setStep("submitted");
      queryClient.invalidateQueries();
    } catch (err: any) {
      if (err?.code === 4001) {
        // User rejected
        setError("Transaction was rejected in your wallet. You can try again.");
        setStep("review");
      } else {
        setError(err?.message ?? "Signing failed. Please try again.");
        setStep("error");
      }
    }
  }

  // ── SUBMITTED screen ──────────────────────────────────────────
  if (step === "submitted" && txHash) {
    return (
      <div className="max-w-lg mx-auto pb-20 lg:pb-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <Check size={32} className="text-aegis-success-green" />
          </div>
          <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">
            Transaction Broadcast!
          </h2>
          <p className="text-sm text-aegis-secondary-dark">
            Your transfer is now on-chain and in{" "}
            <span className="font-mono text-aegis-accent-purple">SUBMITTED</span> state.
            It will update to CONFIRMED once the block is mined.
          </p>
          <div className="bg-aegis-bg-elevated rounded-xl px-4 py-3 w-full text-left">
            <p className="text-xs text-aegis-tertiary-dark mb-1">Transaction Hash</p>
            <p className="text-xs font-mono text-aegis-primary-dark dark:text-white break-all">
              {txHash}
            </p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={() => navigate("/transactions")}
              className="flex-1 py-3 gradient-brand text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            >
              View Transactions <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                setStep("form");
                setTransactionId(null);
                setBuildPayload(null);
                setTxHash(null);
                setAmount("");
                setRecipient("");
                setReference("");
              }}
              className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated"
            >
              Send Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── REVIEW / SIGN screen ──────────────────────────────────────
  if (step === "review" && buildPayload) {
    const amountFormatted = parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 6,
    });
    return (
      <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-aegis-primary-dark dark:text-white">
            Review & Sign
          </h3>
          <p className="text-sm text-aegis-secondary-dark mt-1">
            Verify the details below then sign with your wallet
          </p>
        </div>

        {/* Simulation badge */}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
          buildPayload.simulation.passed
            ? "bg-green-50 dark:bg-green-900/20 text-aegis-success-green"
            : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600"
        }`}>
          {buildPayload.simulation.passed
            ? <><ShieldCheck size={16} /> Simulation passed — transaction should succeed</>
            : <><AlertTriangle size={16} /> Simulation warning — proceed with caution</>
          }
        </div>

        {buildPayload.simulation.warnings.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3 space-y-1">
            {buildPayload.simulation.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{w}</p>
            ))}
          </div>
        )}

        {/* Transaction details */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {[
            { label: "From",      value: `${selectedWallet?.label ?? "Wallet"} (${selectedWallet?.address.slice(0,6)}…${selectedWallet?.address.slice(-4)})` },
            { label: "To",        value: `${recipient.slice(0,6)}…${recipient.slice(-4)}` },
            { label: "Amount",    value: `${amountFormatted} USDT` },
            { label: "Fee",       value: `${feePreview.toFixed(6)} USDT (0.5%)` },
            { label: "Network",   value: selectedChain.label },
            { label: "Reference", value: reference },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-aegis-tertiary-dark">{label}</span>
              <span className="text-xs font-medium text-aegis-primary-dark dark:text-white text-right max-w-[200px] truncate">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Transactions to sign */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">
            Transactions to sign ({buildPayload.transactions.length})
          </p>
          {buildPayload.transactions.map((tx, i) => (
            <div key={i} className="bg-aegis-bg-elevated rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-aegis-primary-dark dark:text-white mb-1">
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
            Cancel
          </button>
          <button
            onClick={handleSign}
            className="flex-1 py-3 gradient-brand text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-glow"
          >
            <Zap size={16} />
            Sign & Send
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING screens ────────────────────────────────────────────
  if (step === "creating" || step === "building" || step === "signing") {
    const messages: Record<string, string> = {
      creating: "Creating transaction & applying quote…",
      building: "Simulating on-chain — checking balances & allowances…",
      signing:  "Waiting for wallet signature…",
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
          <p className="text-xs text-aegis-tertiary-dark">
            {step === "building" ? "Querying the chain…" : "Please wait a moment"}
          </p>
        </motion.div>
      </div>
    );
  }

  // ── FORM (default) ─────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-5">
      <p className="text-sm text-aegis-secondary-dark">
        Send USDT to any EVM wallet address — non-custodial, instant
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
                  <button key={lw.address} onClick={() => { setSelectedWalletIdx(i); setShowWalletDrop(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors text-left">
                    <p className="text-sm text-aegis-primary-dark dark:text-white">
                      {lw.label ?? `Wallet ${i + 1}`}
                    </p>
                    <p className="text-xs text-aegis-tertiary-dark font-mono ml-auto truncate max-w-[140px]">
                      {lw.address.slice(0,6)}…{lw.address.slice(-4)}
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

      {/* Recipient */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
          Recipient Address
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x... recipient EVM address"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm font-mono text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
        />
        {recipient && !isAddress(recipient) && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle size={11} /> Invalid address format
          </p>
        )}
        {recipient && isAddress(recipient) && (
          <p className="text-xs text-aegis-success-green mt-1 flex items-center gap-1">
            <Check size={11} /> Valid address
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
          Amount ({selectedChain.token})
        </label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-aegis-tertiary-dark">
            {selectedChain.token}
          </span>
        </div>

        {amountNum > 0 && (
          <div className="mt-3 space-y-1.5 pt-3 border-t border-border">
            {[
              { label: "Amount",       value: `${amountNum.toFixed(6)} USDT` },
              { label: "Fee (0.5%)",   value: `${feePreview.toFixed(6)} USDT` },
              { label: "Total",        value: `${totalPreview.toFixed(6)} USDT` },
              { label: "≈ NGN",        value: `₦${(totalPreview * NGN_PER_USD).toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-aegis-tertiary-dark">{label}</span>
                <span className={`font-medium ${label === "Total" ? "text-aegis-primary-dark dark:text-white" : "text-aegis-secondary-dark"}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reference */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
          Reference / Memo
        </label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. Invoice #1042, Rent payment"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
        />
      </div>

      {error && step === "error" && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={linkedWallets.length === 0 || step !== "form"}
        className="w-full py-4 gradient-brand text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow transition-opacity"
      >
        <Send size={16} />
        {linkedWallets.length === 0 ? "Connect a wallet first" : "Continue to Review"}
      </button>
    </div>
  );
}
