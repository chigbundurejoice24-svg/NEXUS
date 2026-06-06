/**
 * WalletTransferModal.tsx
 *
 * Wallet-to-wallet USDT transfer on BSC.
 * - Auto-detects connected Web3 wallets (EIP-6963 + legacy window.ethereum)
 * - Reads live USDT balance from source wallet (no hardcoding)
 * - Lets user pick FROM wallet (any connected provider) and TO wallet (any Aegis or external)
 * - Amount input with MAX button
 * - Calls transactions.create → build → sign → submit
 * - Works with MetaMask, Trust Wallet, OKX, Coinbase Wallet, Rabby, and any EIP-1193 wallet
 */
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowRight, Loader2, CheckCircle, AlertTriangle,
  Wallet, ChevronDown, Zap, ExternalLink, RefreshCw, Shield,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useWeb3Providers, type DetectedProvider } from "@/hooks/useWeb3Providers";
import { createPublicClient, http, formatUnits } from "viem";
import { bsc } from "viem/chains";

// ── Constants ─────────────────────────────────────────────────────
const BSC_USDT     = "0x55d398326f99059fF775485246999027B3197955" as const;
const USDT_DEC     = 18;
const USDT_ABI     = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }] as const;
const BSC_CHAIN_ID = 56;

// ── Helpers ───────────────────────────────────────────────────────
function toRaw(amount: string, dec: number): string {
  try {
    const [whole, frac = ""] = amount.split(".");
    const padded = (frac + "0".repeat(dec)).slice(0, dec);
    return BigInt(whole + padded).toString();
  } catch { return "0"; }
}

function fromRaw(raw: string | bigint, dec: number, dp = 4): string {
  try {
    const n = typeof raw === "bigint" ? raw : BigInt(raw);
    const d = 10n ** BigInt(dec);
    const whole = n / d;
    const frac  = (n % d).toString().padStart(dec, "0").slice(0, dp);
    return `${whole}.${frac}`;
  } catch { return "0.0000"; }
}

// Wallet icon (emoji fallback for non-SVG icons)
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
  myWallets: StoredWallet[];     // all wallets in the user's Aegis account
  embeddedAddress?: string | null;
}

