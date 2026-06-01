import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, ArrowUpRight, Clock } from 'lucide-react'
import { exchangeRates } from '@/data/mockData'

export default function Rates() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark">Live exchange rates and stablecoin pricing</p>

      {/* Rate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {exchangeRates.map((rate, index) => (
          <motion.div
            key={rate.from}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
            className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center">
                  <span className="text-sm font-bold text-aegis-accent-purple">{rate.from.slice(0, 2)}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{rate.from}/{rate.to}</p>
                  <p className="text-xs text-aegis-tertiary-dark">{rate.from} to {rate.to}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                rate.change24h >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                {rate.change24h >= 0 ? (
                  <TrendingUp size={12} className="text-aegis-success-green" />
                ) : (
                  <TrendingDown size={12} className="text-red-500" />
                )}
                <span className={`text-xs font-medium ${rate.change24h >= 0 ? 'text-aegis-success-green' : 'text-red-500'}`}>
                  {rate.change24h >= 0 ? '+' : ''}{rate.change24h}%
                </span>
              </div>
            </div>

            <p className="text-2xl font-semibold text-aegis-primary-dark dark:text-white mb-4">
              ₦{rate.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>

            {/* Mini Chart */}
            <div className="h-12 mb-3">
              <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`grad-${rate.from}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={rate.change24h >= 0 ? '#03CD69' : '#EF4444'} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={rate.change24h >= 0 ? '#03CD69' : '#EF4444'} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`M0,${rate.change24h >= 0 ? 35 : 15} ${Array.from({ length: 10 }).map((_, i) => {
                    const x = (i + 1) * 20
                    const baseY = rate.change24h >= 0 ? 35 - i * 1.5 : 15 + i * 1.2
                    const jitter = Math.sin(i * 2.5) * 8
                    return `L${x},${Math.max(2, Math.min(38, baseY + jitter))}`
                  }).join(' ')}`}
                  fill={`url(#grad-${rate.from})`}
                  stroke={rate.change24h >= 0 ? '#03CD69' : '#EF4444'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between text-xs text-aegis-tertiary-dark">
              <span>High: ₦{rate.high24h.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
              <span>Low: ₦{rate.low24h.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
            </div>

            <div className="flex items-center gap-1 mt-2 text-xs text-aegis-tertiary-dark">
              <Clock size={10} />
              <span>Vol: ₦{(rate.volume24h / 1e9).toFixed(1)}B</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Provider Comparison Table */}
      <div>
        <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white mb-4">Provider Comparison</h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-aegis-bg-elevated text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">
            <span>Provider</span>
            <span className="text-right">USDT Rate</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Speed</span>
            <span className="text-right">Score</span>
          </div>
          {['Yellow Card', 'MoonPay', 'Transak', 'Binance P2P'].map((provider, index) => (
            <div
              key={provider}
              className={`grid grid-cols-5 gap-4 px-4 py-3 items-center ${index < 3 ? 'border-b border-border' : ''}`}
            >
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{provider}</span>
              <span className="text-sm text-aegis-primary-dark dark:text-white text-right">
                ₦{(1595.20 + (index === 0 ? 0 : index === 1 ? -2.5 : index === 2 ? -3 : -1)).toFixed(2)}
              </span>
              <span className="text-sm text-aegis-secondary-dark text-right">
                {index === 0 ? '1.5%' : index === 1 ? '4.99%' : index === 2 ? '3.99%' : '0.1%'}
              </span>
              <span className="text-sm text-aegis-secondary-dark text-right">
                {index === 0 ? '2-5 min' : index === 1 ? '5-10 min' : index === 2 ? '3-7 min' : '10-30 min'}
              </span>
              <div className="flex items-center justify-end gap-1">
                <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">
                  {index === 0 ? '5.0' : index === 1 ? '4.8' : index === 2 ? '4.5' : '4.9'}
                </span>
                <ArrowUpRight size={12} className="text-aegis-success-green" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
