/**
 * Exchange.tsx — NEXUS Real Wallet-to-Wallet Swap
 *
 * - Paste any EVM wallet address to load its balances
 * - Pick FROM token + TO token
 * - Get live quote from 1inch (via NEXUS backend)
 * - Execute swap: opens MetaMask/Trust/any injected wallet to sign
 * - Records swap in NEXUS transaction history
 * - No custody, no lock-in — pure non-custodial
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpDown, RefreshCw, Wallet, ExternalLink, CheckCircle2,
  AlertCircle, Loader2, ChevronDown, Info, Zap, Shield, Copy, Check
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWalletStore } from "@/hooks/useWalletStore";

// ── Chain options ──────────────────────────────────────────────────────────────
const CHAINS = [
  { id: 56,    name: "BNB Chain",  icon: "🟡", explorer: "https://bscscan.com/tx/" },
  { id: 1,     name: "Ethereum",   icon: "🔷", explorer: "https://etherscan.io/tx/" },
  { id: 137,   name: "Polygon",    icon: "🟣", explorer: "https://polygonscan.com/tx/" },
  { id: 42161, name: "Arbitrum",   icon: "🔵", explorer: "https://arbiscan.io/tx/" },
];

// ── Format helpers ─────────────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return addr ? addr.slice(0, 8) + "..." + addr.slice(-6) : "";
}
function isValidAddr(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}
function toRawAmount(amount: string, decimals: number): string {
  try {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return "0";
    return Math.floor(n * Math.pow(10, decimals)).toString();
  } catch { return "0"; }
}

// ── Token selector component ──────────────────────────────────────────────────
function TokenSelector({
  tokens, selected, onSelect, label, balance
}: {
  tokens: Array<{ address: string; symbol: string; decimals: number }>;
  selected: number;
  onSelect: (i: number) => void;
  label: string;
  balance?: number;
}) {
  const [open, setOpen] = useState(false);
  const tok = tokens[selected];
  if (!tok) return null;
  return (
    <div className="relative">
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-card border border-border rounded-xl hover:border-primary/40 transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {tok.symbol.slice(0, 2)}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm dark:text-white">{tok.symbol}</p>
            {balance !== undefined && (
              <p className="text-[10px] text-muted-foreground">Balance: {balance.toFixed(4)}</p>
            )}
          </div>
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {tokens.map((t, i) => (
              <button
                key={t.address}
                onClick={() => { onSelect(i); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${i === selected ? "bg-primary/5" : ""}`}
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {t.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-white">{t.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{shortAddr(t.address)}</p>
                </div>
                {i === selected && <CheckCircle2 size={14} className="ml-auto text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Exchange() {
  const { user } = useCurrentUser();
  const { wallets } = useWalletStore();

  // ── State ──────────────────────────────────────────────────────────────────
  const [chainId, setChainId] = useState(56);
  const [walletAddr, setWalletAddr] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [walletInputError, setWalletInputError] = useState("");
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [fromAmount, setFromAmount] = useState("");
  const [swapState, setSwapState] = useState<"idle" | "quoting" | "ready" | "signing" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [swapError, setSwapError] = useState("");
  const [copiedAddr, setCopiedAddr] = useState(false);

  const selectedChain = CHAINS.find(c => c.id === chainId) ?? CHAINS[0];

  // ── Auto-fill wallet from connected wallets ──────────────────────────────
  const embeddedAddr = (user as any)?.walletAddress as string | null;
  const availableWallets = [
    ...(embeddedAddr ? [{ address: embeddedAddr, label: "My NEXUS Wallet" }] : []),
    ...wallets.map(w => ({ address: w.address, label: w.label })),
  ];

  // ── tRPC queries ──────────────────────────────────────────────────────────
  const { data: tokens = [] } = trpc.exchange.getTokens.useQuery(
    { chainId },
    { staleTime: 60_000 }
  );
  const { data: prices = {} } = trpc.exchange.getPrices.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );

  const fromToken = tokens[fromIdx];
  const toToken = tokens[toIdx];
  const amountHuman = parseFloat(fromAmount) || 0;
  const rawAmount = fromToken ? toRawAmount(fromAmount, fromToken.decimals) : "0";

  const isValidWallet = isValidAddr(walletAddr);
  const canQuote = isValidWallet && !!fromToken && !!toToken && amountHuman > 0 && fromIdx !== toIdx;

  const {
    data: quote,
    isLoading: quoteLoading,
    refetch: refetchQuote,
    error: quoteError,
  } = trpc.exchange.getQuote.useQuery(
    {
      chainId,
      fromToken: fromToken?.address ?? "",
      toToken: toToken?.address ?? "",
      fromSymbol: fromToken?.symbol ?? "",
      toSymbol: toToken?.symbol ?? "",
      fromDecimals: fromToken?.decimals ?? 18,
      toDecimals: toToken?.decimals ?? 18,
      amount: rawAmount,
      amountHuman,
      walletAddress: walletAddr || "0x0000000000000000000000000000000000000001",
    },
    {
      enabled: canQuote,
      staleTime: 15_000,
      retry: 1,
    }
  );

  const recordSwapMutation = trpc.exchange.recordSwap.useMutation();

  // ── Wallet address handling ───────────────────────────────────────────────
  function applyWalletAddr(addr: string) {
    if (!isValidAddr(addr)) {
      setWalletInputError("Invalid EVM address (must start with 0x, 42 chars)");
      return;
    }
    setWalletInputError("");
    setWalletAddr(addr);
    setWalletInput(addr);
  }

  // ── Flip tokens ───────────────────────────────────────────────────────────
  function flip() {
    const newFrom = toIdx;
    const newTo = fromIdx;
    setFromIdx(newFrom);
    setToIdx(newTo);
    if (quote?.toAmount) setFromAmount(quote.toAmount);
  }

  // ── Execute swap via injected wallet ─────────────────────────────────────
  async function executeSwap() {
    if (!quote || !fromToken || !toToken || !walletAddr) return;
    setSwapState("signing");
    setSwapError("");

    try {
      // Check for injected wallet (MetaMask, Trust, etc.)
      const eth = (window as any).ethereum;
      if (!eth) {
        // Fallback: open DEX link if no injected wallet
        const dexUrl = chainId === 1
          ? `https://app.uniswap.org/#/swap?inputCurrency=${fromToken.address}&outputCurrency=${toToken.address}`
          : `https://pancakeswap.finance/swap?inputCurrency=${fromToken.address}&outputCurrency=${toToken.address}`;
        window.open(dexUrl, "_blank");
        setSwapState("idle");
        return;
      }

      // Request account access
      await eth.request({ method: "eth_requestAccounts" });

      // Switch to correct chain
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + chainId.toString(16) }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          setSwapError("Please add this network to your wallet first.");
          setSwapState("error");
          return;
        }
      }

      let hash: string;

      if (quote.calldata && quote.routerAddress) {
        // Use 1inch calldata directly
        hash = await eth.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddr,
            to: quote.routerAddress,
            data: quote.calldata,
            value: fromToken.symbol === selectedChain?.name.includes("BNB") ? "0x" + BigInt(rawAmount).toString(16) : "0x0",
          }],
        });
      } else {
        // Fallback: open PancakeSwap/Uniswap
        const dexUrl = chainId === 1
          ? `https://app.uniswap.org/#/swap?inputCurrency=${fromToken.address}&outputCurrency=${toToken.address}&exactAmount=${fromAmount}&exactField=input`
          : `https://pancakeswap.finance/swap?inputCurrency=${fromToken.address}&outputCurrency=${toToken.address}`;
        window.open(dexUrl, "_blank");
        setSwapState("idle");
        return;
      }

      setTxHash(hash);

      // Record in NEXUS history
      try {
        await recordSwapMutation.mutateAsync({
          chainId,
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromSymbol: fromToken.symbol,
          toSymbol: toToken.symbol,
          fromAmount: rawAmount,
          toAmount: quote.toAmountRaw ?? "0",
          txHash: hash,
          walletAddress: walletAddr,
          provider: quote.provider ?? "nexus_swap",
        });
      } catch {
        // Non-fatal — tx was sent
      }

      setSwapState("done");
    } catch (err: any) {
      if (err?.code === 4001) {
        setSwapError("Transaction rejected by user.");
      } else {
        setSwapError(err?.message ?? "Swap failed. Please try again.");
      }
      setSwapState("error");
    }
  }

  function reset() {
    setSwapState("idle");
    setTxHash("");
    setSwapError("");
    setFromAmount("");
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Swap Tokens</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Non-custodial swaps via 1inch. Best rate across all DEXs.
        </p>
      </div>

      {/* Chain selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CHAINS.map(c => (
          <button
            key={c.id}
            onClick={() => { setChainId(c.id); setFromIdx(0); setToIdx(1); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
              chainId === c.id
                ? "bg-primary text-white border-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <span>{c.icon}</span> {c.name}
          </button>
        ))}
      </div>

      {/* Wallet input */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-primary" />
            <span className="text-sm font-semibold dark:text-white">Swap From Wallet</span>
          </div>
          {isValidWallet && (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 size={12} /> Connected
            </div>
          )}
        </div>

        {/* Quick-select from linked wallets */}
        {availableWallets.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {availableWallets.map(w => (
              <button
                key={w.address}
                onClick={() => applyWalletAddr(w.address)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition-all ${
                  walletAddr.toLowerCase() === w.address.toLowerCase()
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                  {w.label?.slice(0, 1)}
                </div>
                {w.label}
              </button>
            ))}
          </div>
        )}

        {/* Manual address input */}
        <div className="relative">
          <input
            type="text"
            placeholder="0x... paste any EVM wallet address"
            value={walletInput}
            onChange={e => {
              setWalletInput(e.target.value);
              if (isValidAddr(e.target.value.trim())) applyWalletAddr(e.target.value.trim());
            }}
            onBlur={e => {
              if (e.target.value.trim()) applyWalletAddr(e.target.value.trim());
            }}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-xl font-mono focus:outline-none focus:border-primary transition-colors dark:text-white"
          />
          {walletAddr && (
            <button
              onClick={() => { navigator.clipboard.writeText(walletAddr); setCopiedAddr(true); setTimeout(() => setCopiedAddr(false), 2000); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted/50"
            >
              {copiedAddr ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-muted-foreground" />}
            </button>
          )}
        </div>
        {walletInputError && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={11} /> {walletInputError}
          </p>
        )}
      </div>

      {/* Swap card */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        {tokens.length > 0 ? (
          <>
            {/* From token */}
            <TokenSelector
              tokens={tokens}
              selected={fromIdx}
              onSelect={setFromIdx}
              label="You Pay"
            />
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={fromAmount}
                onChange={e => setFromAmount(e.target.value)}
                className="w-full px-4 py-3 text-2xl font-semibold bg-background border border-border rounded-xl focus:outline-none focus:border-primary dark:text-white"
              />
              {fromToken && amountHuman > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ≈ ${((prices as any)[fromToken.symbol] ?? 1 * amountHuman).toFixed(2)}
                </span>
              )}
            </div>

            {/* Flip button */}
            <div className="flex justify-center">
              <button
                onClick={flip}
                className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all group"
              >
                <ArrowUpDown size={18} className="text-primary group-hover:rotate-180 transition-transform duration-300" />
              </button>
            </div>

            {/* To token */}
            <TokenSelector
              tokens={tokens}
              selected={toIdx}
              onSelect={setToIdx}
              label="You Receive"
            />

            {/* Quote result */}
            <AnimatePresence>
              {canQuote && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {quoteLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" />
                      Getting best rate...
                    </div>
                  ) : quote?.success ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">You receive</span>
                        <span className="font-bold text-primary text-lg">
                          {parseFloat(quote.toAmount).toFixed(6)} {toToken?.symbol}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-card rounded-lg p-2">
                          <p className="text-muted-foreground">Rate</p>
                          <p className="font-medium dark:text-white">1 {fromToken?.symbol} = {quote.rate} {toToken?.symbol}</p>
                        </div>
                        <div className="bg-card rounded-lg p-2">
                          <p className="text-muted-foreground">Gas ~</p>
                          <p className="font-medium dark:text-white">${quote.estimatedGasUsd}</p>
                        </div>
                        <div className="bg-card rounded-lg p-2">
                          <p className="text-muted-foreground">Impact</p>
                          <p className={`font-medium ${parseFloat(quote.priceImpact) > 3 ? "text-red-400" : "dark:text-white"}`}>
                            {quote.priceImpact}%
                          </p>
                        </div>
                      </div>
                      {quote.protocols?.length > 0 && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Zap size={10} className="text-yellow-500" />
                          Route: {quote.protocols.join(" → ")}
                        </p>
                      )}
                    </div>
                  ) : quoteError ? (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/5 rounded-xl p-3">
                      <AlertCircle size={12} />
                      Could not get quote. Check your connection.
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading tokens...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <AnimatePresence mode="wait">
        {swapState === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center space-y-3"
          >
            <CheckCircle2 size={40} className="text-green-500 mx-auto" />
            <p className="font-semibold dark:text-white">Swap Submitted!</p>
            <p className="text-sm text-muted-foreground">
              Your swap is on-chain and being processed.
            </p>
            {txHash && (
              <a
                href={selectedChain.explorer + txHash}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                View on Explorer <ExternalLink size={11} />
              </a>
            )}
            <button
              onClick={reset}
              className="w-full py-2.5 bg-card border border-border rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors dark:text-white"
            >
              New Swap
            </button>
          </motion.div>
        ) : swapState === "error" ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="font-medium text-sm">Swap Failed</span>
            </div>
            <p className="text-xs text-muted-foreground">{swapError}</p>
            <button
              onClick={reset}
              className="w-full py-2.5 bg-card border border-border rounded-xl text-sm font-medium hover:bg-muted/50 dark:text-white"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          <motion.div key="action" className="space-y-3">
            <button
              onClick={executeSwap}
              disabled={!canQuote || !quote?.success || swapState === "signing" || quoteLoading}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all
                bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700
                disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
            >
              {swapState === "signing" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" /> Waiting for signature...
                </span>
              ) : !isValidWallet ? (
                "Enter Wallet Address"
              ) : !canQuote ? (
                "Enter Amount"
              ) : quoteLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" /> Getting Quote...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap size={18} /> Swap {fromToken?.symbol} → {toToken?.symbol}
                </span>
              )}
            </button>

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Shield size={12} className="mt-0.5 text-primary flex-shrink-0" />
              <span>
                Non-custodial — NEXUS never holds your funds. You sign directly in your own wallet.
                {quote?.provider === "price_estimate" && " (Price estimate — connect wallet for exact calldata)"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
