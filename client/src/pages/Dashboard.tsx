import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Send, Download, PlusCircle, ArrowLeftRight, Eye, EyeOff,
  TrendingUp, ChevronRight, Wallet
} from 'lucide-react'
import { wallets, transactions, quickActions, exchangeRates, userProfile } from '@/data/mockData'
import type { Transaction } from '@/types'
import { useState } from 'react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [showBalance, setShowBalance] = useState(true)
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0)
  const totalFiat = wallets.reduce((sum, w) => sum + w.fiatValue, 0)
  const usdtRate = exchangeRates.find(r => r.from === 'USDT' && r.to === 'NGN')

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-aegis-secondary-dark">
            Welcome back, {userProfile.name.split(' ')[0]}! 👋
          </h2>
          <p className="text-sm text-aegis-tertiary-dark mt-0.5">
            Move value across Africa instantly
          </p>
        </div>
      </div>

      {/* Hero Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#5B3CF5] via-[#6B4CF5] to-[#3B5BDB] p-6 sm:p-8 text-white"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Left - Balance */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Total Balance</span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                {showBalance ? `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
              </h3>
              <p className="text-sm text-white/70 mt-1">
                ≈ ₦{totalFiat.toLocaleString('en-US', { minimumFractionDigits: 2 })} NGN
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/fund')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <PlusCircle size={16} /> Add Funds
              </button>
              <button
                onClick={() => navigate('/send')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <Send size={16} /> Send Money
              </button>
              <button
                onClick={() => navigate('/receive')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <Download size={16} /> Receive Money
              </button>
            </div>
          </div>

          {/* Right - Rate */}
          <div className="glass-panel rounded-xl p-4 text-white min-w-[200px]">
            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Today&apos;s Rate</span>
            <div className="mt-2">
              <p className="text-xs text-white/60">1 USDT =</p>
              <p className="text-2xl font-semibold">₦{usdtRate?.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp size={12} className="text-green-300" />
                <span className="text-xs text-green-300">+{usdtRate?.change24h}%</span>
                <span className="text-xs text-white/40 ml-1">Updated just now</span>
              </div>
            </div>
            {/* Mini sparkline */}
            <svg className="w-full h-10 mt-2" viewBox="0 0 200 40">
              <path
                d="M0,30 Q20,25 40,28 T80,20 T120,22 T160,15 T200,10"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
              <path
                d="M0,30 Q20,25 40,28 T80,20 T120,22 T160,15 T200,10 L200,40 L0,40 Z"
                fill="rgba(255,255,255,0.05)"
              />
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map((action, index) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => navigate(action.href)}
            whileHover={{ y: -4 }}
            className="group p-4 sm:p-5 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all text-left"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:-translate-y-1"
              style={{ background: action.gradient }}
            >
              {action.icon === 'Send' && <Send size={18} className="text-white" />}
              {action.icon === 'Download' && <Download size={18} className="text-white" />}
              {action.icon === 'PlusCircle' && <PlusCircle size={18} className="text-white" />}
              {action.icon === 'ArrowLeftRight' && <ArrowLeftRight size={18} className="text-white" />}
            </div>
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{action.title}</h3>
            <p className="text-xs text-aegis-secondary-dark mt-0.5">{action.description}</p>
          </motion.button>
        ))}
      </div>

      {/* My Wallets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">My Wallets</h3>
          <button
            onClick={() => navigate('/wallets')}
            className="text-sm text-aegis-accent-purple hover:text-aegis-accent-purple-dark transition-colors flex items-center gap-1"
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {wallets.slice(0, 4).map((wallet, index) => (
            <motion.div
              key={wallet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              {/* Gradient Header */}
              <div className="h-2" style={{ background: wallet.gradient }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: `${wallet.color}15` }}
                  >
                    <span className="text-xs font-bold" style={{ color: wallet.color }}>
                      {wallet.symbol.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{wallet.name}</p>
                    <p className="text-[10px] text-aegis-tertiary-dark">{wallet.chain}</p>
                  </div>
                </div>

                <p className="text-lg font-semibold text-aegis-primary-dark dark:text-white">
                  {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: wallet.symbol === 'BTC' || wallet.symbol === 'ETH' ? 4 : 2 })} {wallet.symbol}
                </p>
                <p className="text-xs text-aegis-secondary-dark mt-0.5">
                  ≈ ₦{wallet.fiatValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => navigate('/send')}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => navigate('/receive')}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white"
                  >
                    Receive
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">Recent Transactions</h3>
          <button
            onClick={() => navigate('/transactions')}
            className="text-sm text-aegis-accent-purple hover:text-aegis-accent-purple-dark transition-colors flex items-center gap-1"
          >
            View all transactions <ChevronRight size={14} />
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {transactions.slice(0, 4).map((tx, index) => (
            <TransactionRow key={tx.id} transaction={tx} isLast={index === 3} />
          ))}
        </div>
      </div>

      {/* Transfer Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#F0EDFF] to-[#E8F0FE] dark:from-[#1a1533] dark:to-[#0f1a2e] rounded-2xl p-6 sm:p-8"
      >
        <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white mb-1">
          Transfer anywhere in Africa
        </h3>
        <p className="text-sm text-aegis-secondary-dark mb-4">
          Fast, low-cost transfers to 20+ African countries
        </p>
        <div className="flex flex-wrap gap-3">
          {['Nigeria', 'Ghana', 'Kenya', 'South Africa'].map((country) => (
            <div
              key={country}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-white/10 rounded-full"
            >
              <span className="text-lg">
                {country === 'Nigeria' ? '🇳🇬' : country === 'Ghana' ? '🇬🇭' : country === 'Kenya' ? '🇰🇪' : '🇿🇦'}
              </span>
              <span className="text-xs font-medium text-aegis-primary-dark dark:text-white">{country}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function TransactionRow({ transaction, isLast }: { transaction: Transaction; isLast: boolean }) {
  const getIcon = () => {
    switch (transaction.type) {
      case 'send':
        return (
          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <Send size={16} className="text-red-500" />
          </div>
        )
      case 'receive':
        return (
          <div className="w-9 h-9 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <Download size={16} className="text-aegis-success-green" />
          </div>
        )
      case 'fund':
        return (
          <div className="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
            <PlusCircle size={16} className="text-aegis-accent-purple" />
          </div>
        )
      case 'exchange':
        return (
          <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <ArrowLeftRight size={16} className="text-aegis-accent-blue" />
          </div>
        )
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
            <Wallet size={16} className="text-aegis-secondary-dark" />
          </div>
        )
    }
  }

  const isPositive = transaction.type === 'receive'
  const amountPrefix = isPositive ? '+' : transaction.type === 'send' ? '-' : ''

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-aegis-bg-elevated/50 transition-colors ${!isLast ? 'border-b border-border' : ''}`}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-aegis-primary-dark dark:text-white truncate">
          {transaction.description}
        </p>
        <p className="text-xs text-aegis-tertiary-dark">
          {new Date(transaction.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${isPositive ? 'text-aegis-success-green' : 'text-aegis-primary-dark dark:text-white'}`}>
          {amountPrefix}{transaction.amount} {transaction.symbol}
        </p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          transaction.status === 'completed'
            ? 'bg-green-50 dark:bg-green-900/20 text-aegis-success-green'
            : transaction.status === 'pending'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600'
            : 'bg-red-50 dark:bg-red-900/20 text-red-500'
        }`}>
          {transaction.status}
        </span>
      </div>
    </div>
  )
}
