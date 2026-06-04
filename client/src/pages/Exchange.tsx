/**
 * Exchange.tsx — Swap between tokens using live wallet balances from useWalletStore
 */
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpDown, ChevronDown, Info, RefreshCw } from 'lucide-react'
import { useWalletStore } from '@/hooks/useWalletStore'
import { useRates } from '@/hooks/useRates'

// Token colours by symbol
const TOKEN_COLORS: Record<string, string> = {
  USDT: '#5B3CF5', USDC: '#3B5BDB', BTC: '#F7931A',
  ETH: '#627EEA', BNB: '#F3BA2F', MATIC: '#8247E5',
}

type TokenOption = { symbol: string; balance: number; color: string; address: string }

export default function Exchange() {
  const { wallets } = useWalletStore()
  const { prices } = useRates()

  // Build unique token list from connected wallets (dedup by symbol)
  const tokens: TokenOption[] = useMemo(() => {
    const seen = new Set<string>()
    const out: TokenOption[] = []
    for (const w of wallets) {
      if (!seen.has(w.symbol)) {
        seen.add(w.symbol)
        out.push({ symbol: w.symbol, balance: w.balance, color: TOKEN_COLORS[w.symbol] ?? '#5B3CF5', address: w.address })
      }
    }
    // Fallback if no wallets connected yet
    if (out.length === 0) {
      return [
        { symbol: 'USDT', balance: 0, color: '#5B3CF5', address: '' },
        { symbol: 'USDC', balance: 0, color: '#3B5BDB', address: '' },
        { symbol: 'BTC',  balance: 0, color: '#F7931A', address: '' },
        { symbol: 'ETH',  balance: 0, color: '#627EEA', address: '' },
        { symbol: 'BNB',  balance: 0, color: '#F3BA2F', address: '' },
      ]
    }
    return out
  }, [wallets])

  const [fromIdx, setFromIdx] = useState(0)
  const [toIdx, setToIdx]     = useState(Math.min(1, tokens.length - 1))
  const [fromAmount, setFromAmount] = useState('')
  const [showFromDrop, setShowFromDrop] = useState(false)
  const [showToDrop, setShowToDrop]     = useState(false)
  const [slippage, setSlippage]         = useState(0.5)

  const fromToken = tokens[fromIdx] ?? tokens[0]
  const toToken   = tokens[toIdx]   ?? tokens[1] ?? tokens[0]

  // Derive rate from live CoinGecko prices (USD→USD)
  const getPriceUsd = (symbol: string): number => {
    const key = Object.keys(prices).find(k => k.toUpperCase().endsWith(':' + symbol))
    return (prices[key as string] as number) ?? 1
  }
  const fromUsd = getPriceUsd(fromToken?.symbol ?? 'USDT')
  const toUsd   = getPriceUsd(toToken?.symbol   ?? 'USDC')
  const rate    = toUsd > 0 ? fromUsd / toUsd : 0
  const toAmount = fromAmount ? (parseFloat(fromAmount) * rate).toFixed(6) : ''
  const minimumReceived = toAmount ? (parseFloat(toAmount) * (1 - slippage / 100)).toFixed(6) : '0'

  const handleSwap = () => {
    const tmp = fromIdx; setFromIdx(toIdx); setToIdx(tmp)
    setFromAmount(toAmount)
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark mb-6">Swap between cryptocurrencies</p>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

        {/* From */}
        <div className="bg-card border border-border rounded-xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">You Pay</label>
            <span className="text-xs text-aegis-secondary-dark">
              Balance: {fromToken?.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {fromToken?.symbol}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={fromAmount}
              onChange={e => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"
            />
            <button
              onClick={() => setShowFromDrop(!showFromDrop)}
              className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated rounded-xl hover:bg-aegis-bg-elevated/80 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${fromToken?.color}20` }}>
                <span className="text-xs font-bold" style={{ color: fromToken?.color }}>{fromToken?.symbol?.slice(0, 2)}</span>
              </div>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{fromToken?.symbol}</span>
              <ChevronDown size={14} className="text-aegis-tertiary-dark" />
            </button>
          </div>
          {showFromDrop && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="absolute right-5 top-full mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-20 min-w-[140px]">
              {tokens.map((t, i) => (
                <button key={t.symbol} onClick={() => { setFromIdx(i); setShowFromDrop(false) }}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors ${i === fromIdx ? 'bg-aegis-bg-elevated' : ''}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${t.color}20` }}>
                    <span className="text-xs font-bold" style={{ color: t.color }}>{t.symbol.slice(0, 2)}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-aegis-primary-dark dark:text-white">{t.symbol}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{t.balance.toFixed(4)}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Swap arrow */}
        <div className="flex justify-center -my-2 relative z-10">
          <button onClick={handleSwap}
            className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center shadow-glow hover:scale-105 transition-transform">
            <ArrowUpDown size={18} className="text-white" />
          </button>
        </div>

        {/* To */}
        <div className="bg-card border border-border rounded-xl p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">You Receive</label>
            <span className="text-xs text-aegis-secondary-dark">
              Balance: {toToken?.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {toToken?.symbol}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input type="text" value={toAmount} readOnly placeholder="0.00"
              className="flex-1 text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none" />
            <button onClick={() => setShowToDrop(!showToDrop)}
              className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated rounded-xl hover:bg-aegis-bg-elevated/80 transition-colors">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${toToken?.color}20` }}>
                <span className="text-xs font-bold" style={{ color: toToken?.color }}>{toToken?.symbol?.slice(0, 2)}</span>
              </div>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{toToken?.symbol}</span>
              <ChevronDown size={14} className="text-aegis-tertiary-dark" />
            </button>
          </div>
          {showToDrop && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="absolute right-5 top-full mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-20 min-w-[140px]">
              {tokens.map((t, i) => (
                <button key={t.symbol} onClick={() => { setToIdx(i); setShowToDrop(false) }}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors ${i === toIdx ? 'bg-aegis-bg-elevated' : ''}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${t.color}20` }}>
                    <span className="text-xs font-bold" style={{ color: t.color }}>{t.symbol.slice(0, 2)}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-aegis-primary-dark dark:text-white">{t.symbol}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{t.balance.toFixed(4)}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Rate info */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Rate</span>
            <span className="text-aegis-primary-dark dark:text-white font-medium">
              1 {fromToken?.symbol} = {rate > 0 ? rate.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '…'} {toToken?.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {[0.5, 1, 2].map(s => (
                <button key={s} onClick={() => setSlippage(s)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${slippage === s ? 'gradient-brand text-white' : 'bg-aegis-bg-elevated text-aegis-secondary-dark'}`}>
                  {s}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Minimum Received</span>
            <span className="text-aegis-primary-dark dark:text-white font-medium">{minimumReceived} {toToken?.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-aegis-secondary-dark">Price source</span>
            <div className="flex items-center gap-1 text-aegis-success-green">
              <RefreshCw size={11} />
              <span className="text-xs font-medium">Live · CoinGecko</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info size={16} className="text-aegis-accent-blue flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Price may vary due to market conditions. Your transaction will revert if the price changes unfavorably by more than {slippage}%.
          </p>
        </div>

        {wallets.length === 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl text-center">
            <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium">No wallets connected</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Connect a wallet on the Wallets page to see your live balances here.</p>
          </div>
        )}

        <button
          className="w-full py-3.5 gradient-brand text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-glow disabled:opacity-50"
          disabled={!fromAmount || parseFloat(fromAmount) <= 0}
          onClick={() => alert('Exchange feature coming soon — DEX aggregator integration in progress.')}
        >
          Preview Exchange
        </button>
      </motion.div>
    </div>
  )
}
