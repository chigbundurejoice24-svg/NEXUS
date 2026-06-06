/**
 * WalletTransferModal.tsx
 *
 * Wallet-to-wallet USDT transfer on BSC.
 * - Auto-detects connected Web3 wallets (EIP-6963 + legacy window.ethereum)
 * - Reads live USDT balance from source wallet
 * - Direct eth_sendTransaction — no server build step needed for wallet-to-wallet
 * - Works with MetaMask, Trust Wallet, OKX, Coinbase Wallet, Rabby, any EIP-1193 wallet
 */
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowRight, Loader2, CheckCircle, AlertTriangle,
  Wallet, ChevronDown, Zap, ExternalLink, RefreshCw, Shield,
} from "lucide-react";
import { useWeb3Providers, type DetectedProvider } from "@/hooks/useWeb3Providers";
import { createPublicClient, http, formatUnits, encodeFunctionData } from "viem";
import { bsc } from "viem/chains";

// ── Constants ─────────────────────────────────────────────────────
const BSC_USDT     = "0x55d398326f99059fF775485246999027B3197955" as const;
const USDT_DEC     = 18;
const USDT_ABI     = [
  { name: "balanceOf", type: "function", stateMutability: "view",  inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "transfer",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;
const BSC_CHAIN_ID = 56;

// ── Helpers ───────────────────────────────────────────────────────
function toRaw(amount: string, dec: number): bigint {
  try {
    if (!amount || isNaN(parseFloat(amount))) return 0n;
    const [whole, frac = ""] = amount.split(".");
    const padded = (frac + "0".repeat(dec)).slice(0, dec);
    return BigInt((whole || "0") + padded);
  } catch { return 0n; }
}

function fromRaw(raw: bigint, dec: number, dp = 4): string {
  try {
    const d = 10n ** BigInt(dec);
    const whole = raw / d;
    const frac  = (raw % d).toString().padStart(dec, "0").slice(0, dp);
    return `${whole}.${frac}`;
  } catch { return "0.0000"; }
}

function WalletIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  if (icon.startsWith("data:") || icon.startsWith("http")) {
    return <img src={icon} alt="" width={size} height={size} className="rounded-md" />;
  }
  return <span style={{ fontSize: size * 0.85 }}>{icon}</span>;
}

// ── Types ─────────────────────────────────────────────────────────
type TransferStep = "setup" | "confirming" | "signing" | "done" | "error";

interface StoredWallet { id: string; address: string; label: string; }

interface Props {
  onClose: () => void;
  myWallets: StoredWallet[];
  embeddedAddress?: string | null;
}

// ── Component ─────────────────────────────────────────────────────
export default function WalletTransferModal({ onClose, myWallets, embeddedAddress }: Props) {
  const { providers, connected, connecting, error: providerError, connect, switchToBSC, disconnect } = useWeb3Providers();

  const allDest: StoredWallet[] = [
    ...(embeddedAddress ? [{ id: "__embedded__", address: embeddedAddress, label: "My Aegis Wallet (embedded)" }] : []),
    ...myWallets,
  ];

  const [step,       setStep]      = useState<TransferStep>("setup");
  const [fromProv,   setFromProv]  = useState<DetectedProvider | null>(null);
  const [fromAddr,   setFromAddr]  = useState<string>("");
  const [toWallet,   setToWallet]  = useState<StoredWallet | null>(allDest[0] ?? null);
  const [amount,     setAmount]    = useState("");
  const [usdtBal,    setUsdtBal]   = useState<bigint | null>(null);
  const [balLoading, setBalLoad]   = useState(false);
  const [showFrom,   setShowFrom]  = useState(false);
  const [showTo,     setShowTo]    = useState(false);
  const [txHash,     setTxHash]    = useState<string>("");
  const [txError,    setTxError]   = useState<string | null>(null);

  // Fetch USDT balance when source wallet changes
  const fetchBalance = useCallback(async (address: string) => {
    if (!address) return;
    setBalLoad(true);
    try {
      const client = createPublicClient({ chain: bsc, transport: http("https://rpc.ankr.com/bsc") });
      const bal = await client.readContract({
        address: BSC_USDT, abi: USDT_ABI, functionName: "balanceOf",
        args: [address as `0x${string}`],
      }) as bigint;
      setUsdtBal(bal);
    } catch (e) {
      console.warn("[Transfer] Balance fetch failed:", e);
      setUsdtBal(null);
    } finally { setBalLoad(false); }
  }, []);

  useEffect(() => { if (fromAddr) fetchBalance(fromAddr); }, [fromAddr, fetchBalance]);

  // Connect a Web3 provider
  async function handleConnectProvider(detected: DetectedProvider) {
    setShowFrom(false);
    const wallet = await connect(detected);
    if (!wallet) return;
    setFromProv(detected);
    setFromAddr(wallet.address);
    if (wallet.chainId !== BSC_CHAIN_ID) {
      try { await switchToBSC(wallet.provider); } catch { /* user can switch manually */ }
    }
  }

  // Validate and move to confirm screen
  function handleReview() {
    setTxError(null);
    if (!fromAddr)   { setTxError("Connect a source wallet first"); return; }
    if (!toWallet)   { setTxError("Select a destination wallet"); return; }
    if (fromAddr.toLowerCase() === toWallet.address.toLowerCase()) {
      setTxError("Source and destination wallets must be different");
      return;
    }
    const rawAmt = toRaw(amount, USDT_DEC);
    if (rawAmt <= 0n) { setTxError("Enter a valid amount"); return; }
    if (usdtBal !== null && rawAmt > usdtBal) { setTxError("Amount exceeds your USDT balance"); return; }
    setStep("confirming");
  }

  // Execute the ERC-20 USDT transfer directly via the connected wallet
  async function handleSend() {
    if (!fromAddr || !toWallet || !fromProv) return;
    setStep("signing");
    setTxError(null);

    try {
      const provider = connected?.provider ?? fromProv.provider;
      if (!provider) throw new Error("Wallet provider not available — reconnect your wallet");

      // Ensure BSC
      const chainHex: string = await provider.request({ method: "eth_chainId" });
      if (parseInt(chainHex, 16) !== BSC_CHAIN_ID) {
        await switchToBSC(provider);
      }

      const rawAmt = toRaw(amount, USDT_DEC);

      // Encode ERC-20 transfer(to, amount) calldata
      const data = encodeFunctionData({
        abi: USDT_ABI,
        functionName: "transfer",
        args: [toWallet.address as `0x${string}`, rawAmt],
      });

      const hash: string = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from:  fromAddr,
          to:    BSC_USDT,
          data,
          value: "0x0",
        }],
      });

      setTxHash(hash);
      setStep("done");
    } catch (e: any) {
      if (e?.code === 4001 || e?.message?.includes("rejected")) {
        setTxError("Transaction rejected. You can try again.");
        setStep("confirming");
      } else {
        setTxError(e?.message ?? "Transaction failed — please try again");
        setStep("error");
      }
    }
  }

  const rawAmt   = toRaw(amount, USDT_DEC);
  const balFmt   = usdtBal !== null ? fromRaw(usdtBal, USDT_DEC, 4) : null;
  const amtValid = rawAmt > 0n && (usdtBal === null || rawAmt <= usdtBal);

  // ── Done ────────────────────────────────────────────────────────
  if (step === "done") return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
        className="bg-white dark:bg-gray-900 rounded-2xl p-8 w-full max-w-sm text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transfer Sent!</h3>
        <p className="text-sm text-gray-500">
          {amount} USDT is on its way to <span className="font-medium">{toWallet?.label}</span> on BNB Chain.
        </p>
        <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-[#5B3CF5] hover:underline">
          View on BSCScan <ExternalLink size={12} />
        </a>
        <button onClick={onClose}
          className="w-full py-3 bg-[#5B3CF5] text-white rounded-xl text-sm font-medium">
          Done
        </button>
      </motion.div>
    </motion.div>
  );

  // ── Confirm screen ───────────────────────────────────────────────
  if (step === "confirming" || step === "signing") return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ y: 20 }} animate={{ y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Confirm Transfer</h3>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">From</span>
            <span className="font-mono text-xs text-gray-900 dark:text-white">{fromAddr.slice(0,6)}…{fromAddr.slice(-4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">To</span>
            <span className="font-medium text-gray-900 dark:text-white">{toWallet?.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Amount</span>
            <span className="font-semibold text-gray-900 dark:text-white">{amount} USDT (BEP20)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Network fee</span>
            <span className="text-gray-600 dark:text-gray-300">~$0.02 BNB</span>
          </div>
        </div>
        {txError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {txError}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => setStep("setup")} disabled={step === "signing"}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40">
            Back
          </button>
          <button onClick={handleSend} disabled={step === "signing"}
            className="flex-1 py-3 bg-[#5B3CF5] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {step === "signing" ? <><Loader2 size={16} className="animate-spin" /> Signing…</> : <>Send <ArrowRight size={16} /></>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  // ── Error screen ─────────────────────────────────────────────────
  if (step === "error") return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div className="bg-white dark:bg-gray-900 rounded-2xl p-8 w-full max-w-sm text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transfer Failed</h3>
        <p className="text-sm text-gray-500">{txError ?? "Something went wrong"}</p>
        <div className="flex gap-3">
          <button onClick={() => setStep("setup")} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm">Try Again</button>
          <button onClick={onClose} className="flex-1 py-3 bg-[#5B3CF5] text-white rounded-xl text-sm font-medium">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );

  // ── Setup screen ─────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
        className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Transfer USDT</h2>
            <p className="text-xs text-gray-500 mt-0.5">BNB Chain (BEP20)</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:opacity-80">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* FROM wallet */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">From (Connected Wallet)</label>
            <div className="relative">
              <button onClick={() => setShowFrom(!showFrom)}
                className="w-full flex items-center gap-3 p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#5B3CF5]/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#5B3CF5]/10 flex items-center justify-center shrink-0">
                  <Wallet size={16} className="text-[#5B3CF5]" />
                </div>
                {fromAddr ? (
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {fromProv?.info.name ?? "Connected Wallet"}
                    </p>
                    <p className="text-xs font-mono text-gray-500">{fromAddr.slice(0,6)}…{fromAddr.slice(-4)}</p>
                  </div>
                ) : (
                  <span className="flex-1 text-left text-sm text-gray-400">Select source wallet…</span>
                )}
                <ChevronDown size={16} className="text-gray-400 shrink-0" />
              </button>

              <AnimatePresence>
                {showFrom && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
                    {providers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        No wallets detected. Install MetaMask or Trust Wallet.
                      </div>
                    ) : (
                      providers.map(p => (
                        <button key={p.info.uuid} onClick={() => handleConnectProvider(p)}
                          className="w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <WalletIcon icon={p.info.icon} size={24} />
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{p.info.name}</p>
                            <p className="text-xs text-gray-400">Click to connect</p>
                          </div>
                          {connecting && <Loader2 size={14} className="animate-spin ml-auto text-gray-400" />}
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Balance display */}
            {fromAddr && (
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-xs text-gray-500">USDT Balance (BSC)</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {balLoading ? <Loader2 size={12} className="animate-spin inline" /> : balFmt !== null ? `${balFmt} USDT` : "—"}
                </span>
              </div>
            )}
          </div>

          {/* TO wallet */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">To (Aegis Wallet)</label>
            <div className="relative">
              <button onClick={() => setShowTo(!showTo)}
                className="w-full flex items-center gap-3 p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#5B3CF5]/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0">
                  <Shield size={16} className="text-green-600 dark:text-green-400" />
                </div>
                {toWallet ? (
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{toWallet.label}</p>
                    <p className="text-xs font-mono text-gray-500">{toWallet.address.slice(0,6)}…{toWallet.address.slice(-4)}</p>
                  </div>
                ) : (
                  <span className="flex-1 text-left text-sm text-gray-400">Select destination…</span>
                )}
                <ChevronDown size={16} className="text-gray-400 shrink-0" />
              </button>

              <AnimatePresence>
                {showTo && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                    {allDest.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">No wallets in your Aegis account yet.</div>
                    ) : (
                      allDest.map(w => (
                        <button key={w.id} onClick={() => { setToWallet(w); setShowTo(false); }}
                          className={`w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${toWallet?.id === w.id ? "bg-[#5B3CF5]/5" : ""}`}>
                          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                            <Wallet size={14} className="text-gray-500" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{w.label}</p>
                            <p className="text-xs font-mono text-gray-500">{w.address.slice(0,6)}…{w.address.slice(-4)}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Amount (USDT)</label>
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:border-[#5B3CF5]/60 transition-colors">
              <input
                type="number" min="0" step="0.01" placeholder="0.00" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 px-4 py-3.5 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
              />
              <button
                onClick={() => balFmt && setAmount(fromRaw(usdtBal!, USDT_DEC, 6))}
                className="px-4 py-3.5 text-xs font-semibold text-[#5B3CF5] hover:bg-[#5B3CF5]/5 transition-colors border-l border-gray-200 dark:border-gray-700">
                MAX
              </button>
            </div>
          </div>

          {/* Error */}
          {(txError || providerError) && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {txError ?? providerError}
            </div>
          )}

          {/* Info */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <Zap size={14} className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Transfer goes directly on-chain — no AEGIS fees. Only BNB gas (~$0.02) applies.
            </p>
          </div>

          {/* Send button */}
          <button onClick={handleReview} disabled={!fromAddr || !toWallet || !amount || !amtValid}
            className="w-full py-4 bg-[#5B3CF5] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#4b2ce5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Review Transfer <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
