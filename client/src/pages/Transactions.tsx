import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Download, PlusCircle, ArrowLeftRight, Search,
  Filter, ChevronDown, Wallet
} from 'lucide-react'
import { transactions } from '@/data/mockData'
import type { Transaction } from '@/types'

const filterOptions = ['All', 'Send', 'Receive', 'Fund', 'Exchange']
const statusOptions = ['All', 'Completed', 'Pending', 'Failed']

export default function Transactions() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeStatus, setActiveStatus] = useState('All')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  const filtered = transactions.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === 'All' || tx.type === activeFilter.toLowerCase()
    const matchesStatus = activeStatus === 'All' || tx.status === activeStatus.toLowerCase()
    return matchesSearch && matchesFilter && matchesStatus
  })

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark">View all your transactions</p>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30 focus:border-aegis-accent-purple transition-all"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors"
          >
            <Filter size={16} />
            {activeStatus}
            <ChevronDown size={14} />
          </button>
          {showStatusDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10 min-w-[150px]"
            >
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setActiveStatus(status)
                    setShowStatusDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-aegis-bg-elevated transition-colors ${
                    activeStatus === status ? 'text-aegis-accent-purple font-medium' : 'text-aegis-primary-dark dark:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeFilter === filter
                ? 'gradient-brand text-white'
                : 'bg-aegis-bg-elevated text-aegis-secondary-dark hover:text-aegis-primary-dark dark:hover:text-white'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <AnimatePresence mode="popLayout">
          {filtered.map((tx, index) => (
            <motion.div
              key={tx.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-aegis-bg-elevated/50 transition-colors ${
                index < filtered.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <TransactionIcon transaction={tx} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white truncate">
                  {tx.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-aegis-tertiary-dark">
                    {new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {tx.provider && (
                    <>
                      <span className="text-aegis-tertiary-dark">•</span>
                      <span className="text-xs text-aegis-tertiary-dark">{tx.provider}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-medium ${
                  tx.type === 'receive' ? 'text-aegis-success-green' : 'text-aegis-primary-dark dark:text-white'
                }`}>
                  {tx.type === 'receive' ? '+' : tx.type === 'send' ? '-' : ''}{tx.amount} {tx.symbol}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  tx.status === 'completed'
                    ? 'bg-green-50 dark:bg-green-900/20 text-aegis-success-green'
                    : tx.status === 'pending'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                }`}>
                  {tx.status}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-aegis-tertiary-dark">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TransactionIcon({ transaction }: { transaction: Transaction }) {
  const iconClass = "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"

  switch (transaction.type) {
    case 'send':
      return (
        <div className={`${iconClass} bg-red-50 dark:bg-red-900/20`}>
          <Send size={18} className="text-red-500" />
        </div>
      )
    case 'receive':
      return (
        <div className={`${iconClass} bg-green-50 dark:bg-green-900/20`}>
          <Download size={18} className="text-aegis-success-green" />
        </div>
      )
    case 'fund':
      return (
        <div className={`${iconClass} bg-purple-50 dark:bg-purple-900/20`}>
          <PlusCircle size={18} className="text-aegis-accent-purple" />
        </div>
      )
    case 'exchange':
      return (
        <div className={`${iconClass} bg-blue-50 dark:bg-blue-900/20`}>
          <ArrowLeftRight size={18} className="text-aegis-accent-blue" />
        </div>
      )
    default:
      return (
        <div className={`${iconClass} bg-gray-50 dark:bg-gray-800`}>
          <Wallet size={18} className="text-aegis-secondary-dark" />
        </div>
      )
  }
}
