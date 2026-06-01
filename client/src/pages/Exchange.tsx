import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpDown, ChevronDown, Info } from 'lucide-react'
import { wallets } from '@/data/mockData'

export default function Exchange() {
  const [fromToken, setFromToken] = useState(wallets[0])
  const [toToken, setToToken] = useState(wallets[2])
  const [fromAmount, setFromAmount] = useState('100')
  const [showFromDropdown, setShowFromDropdown] = useState(false)
  const [showToDropdown, setShowToDropdown] = useState(false)
  const [slippage, setSlippage] = useState(0.5)

  const exchangeRate = 0.0000284 // Mock USDT to BTC rate
  const toAmount = fromAmount ? (parseFloat(fromAmount) * exchangeRate).toFixed(8) : '0'
  const minimumReceived = toAmount ? (parseFloat(toAmount) * (1 - slippage / 100)).toFixed(8) : '0'

  const handleSwap = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark mb-6">Swap between cryptocurrencies</p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* From */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">You Pay</label>
            <span className="text-xs text-aegis-secondary-dark">Balance: {fromToken.balance} {fromToken.symbol}</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1 text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"
            />
            <button
              onClick={() => setShowFromDropdown(!showFromDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated rounded-xl hover:bg-aegis-bg-elevated/80 transition-colors"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${fromToken.color}15` }}
              >
                <span className="text-xs font-bold" style={{ color: fromToken.color }}>
                  {fromToken.symbol.slice(0, 2)}
                </span>
              </div>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{fromToken.symbol}</span>
              <ChevronDown size={14} className="text-aegis-tertiary-dark" />
            </button>
          </div>
          {showFromDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
            >
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { setFromToken(w); setShowFromDropdown(false) }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${w.color}15` }}>
                    <span className="text-xs font-bold" style={{ color: w.color }}>{w.symbol.slice(0, 2)}</span>
                  </div>
                  <p className="text-sm text-aegis-primary-dark dark:text-white">{w.symbol}</p>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwap}
            className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center shadow-glow hover:scale-105 transition-transform"
          >
            <ArrowUpDown size={18} className="text-white" />
          </button>
        </div>

        {/* To */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">You Receive</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={toAmount}
              readOnly
              className="flex-1 text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white focus:outline-none"
            />
            <button
              onClick={() => setShowToDropdown(!showToDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated rounded-xl hover:bg-aegis-bg-elevated/80 transition-colors"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${toToken.color}15` }}
              >
                <span className="text-xs font-bold" style={{ color: toToken.color }}>
                  {toToken.symbol.slice(0, 2)}
                </span>
              </div>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{toToken.symbol}</span>
              <ChevronDown size={14} className="text-aegis-tertiary-dark" />
            </button>
          </div>
          {showToDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
            >
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { setToToken(w); setShowToDropdown(false) }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${w.color}15` }}>
                    <span className="text-xs font-bold" style={{ color: w.color }}>{w.symbol.slice(0, 2)}</span>
                  </div>
                  <p className="text-sm text-aegis-primary-dark dark:text-white">{w.symbol}</p>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Rate Info */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Rate</span>
            <span className="text-aegis-primary-dark dark:text-white font-medium">1 {fromToken.symbol} = {exchangeRate} {toToken.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    slippage === s
                      ? 'gradient-brand text-white'
                      : 'bg-aegis-bg-elevated text-aegis-secondary-dark'
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Minimum Received</span>
            <span className="text-aegis-primary-dark dark:text-white font-medium">{minimumReceived} {toToken.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Network Fee</span>
            <span className="text-aegis-primary-dark dark:text-white font-medium">~0.50 {fromToken.symbol}</span>
          </div>
        </div>

        {/* Slippage Warning */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info size={16} className="text-aegis-accent-blue flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Price may vary due to market conditions. Your transaction will revert if the price changes unfavorably by more than {slippage}%.
          </p>
        </div>

        <button
          onClick={() => alert('Exchange initiated! This is a demo.')}
          className="w-full py-3.5 gradient-brand text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-glow"
        >
          Preview Exchange
        </button>
      </motion.div>
    </div>
  )
}