// ── Component ─────────────────────────────────────────────────────
export default function WalletTransferModal({ onClose, myWallets, embeddedAddress }: Props) {
  const { providers, connected, connecting, error: providerError, connect, switchToBSC, sendTransactions, disconnect } = useWeb3Providers();

  // Destination — all Aegis wallets (embedded + external)
  const allDest: StoredWallet[] = [
    ...(embeddedAddress ? [{ id: "__embedded__", address: embeddedAddress, label: "My Aegis Wallet (embedded)" }] : []),
    ...myWallets,
  ];

  const [step,      setStep]      = useState<TransferStep>("setup");
  const [fromProv,  setFromProv]  = useState<DetectedProvider | null>(null);
  const [fromAddr,  setFromAddr]  = useState<string>("");
  const [toWallet,  setToWallet]  = useState<StoredWallet | null>(allDest[0] ?? null);
  const [amount,    setAmount]    = useState("");
  const [usdtBal,   setUsdtBal]  = useState<bigint | null>(null);
  const [balLoading,setBalLoad]  = useState(false);
  const [showFrom,  setShowFrom]  = useState(false);
  const [showTo,    setShowTo]    = useState(false);
  const [txHashes,  setTxHashes]  = useState<string[]>([]);
  const [txId,      setTxId]      = useState<string | null>(null);
  const [txError,   setTxError]   = useState<string | null>(null);
  const [progress,  setProgress]  = useState({ current: 0, total: 0, label: "" });

  const createMut = trpc.transactions.create.useMutation();
  const buildMut  = trpc.transactions.build.useMutation();
  const submitMut = trpc.transactions.submit.useMutation();

  // Fetch USDT balance when source wallet is selected
  const fetchBalance = useCallback(async (address: string) => {
    if (!address) return;
    setBalLoad(true);
    try {
      const client = createPublicClient({ chain: bsc, transport: http("https://rpc.ankr.com/bsc") });
      const bal = await client.readContract({
        address: BSC_USDT, abi: USDT_ABI, functionName: "balanceOf", args: [address as `0x${string}`],
      }) as bigint;
      setUsdtBal(bal);
    } catch { setUsdtBal(null); }
    finally { setBalLoad(false); }
  }, []);

  useEffect(() => { if (fromAddr) fetchBalance(fromAddr); }, [fromAddr, fetchBalance]);

  // Connect a provider
  async function handleConnectProvider(detected: DetectedProvider) {
    setShowFrom(false);
    const wallet = await connect(detected);
    if (!wallet) return;
    setFromProv(detected);
    setFromAddr(wallet.address);
    // Auto-switch to BSC
    if (wallet.chainId !== BSC_CHAIN_ID) {
      try { await switchToBSC(wallet.provider); } catch { /* user can switch manually */ }
    }
  }

  // Max button
  function handleMax() {
    if (!usdtBal) return;
    // Leave a tiny buffer — don't send entire balance (fee needs some USDT too)
    const max = usdtBal * 95n / 100n;
    setAmount(fromRaw(max, USDT_DEC, 6));
  }

  // Validate
  const amountRaw = amount ? toRaw(amount, USDT_DEC) : "0";
  const amountBig = amountRaw !== "0" ? BigInt(amountRaw) : 0n;
  const isValid   = (
    fromAddr &&
    toWallet &&
    fromAddr.toLowerCase() !== toWallet.address.toLowerCase() &&
    amountBig > 0n &&
    (!usdtBal || amountBig <= usdtBal)
  );

  // Execute transfer
  async function handleTransfer() {
    if (!isValid || !fromProv || !connected) return;
    setStep("confirming");
    setTxError(null);

    try {
      // 1. Create
      setProgress({ current: 1, total: 5, label: "Creating transaction..." });
      const tx = await createMut.mutateAsync({
        referenceId:    `TRF_${Date.now()}`,
        idempotencyKey: crypto.randomUUID(),
        chainId:        BSC_CHAIN_ID,
        wallet:         fromAddr,
        recipient:      toWallet!.address,
        amountRaw:      amountRaw,
        tokenDecimals:  USDT_DEC,
      });
      setTxId(tx.id ?? tx);

      // 2. Build
      setProgress({ current: 2, total: 5, label: "Building transactions..." });
      const built = await buildMut.mutateAsync({ transactionId: tx.id ?? tx });

      // 3. Switch network
      setProgress({ current: 3, total: 5, label: "Switching to BSC..." });
      const chainHex = await connected.provider.request({ method: "eth_chainId" });
      if (parseInt(chainHex, 16) !== BSC_CHAIN_ID) {
        await switchToBSC(connected.provider);
      }

      // 4. Sign + broadcast
      setStep("signing");
      setProgress({ current: 4, total: 5, label: `Sign ${built.transactions.length} transaction(s) in your wallet...` });

      const hashes = await sendTransactions(
        connected.provider,
        fromAddr,
        built.transactions,
        (i, total, hash) => {
          setTxHashes(prev => [...prev, hash]);
          setProgress({ current: 4, total: 5, label: `Signed ${i}/${total}...` });
        }
      );

      // 5. Submit
      setProgress({ current: 5, total: 5, label: "Finalizing..." });
      await submitMut.mutateAsync({
        transactionId: tx.id ?? tx,
        txHash: hashes[hashes.length - 1],
      });

      setTxHashes(hashes);
      setStep("done");
    } catch (e: any) {
      const msg = e?.message ?? "Transfer failed";
      setTxError(msg.includes("rejected") || msg.includes("denied") ? "Transaction rejected in wallet" : msg);
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#5B3CF5]/20 flex items-center justify-center">
              <ArrowRight size={15} className="text-[#5B3CF5]" />
            </div>
            <h2 className="font-bold dark:text-white">Wallet Transfer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors">
            <X size={16} className="text-aegis-tertiary-dark" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── SETUP ── */}
          {(step === "setup" || step === "confirming") && (
            <>
              {/* FROM — Web3 wallet picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wide">From (Source)</label>

                {fromAddr ? (
                  <div className="flex items-center gap-3 p-3.5 bg-aegis-bg-elevated border border-border rounded-xl">
                    <WalletIcon icon={fromProv?.info.icon ?? "💼"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold dark:text-white">{fromProv?.info.name ?? "Wallet"}</p>
                      <p className="text-xs font-mono text-aegis-tertiary-dark truncate">{fromAddr.slice(0,10)}…{fromAddr.slice(-6)}</p>
                    </div>
                    <div className="text-right">
                      {balLoading ? (
                        <Loader2 size={14} className="animate-spin text-aegis-tertiary-dark" />
                      ) : usdtBal !== null ? (
                        <div>
                          <p className="text-xs font-bold text-[#5B3CF5]">{fromRaw(usdtBal, USDT_DEC, 2)} USDT</p>
                          <p className="text-[10px] text-aegis-tertiary-dark">BSC balance</p>
                        </div>
                      ) : null}
                    </div>
                    <button onClick={() => { disconnect(); setFromAddr(""); setFromProv(null); setUsdtBal(null); }}
                      className="p-1 rounded-lg hover:bg-red-500/10 text-aegis-tertiary-dark hover:text-red-400 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <button onClick={() => setShowFrom(!showFrom)}
                      className="w-full flex items-center justify-between p-3.5 bg-aegis-bg-elevated border border-border rounded-xl hover:border-[#5B3CF5]/50 transition-colors">
                      <div className="flex items-center gap-2 text-sm text-aegis-tertiary-dark">
                        <Wallet size={15} />
                        {connecting ? "Connecting…" : providers.length > 0 ? "Select wallet to connect" : "No wallets detected"}
                      </div>
                      {connecting ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} className="text-aegis-tertiary-dark" />}
                    </button>

                    <AnimatePresence>
                      {showFrom && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                          {providers.length === 0 ? (
                            <div className="p-4 text-center">
                              <p className="text-sm text-aegis-secondary-dark">No wallet extensions found.</p>
                              <p className="text-xs text-aegis-tertiary-dark mt-1">Install MetaMask, Trust Wallet, or OKX Wallet.</p>
                            </div>
                          ) : (
                            providers.map(p => (
                              <button key={p.info.rdns} onClick={() => handleConnectProvider(p)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-aegis-bg-elevated transition-colors text-left">
                                <WalletIcon icon={p.info.icon} size={22} />
                                <span className="text-sm font-medium dark:text-white">{p.info.name}</span>
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {providerError && <p className="text-xs text-red-400">{providerError}</p>}
              </div>

              {/* TO — destination wallet picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wide">To (Destination)</label>
                <div className="relative">
                  <button onClick={() => setShowTo(!showTo)}
                    className="w-full flex items-center justify-between p-3.5 bg-aegis-bg-elevated border border-border rounded-xl hover:border-[#5B3CF5]/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#5B3CF5]/20 flex items-center justify-center flex-shrink-0">
                        <Shield size={12} className="text-[#5B3CF5]" />
                      </div>
                      {toWallet ? (
                        <div className="text-left">
                          <p className="text-sm font-medium dark:text-white">{toWallet.label}</p>
                          <p className="text-xs font-mono text-aegis-tertiary-dark">{toWallet.address.slice(0,10)}…{toWallet.address.slice(-6)}</p>
                        </div>
                      ) : <span className="text-sm text-aegis-tertiary-dark">Select destination wallet</span>}
                    </div>
                    <ChevronDown size={14} className="text-aegis-tertiary-dark flex-shrink-0" />
                  </button>

                  <AnimatePresence>
                    {showTo && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                        {allDest.filter(w => w.address.toLowerCase() !== fromAddr.toLowerCase()).map(w => (
                          <button key={w.id} onClick={() => { setToWallet(w); setShowTo(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-aegis-bg-elevated transition-colors text-left">
                            <div className="w-7 h-7 rounded-lg bg-[#5B3CF5]/20 flex items-center justify-center flex-shrink-0">
                              <Shield size={13} className="text-[#5B3CF5]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium dark:text-white">{w.label}</p>
                              <p className="text-xs font-mono text-aegis-tertiary-dark">{w.address.slice(0,10)}…{w.address.slice(-6)}</p>
                            </div>
                          </button>
                        ))}
                        {allDest.filter(w => w.address.toLowerCase() !== fromAddr.toLowerCase()).length === 0 && (
                          <div className="p-4 text-center text-xs text-aegis-tertiary-dark">
                            No other wallets. Add wallets on this page first.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* AMOUNT */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wide">Amount (USDT)</label>
                <div className="flex items-center gap-2 p-3.5 bg-aegis-bg-elevated border border-border rounded-xl focus-within:border-[#5B3CF5]/50">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 bg-transparent text-xl font-bold outline-none dark:text-white"
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {usdtBal !== null && (
                      <button onClick={handleMax}
                        className="text-xs px-2 py-1 rounded-lg bg-[#5B3CF5]/20 text-[#5B3CF5] hover:bg-[#5B3CF5]/30 font-semibold transition-colors">
                        MAX
                      </button>
                    )}
                    <span className="text-sm font-bold text-aegis-tertiary-dark">USDT</span>
                  </div>
                </div>
                {usdtBal !== null && (
                  <div className="flex items-center justify-between text-xs text-aegis-tertiary-dark px-1">
                    <span>Available: {fromRaw(usdtBal, USDT_DEC, 4)} USDT</span>
                    {amountBig > 0n && amountBig > (usdtBal ?? 0n) && (
                      <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10}/> Insufficient balance</span>
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-[#5B3CF5]/10 border border-[#5B3CF5]/20 rounded-xl text-xs text-[#5B3CF5]">
                <Zap size={12} className="mt-0.5 flex-shrink-0"/>
                <span>0.5% Aegis protocol fee (reduced by holding CZN). BNB gas required from source wallet.</span>
              </div>

              {step === "confirming" && (
                <div className="flex items-center gap-3 px-4 py-3 bg-aegis-bg-elevated rounded-xl">
                  <Loader2 size={16} className="animate-spin text-[#5B3CF5] flex-shrink-0"/>
                  <p className="text-sm text-aegis-secondary-dark">{progress.label}</p>
                </div>
              )}

              <button
                onClick={handleTransfer}
                disabled={!isValid || step === "confirming"}
                className="w-full py-4 gradient-brand text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === "confirming" ? <Loader2 size={18} className="animate-spin"/> : <ArrowRight size={18}/>}
                {step === "confirming" ? "Processing…" : "Transfer USDT"}
              </button>
            </>
          )}

          {/* ── SIGNING ── */}
          {step === "signing" && (
            <div className="flex flex-col items-center py-12 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#5B3CF5]/20 border border-[#5B3CF5]/40 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-[#5B3CF5]" />
              </div>
              <p className="text-lg font-bold dark:text-white">Waiting for signature…</p>
              <p className="text-sm text-aegis-tertiary-dark max-w-[260px]">{progress.label}</p>
              {txHashes.length > 0 && (
                <div className="space-y-1 w-full">
                  {txHashes.map((h, i) => (
                    <a key={i} href={`https://bscscan.com/tx/${h}`} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 text-xs text-[#5B3CF5] hover:underline">
                      Tx {i+1}: {h.slice(0,10)}…{h.slice(-6)} <ExternalLink size={10}/>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="flex flex-col items-center py-10 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h3 className="text-xl font-bold dark:text-white">Transfer Submitted!</h3>
              <p className="text-sm text-aegis-tertiary-dark">
                {amount} USDT → {toWallet?.label ?? "destination"}
              </p>
              <div className="w-full space-y-2">
                {txHashes.map((h, i) => (
                  <a key={i} href={`https://bscscan.com/tx/${h}`} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs text-[#5B3CF5] py-2 border border-[#5B3CF5]/30 rounded-xl hover:bg-[#5B3CF5]/10 transition-colors">
                    View Tx {i+1} on BSCScan <ExternalLink size={11}/>
                  </a>
                ))}
              </div>
              <p className="text-xs text-aegis-tertiary-dark">Status: SUBMITTED → CONFIRMED → SETTLED (auto)</p>
              <button onClick={onClose} className="w-full py-3 gradient-brand text-white rounded-xl font-semibold">Done</button>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <div className="flex flex-col items-center py-10 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
              <h3 className="text-lg font-bold dark:text-white">Transfer Failed</h3>
              <p className="text-sm text-red-400 max-w-[280px]">{txError}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => { setStep("setup"); setTxError(null); setTxHashes([]); }}
                  className="flex-1 py-3 border border-border rounded-xl text-sm font-semibold text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors flex items-center justify-center gap-1.5">
                  <RefreshCw size={13}/> Try Again
                </button>
                <button onClick={onClose} className="flex-1 py-3 gradient-brand text-white rounded-xl text-sm font-semibold">Close</button>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
