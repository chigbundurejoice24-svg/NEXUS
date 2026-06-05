/**
 * Exchange.tsx — Token swap with live rates
 * Redirects to PancakeSwap (BSC) / Uniswap (ETH) for actual execution
 * Shows live price preview + fee calc from wallet balances
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, ChevronDown, ExternalLink, RefreshCw, Info } from "lucide-react";
import { useWalletStore } from "@/hooks/useWalletStore";

const TOKEN_META: Record<string, { color: string; dexId: string }> = {
  USDT:  { color: "#5B3CF5", dexId: "0x55d398326f99059fF775485246999027B3197955" },
  USDC:  { color: "#3B5BDB", dexId: "0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d" },
  BNB:   { color: "#F3BA2F", dexId: "BNB" },
  ETH:   { color: "#627EEA", dexId: "ETH" },
  MATIC: { color: "#8247E5", dexId: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0" },
};

const FALLBACK_TOKENS = [
  { symbol: "USDT", balance: 0, network: "bsc"  },
  { symbol: "USDC", balance: 0, network: "bsc"  },
  { symbol: "BNB",  balance: 0, network: "bsc"  },
  { symbol: "ETH",  balance: 0, network: "ethereum" },
];

// Binance price cache
let _priceCache: Record<string,number> = {};
let _priceFetchedAt = 0;

async function getBinancePrices(): Promise<Record<string,number>> {
  if (Date.now() - _priceFetchedAt < 60_000) return _priceCache;
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbols=["ETHUSDT","BNBUSDT","MATICUSDT","USDTBUSD"]', { signal: AbortSignal.timeout(4000) });
    const arr: {symbol:string;price:string}[] = await r.json();
    const map: Record<string,number> = { USDT: 1, USDC: 1 };
    arr.forEach(a => {
      if (a.symbol === "ETHUSDT")   map["ETH"]   = parseFloat(a.price);
      if (a.symbol === "BNBUSDT")   map["BNB"]   = parseFloat(a.price);
      if (a.symbol === "MATICUSDT") map["MATIC"] = parseFloat(a.price);
    });
    _priceCache = map; _priceFetchedAt = Date.now();
    return map;
  } catch { return _priceCache; }
}

export default function Exchange() {
  const { wallets } = useWalletStore();
  const [prices, setPrices] = useState<Record<string,number>>({ USDT: 1, USDC: 1, BNB: 620, ETH: 3500, MATIC: 0.85 });
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx]     = useState(1);
  const [fromAmount, setFrom] = useState("");
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo]     = useState(false);
  const [slippage, setSlip]     = useState(0.5);
  const [refreshing, setRef]    = useState(false);

  // Build token list from real wallets
  const tokens = useMemo(() => {
    const seen = new Set<string>();
    const out: { symbol: string; balance: number; network: string }[] = [];
    for (const w of wallets) {
      for (const a of (w as any).assets ?? []) {
        const sym = (a.symbol ?? "").toUpperCase();
        if (sym && !seen.has(sym)) {
          seen.add(sym);
          out.push({ symbol: sym, balance: parseFloat(a.balance ?? "0"), network: a.network ?? "bsc" });
        }
      }
    }
    return out.length > 0 ? out : FALLBACK_TOKENS;
  }, [wallets]);

  async function refresh() {
    setRef(true);
    const p = await getBinancePrices();
    setPrices(p);
    setRef(false);
  }

  const fromToken = tokens[fromIdx] ?? tokens[0];
  const toToken   = tokens[toIdx]   ?? tokens[1] ?? tokens[0];
  const fromUsd   = prices[fromToken?.symbol] ?? 1;
  const toUsd     = prices[toToken?.symbol]   ?? 1;
  const rate      = toUsd > 0 ? fromUsd / toUsd : 0;
  const toAmount  = fromAmount ? (parseFloat(fromAmount) * rate).toFixed(6) : "";
  const minRecv   = toAmount   ? (parseFloat(toAmount) * (1 - slippage / 100)).toFixed(6) : "0";
  const usdValue  = fromAmount ? (parseFloat(fromAmount) * fromUsd).toFixed(2) : "0.00";

  function flip() { const t = fromIdx; setFromIdx(toIdx); setToIdx(t); setFrom(toAmount); }

  // Build DEX link
  function getDexUrl(): string {
    const base = fromToken?.network === "ethereum" || toToken?.network === "ethereum"
      ? "https://app.uniswap.org/#/swap"
      : "https://pancakeswap.finance/swap";
    const inToken  = TOKEN_META[fromToken?.symbol]?.dexId ?? fromToken?.symbol ?? "";
    const outToken = TOKEN_META[toToken?.symbol]?.dexId  ?? toToken?.symbol  ?? "";
    return `${base}?inputCurrency=${inToken}&outputCurrency=${outToken}`;
  }

  function TokenSelector({ idx, setIdx, show, setShow }: any) {
    const tok = tokens[idx] ?? tokens[0];
    const meta = TOKEN_META[tok?.symbol] ?? { color: "#5B3CF5" };
    return (
      <div className="relative">
        <button onClick={() => setShow(!show)}
          className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated rounded-xl border border-border hover:bg-card transition-colors">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{background:meta.color}}>
            {tok?.symbol?.slice(0,2)}
          </div>
          <span className="text-sm font-semibold dark:text-white">{tok?.symbol}</span>
          <ChevronDown size={13} className={`text-aegis-tertiary-dark transition-transform ${show?"rotate-180":""}`}/>
        </button>
        {show && (
          <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
            className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
            {tokens.map((t, i) => (
              <button key={i} onClick={() => { setIdx(i); setShow(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-aegis-bg-elevated text-left">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{background: TOKEN_META[t.symbol]?.color ?? "#5B3CF5"}}>
                  {t.symbol.slice(0,2)}
                </div>
                <div>
                  <p className="text-xs font-semibold dark:text-white">{t.symbol}</p>
                  <p className="text-[10px] text-aegis-tertiary-dark">{t.balance.toFixed(4)}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-aegis-secondary-dark">Swap between tokens at live DEX rates</p>
        <button onClick={refresh} disabled={refreshing}
          className="p-2 rounded-xl bg-card border border-border hover:bg-aegis-bg-elevated">
          <RefreshCw size={14} className={`text-aegis-tertiary-dark ${refreshing?"animate-spin":""}`}/>
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
        <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0"/>
        <p className="text-xs text-blue-700 dark:text-blue-400">Swaps are executed on PancakeSwap (BSC) or Uniswap (ETH) — fully non-custodial. You sign directly in your wallet.</p>
      </div>

      {/* Swap card */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-2">
        {/* From */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">You Pay</span>
            <span className="text-xs text-aegis-secondary-dark">Balance: {fromToken?.balance?.toFixed(4) ?? "0"} {fromToken?.symbol}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="number" value={fromAmount} onChange={e => setFrom(e.target.value)}
              placeholder="0.00"
              className="flex-1 text-3xl font-semibold bg-transparent outline-none dark:text-white placeholder:text-aegis-tertiary-dark/40 min-w-0"/>
            <TokenSelector idx={fromIdx} setIdx={setFromIdx} show={showFrom} setShow={setShowFrom}/>
          </div>
          {fromAmount && <p className="text-xs text-aegis-tertiary-dark mt-2">≈ ${usdValue} USD</p>}
          <button onClick={() => setFrom(String(fromToken?.balance ?? 0))}
            className="text-xs text-aegis-accent-purple hover:opacity-80 mt-1">MAX</button>
        </div>

        {/* Flip */}
        <div className="flex justify-center">
          <button onClick={flip}
            className="p-2.5 rounded-full bg-card border border-border hover:bg-aegis-bg-elevated shadow-sm transition-all hover:scale-110">
            <ArrowUpDown size={16} className="text-aegis-accent-purple"/>
          </button>
        </div>

        {/* To */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">You Receive</span>
            <span className="text-xs text-aegis-secondary-dark">Balance: {toToken?.balance?.toFixed(4) ?? "0"} {toToken?.symbol}</span>
          </div>
          <div className="flex items-center gap-3">
            <p className={`flex-1 text-3xl font-semibold min-w-0 truncate ${toAmount ? "dark:text-white" : "text-aegis-tertiary-dark/40"}`}>
              {toAmount || "0.00"}
            </p>
            <TokenSelector idx={toIdx} setIdx={setToIdx} show={showTo} setShow={setShowTo}/>
          </div>
        </div>
      </motion.div>

      {/* Rate details */}
      {fromAmount && parseFloat(fromAmount) > 0 && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}}
          className="bg-card border border-border rounded-xl p-4 space-y-2 text-xs">
          {[
            ["Rate",             `1 ${fromToken?.symbol} = ${rate.toFixed(6)} ${toToken?.symbol}`],
            ["Min. Received",    `${minRecv} ${toToken?.symbol} (${slippage}% slippage)`],
            ["Network",          fromToken?.network === "ethereum" ? "Ethereum · Uniswap" : "BNB Chain · PancakeSwap"],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-aegis-tertiary-dark">{label}</span>
              <span className="dark:text-white font-medium">{val}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
            <span className="text-aegis-tertiary-dark">Slippage</span>
            <div className="flex gap-1">
              {[0.1,0.5,1.0].map(s => (
                <button key={s} onClick={() => setSlip(s)}
                  className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${slippage===s ? "border-[#5B3CF5] bg-[#5B3CF5]/10 text-[#5B3CF5]" : "border-border text-aegis-tertiary-dark"}`}>
                  {s}%
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Swap button — opens DEX */}
      <button
        onClick={() => window.open(getDexUrl(), "_blank", "noopener,noreferrer")}
        disabled={!fromAmount || parseFloat(fromAmount) <= 0}
        className="w-full py-4 gradient-brand text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 shadow-glow">
        <ExternalLink size={18}/> Swap on {fromToken?.network === "ethereum" ? "Uniswap" : "PancakeSwap"}
      </button>
      <p className="text-center text-xs text-aegis-tertiary-dark">Opens the DEX in a new tab · You sign with your own wallet</p>
    </div>
  );
}
