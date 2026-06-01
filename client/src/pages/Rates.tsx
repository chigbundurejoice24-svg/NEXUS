import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, RefreshCw, Clock } from "lucide-react";
import { useRates } from "@/hooks/useRates";
import { Skeleton } from "@/components/ui/skeleton";

const RATE_META: Record<string, { label: string; pair: string; color: string }> = {
  "ethereum:ETH":  { label: "Ethereum",  pair: "ETH/USD",  color: "#627EEA" },
  "bsc:BNB":       { label: "BNB",        pair: "BNB/USD",  color: "#F3BA2F" },
  "ethereum:BTC":  { label: "Bitcoin",   pair: "BTC/USD",  color: "#F7931A" },
  "ethereum:USDT": { label: "Tether",    pair: "USDT/USD", color: "#5B3CF5" },
  "ethereum:USDC": { label: "USD Coin",  pair: "USDC/USD", color: "#3B5BDB" },
  "polygon:MATIC": { label: "Polygon",   pair: "MATIC/USD",color: "#8247E5" },
  "arbitrum:ETH":  { label: "Arb ETH",   pair: "ETH/USD",  color: "#28A0F0" },
};

const NGN_PER_USD = 1595.20;

export default function Rates() {
  const { prices, isLoading, lastUpdated } = useRates();

  const entries = Object.entries(RATE_META).map(([key, meta]) => ({
    key,
    ...meta,
    priceUsd: prices[key] as number ?? 0,
  }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-aegis-secondary-dark">Live exchange rates · auto-refreshes every 30 s</p>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark">
            <Clock size={12} />
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? [1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)
          : entries.map((entry, index) => (
            <motion.div
              key={entry.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${entry.color}20` }}
                  >
                    <span className="text-sm font-bold" style={{ color: entry.color }}>
                      {entry.pair.split("/")[0].slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{entry.pair}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{entry.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20">
                  <TrendingUp size={12} className="text-aegis-success-green" />
                  <span className="text-xs font-medium text-aegis-success-green">Live</span>
                </div>
              </div>

              <p className="text-2xl font-semibold text-aegis-primary-dark dark:text-white">
                ${entry.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: entry.priceUsd > 1000 ? 2 : 6 })}
              </p>
              <p className="text-sm text-aegis-secondary-dark mt-1">
                ≈ ₦{(entry.priceUsd * NGN_PER_USD).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>

              <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-aegis-tertiary-dark">
                <span>Source: CoinGecko</span>
                <span style={{ color: entry.color }}>● Live</span>
              </div>
            </motion.div>
          ))}
      </div>

      {/* NGN Reference */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-3">Fiat Reference Rate</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-aegis-tertiary-dark">USD/NGN</p>
            <p className="text-xl font-semibold text-aegis-primary-dark dark:text-white mt-0.5">
              ₦{NGN_PER_USD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark">
            <RefreshCw size={12} />
            Reference rate
          </div>
        </div>
      </div>
    </div>
  );
}
