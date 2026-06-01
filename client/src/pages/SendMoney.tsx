import { useState } from "react";
import { motion } from "framer-motion";
import { Send, ChevronDown, AlertCircle, Check, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallets } from "@/hooks/useWallets";
import { trpc } from "@/lib/trpc";
import { isAddress, parseUnits } from "viem";
import { queryClient } from "@/lib/queryClient";

// Chain options matching SUPPORTED_CHAIN_IDS in transaction-service
const CHAINS: { id: number; label: string; token: string; decimals: number }[] = [
  { id: 1,     label: "Ethereum (ERC20)",  token: "USDT", decimals: 6  },
  { id: 56,    label: "BNB Chain (BEP20)", token: "USDT", decimals: 18 },
  { id: 137,   label: "Polygon",           token: "USDT", decimals: 6  },
  { id: 42161, label: "Arbitrum",          token: "USDT", decimals: 6  },
];

const NGN_PER_USD = 1595.20;

export default function SendMoney() {
  const navigate = useNavigate();
  const { linkedWallets } = useWallets();

  const [selectedWalletIdx, setSelectedWalletIdx] = useState(0);
  const [selectedChain, setSelectedChain] = useState(CHAINS[1]); // default BEP20
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [showWalletDrop, setShowWalletDrop] = useState(false);
  const [showChainDrop, setShowChainDrop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  const selectedWallet = linkedWallets[selectedWalletIdx];

  // Live fee preview (0.5% base)
  const amountNum = parseFloat(amount) || 0;
  const feePreview = amountNum * 0.005;
  const totalPreview = amountNum + feePreview;

  const createTx = trpc.transactions.create.useMutation({
    onSuccess: (data) => {
      setSuccessId(data.transactionId);
      queryClient.invalidateQueries();
    },
    onError: (e) => setError(e.message),
  });

  function handleSend() {
    setError(null);

    if (!selectedWallet) {
      setError("Please connect a wallet first (go to Wallets page)");
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
      setError("Please enter a reference for this transfer");
      return;
    }

    let amountRaw: bigint;
    try {
      amountRaw = parseUnits(amount, selectedChain.decimals);
    } catch {
      setError("Invalid amount — please enter a valid number");
      return;
    }

    // Idempotency key: reference + wallet + recipient + amount + chainId
    const idempotencyKey = `${reference.trim()}-${selectedWallet.address}-${recipient.toLowerCase()}-${amountRaw}-${selectedChain.id}`;

    createTx.mutate({
      referenceId: reference.trim(),
      idempotencyKey,
      chainId: selectedChain.id,
      wallet: selectedWallet.address,
      recipient: recipient.toLowerCase(),
      amountRaw: amountRaw.toString(),
      tokenDecimals: selectedChain.decimals,
    });
  }

  if (successId !== null) {
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
          <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Transaction Created</h2>
          <p className="text-sm text-aegis-secondary-dark">
            Transaction #{successId} is now in <span className="font-mono text-aegis-accent-purple">CREATED</span> state.
            It will move through the state machine as it's processed.
          </p>
          <p className="text-xs text-aegis-tertiary-dark">
            The Transaction Builder (next module) will handle simulation and signing.
          </p>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={() => navigate("/transactions")}
              className="flex-1 py-3 gradient-brand text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
            >
              View Transactions <ArrowRight size={16} />
            </button>
            <button
              onClick={() => { setSuccessId(null); setAmount(""); setRecipient(""); setReference(""); }}
              className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated"
            >
              Send Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-5">
      <p className="text-sm text-aegis-secondary-dark">Send crypto to any EVM wallet address</p>

      {/* From Wallet */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">From Wallet</label>
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
                <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{selectedWallet?.address}</p>
              </div>
              <ChevronDown size={16} className="text-aegis-tertiary-dark" />
            </button>
            {showWalletDrop && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="mt-2 border border-border rounded-lg overflow-hidden bg-card">
                {linkedWallets.map((lw, i) => (
                  <button key={lw.id} onClick={() => { setSelectedWalletIdx(i); setShowWalletDrop(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors text-left">
                    <p className="text-sm text-aegis-primary-dark dark:text-white">{lw.label ?? `Wallet ${i + 1}`}</p>
                    <p className="text-xs text-aegis-tertiary-dark font-mono ml-auto truncate max-w-[140px]">{lw.address}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Network */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">Network</label>
        <button
          onClick={() => setShowChainDrop(!showChainDrop)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
        >
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedChain.label}</p>
            <p className="text-xs text-aegis-tertiary-dark">Token: {selectedChain.token}</p>
          </div>
          <ChevronDown size={16} className="text-aegis-tertiary-dark" />
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
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">Recipient Address</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x... recipient EVM address"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm font-mono text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
        />
        {recipient && !isAddress(recipient) && (
          <p className="text-xs text-red-500 mt-1">Invalid address format</p>
        )}
      </div>

      {/* Amount */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">Amount ({selectedChain.token})</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min="0"
          className="w-full text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"
        />
        {amountNum > 0 && (
          <p className="text-sm text-aegis-secondary-dark mt-1">
            ≈ ₦{(amountNum * NGN_PER_USD).toLocaleString("en-US", { minimumFractionDigits: 2 })} NGN
          </p>
        )}
      </div>

      {/* Reference */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">Reference</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. Invoice #1234 or Payment to John"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
        />
      </div>

      {/* Fee preview */}
      {amountNum > 0 && (
        <div className="bg-aegis-bg-elevated rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Amount</span>
            <span className="text-aegis-primary-dark dark:text-white font-medium">{amountNum.toFixed(6)} {selectedChain.token}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Network fee (0.5%)</span>
            <span className="text-aegis-primary-dark dark:text-white">{feePreview.toFixed(6)} {selectedChain.token}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
            <span className="text-aegis-primary-dark dark:text-white">Total</span>
            <span className="text-aegis-primary-dark dark:text-white">{totalPreview.toFixed(6)} {selectedChain.token}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={createTx.isPending || linkedWallets.length === 0}
        className="w-full py-4 gradient-brand text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {createTx.isPending ? (
          <><Loader2 size={18} className="animate-spin" /> Processing...</>
        ) : (
          <><Send size={18} /> Send {selectedChain.token}</>
        )}
      </button>

      <p className="text-xs text-center text-aegis-tertiary-dark">
        Transactions are processed on-chain and cannot be reversed once SETTLED.
        Always verify the recipient address before sending.
      </p>
    </div>
  );
}
