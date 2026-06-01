import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Plus, Link2, Send, Download, ChevronRight } from 'lucide-react'
import { wallets } from '@/data/mockData'
import { useNavigate } from 'react-router-dom'

export default function Wallets() {
  const navigate = useNavigate()
  const [showBalances, setShowBalances] = useState(true)
  const totalFiat = wallets.reduce((sum, w) => sum + w.fiatValue, 0)

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-aegis-secondary-dark">Manage all your wallets in one place</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors"
          >
            {showBalances ? <EyeOff size={16} /> : <Eye size={16} />}
            {showBalances ? 'Hide' : 'Show'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-glow">
            <Plus size={16} /> Add / Connect Wallet
          </button>
        </div>
      </div>

      {/* Total Balance */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-1">Total Portfolio Value</p>
        <h2 className="text-3xl font-semibold text-aegis-primary-dark dark:text-white">
          {showBalances ? `₦${totalFiat.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
        </h2>
        <p className="text-sm text-aegis-secondary-dark mt-1">
          {wallets.length} wallets connected
        </p>
      </div>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {wallets.map((wallet, index) => (
          <motion.div
            key={wallet.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
            className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all shimmer"
          >
            {/* Gradient Header */}
            <div className="h-1.5" style={{ background: wallet.gradient }} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${wallet.color}15` }}
                  >
                    <span className="text-sm font-bold" style={{ color: wallet.color }}>
                      {wallet.symbol.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{wallet.symbol}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{wallet.chain}</p>
                  </div>
                </div>
                <button className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors">
                  <Link2 size={14} className="text-aegis-tertiary-dark" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-2xl font-semibold text-aegis-primary-dark dark:text-white">
                  {showBalances ? `${wallet.balance.toLocaleString('en-US', { minimumFractionDigits: wallet.symbol === 'BTC' || wallet.symbol === 'ETH' ? 4 : 2 })} ${wallet.symbol}` : '****'}
                </p>
                <p className="text-sm text-aegis-secondary-dark mt-0.5">
                  {showBalances ? `≈ ₦${wallet.fiatValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                </p>
              </div>

              {/* Address */}
              <div className="flex items-center gap-2 p-2 bg-aegis-bg-elevated rounded-lg mb-4">
                <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{wallet.address}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/send')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white"
                >
                  <Send size={14} /> Send
                </button>
                <button
                  onClick={() => navigate('/receive')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white"
                >
                  <Download size={14} /> Receive
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Add Wallet Card */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: wallets.length * 0.05 }}
          whileHover={{ y: -4 }}
          className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 p-8 hover:border-aegis-accent-purple/40 hover:bg-aegis-accent-purple/5 transition-all min-h-[250px]"
        >
          <div className="w-12 h-12 rounded-full bg-aegis-bg-elevated flex items-center justify-center">
            <Plus size={24} className="text-aegis-accent-purple" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Add / Connect Wallet</p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">Connect another wallet to view balance</p>
          </div>
        </motion.button>
      </div>

      {/* Connected External Wallets */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Connected External Wallets</h3>
          <button className="text-xs text-aegis-accent-purple hover:text-aegis-accent-purple-dark transition-colors flex items-center gap-1">
            View Hidden Wallets <ChevronRight size={12} />
          </button>
        </div>
        <div className="flex items-center gap-3 p-3 bg-aegis-bg-elevated rounded-lg">
          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <span className="text-xs font-bold text-orange-500">MW</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">MetaMask Wallet</p>
            <p className="text-xs text-aegis-tertiary-dark">0x7A2b...C99D • Connected</p>
          </div>
          <span className="text-xs text-aegis-success-green bg-aegis-success-green/10 px-2 py-0.5 rounded-full">Active</span>
        </div>
      </div>
    </div>
  )
}
