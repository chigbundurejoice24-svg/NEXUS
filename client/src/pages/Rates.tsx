/**
 * Rates.tsx — Live market rates
 * Fetches directly from Binance REST (no rate limit for browser requests)
 * Shows NGN equivalent, percent change, watchlist (localStorage)
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, RefreshCw, Star, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNgnRate } from "@/hooks/useNgnRate";

const SYMBOLS = [
  { key: "BTCUSDT",   label: "Bitcoin",   ticker: "BTC", color: "#F7931A" },
  { key: "ETHUSDT",   label: "Ethereum",  ticker: "ETH", color: "#627EEA" },
  { key: "BNBUSDT",   label: "BNB",       ticker: "BNB", color: "#F3BA2F" },
  { key: "MATICUSDT", label: "Polygon",   ticker: "MATIC", color: "#8247E5" },
  { key: "SOLUSDT",   label: "Solana",    ticker: "SOL", color: "#9945FF" },
  { key: "USDTBUSD",  label: "Tether",    ticker: "USDT", color: "#5B3CF5" },
];

interface RateData { price: string; change: string; }

function loadWatchlist(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem("aegis_watchlist") ?? "[]")); }
  catch { return new Set(); }
}
function saveWatchlist(ws: Set<string>) {
  localStorage.setItem("aegis_watchlist", JSON.stringify([...ws]));
}

export default function Rates() {
  const { rate: NGN_PER_USD } = useNgnRate();
  const [rates, setRates]         = useState<Record<string, RateData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLast]    = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(loadWatchlist);

  async function fetchRates() {
    try {
      const symbolStr = SYMBOLS.map(s => `"${s.key}"`).join(",");
      const [tickerRes, changeRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/price?symbols=[${symbolStr}]`, { signal: AbortSignal.timeout(5000) }),
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolStr}]`,  { signal: AbortSignal.timeout(5000) }),
      ]);
      const prices: {symbol:string;price:string}[]  = await tickerRes.json();
      const changes: {symbol:string;priceChangePercent:string}[] = await changeRes.json();
      const map: Record<string, RateData> = {};
      prices.forEach(p => {
        const ch = changes.find(c => c.symbol === p.symbol);
        map[p.symbol] = { price: p.price, change: ch?.priceChangePercent ?? "0" };
      });
      setRates(map);
      setLast(new Date());
    } catch {}
    setIsLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchRates(); const iv = setInterval(fetchRates, 60_000); return () => clearInterval(iv); }, []);

  function refresh() { setRefreshing(true); fetchRates(); }

  function toggleWatch(key: string) {
    const next = new Set(watchlist);
    if (next.has(key)) next.delete(key); else next.add(key);
    setWatchlist(next); saveWatchlist(next);
  }

  const sorted = [...SYMBOLS].sort((a, b) => (watchlist.has(b.key) ? 1 : 0) - (watchlist.has(a.key) ? 1 : 0));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-aegis-secondary-dark">Live prices · auto-refresh every 60s</p>
          <p className="text-xs text-aegis-tertiary-dark mt-0.5">1 USD = ₦{NGN_PER_USD.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-aegis-tertiary-dark flex items-center gap-1">
              <Clock size={11}/> {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={refresh} disabled={refreshing}
            className="p-2 rounded-xl bg-card border border-border hover:bg-aegis-bg-elevated transition-colors">
            <RefreshCw size={14} className={`text-aegis-tertiary-dark ${refreshing ? "animate-spin" : ""}`}/>
          </button>
        </div>
      </div>

      {/* NGN Rate Banner */}
      <div className="bg-gradient-to-r from-[#5B3CF5]/10 to-[#3B5BDB]/10 border border-[#5B3CF5]/20 rounded-xl px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-aegis-tertiary-dark">USDT → NGN Rate</p>
          <p className="text-lg font-bold dark:text-white">₦{NGN_PER_USD > 0 ? NGN_PER_USD.toLocaleString("en-NG", {minimumFractionDigits:2}) : "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-aegis-tertiary-dark">Best for remittance</p>
          <p className="text-xs text-green-400 font-medium mt-0.5">✓ Live via CBN</p>
        </div>
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? [...Array(6)].map((_,i) => <Skeleton key={i} className="h-40 rounded-xl"/>)
          : sorted.map((s, i) => {
              const d = rates[s.key];
              const price  = d ? parseFloat(d.price) : 0;
              const change = d ? parseFloat(d.change) : 0;
              const isUp   = change >= 0;
              const inWatch = watchlist.has(s.key);
              return (
                <motion.div key={s.key} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                  whileHover={{y:-3}} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all relative">
                  {inWatch && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-yellow-400"/>}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`${s.color}20`}}>
                        <span className="text-xs font-bold" style={{color:s.color}}>{s.ticker.slice(0,2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold dark:text-white">{s.ticker}/USD</p>
                        <p className="text-xs text-aegis-tertiary-dark">{s.label}</p>
                      </div>
                    </div>
                    <button onClick={() => toggleWatch(s.key)}
                      className={`p-1.5 rounded-lg transition-colors ${inWatch ? "text-yellow-400" : "text-aegis-tertiary-dark hover:text-yellow-400"}`}>
                      <Star size={14} fill={inWatch ? "currentColor" : "none"}/>
                    </button>
                  </div>
                  <p className="text-2xl font-bold dark:text-white mb-1">
                    {price > 0 ? `$${price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:price<1?6:2})}` : "—"}
                  </p>
                  <p className="text-xs text-aegis-tertiary-dark mb-3">
                    {price > 0 && NGN_PER_USD > 0 ? `₦${(price * NGN_PER_USD).toLocaleString("en-NG",{maximumFractionDigits:0})}` : "—"}
                  </p>
                  <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
                    {isUp ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                    {isUp ? "+" : ""}{change.toFixed(2)}% (24h)
                  </div>
                </motion.div>
              );
          })
        }
      </div>
    </div>
  );
}
