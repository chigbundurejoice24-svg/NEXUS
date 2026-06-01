import { motion } from 'framer-motion'
import {
  Shield, Check, Calendar, Receipt, TrendingUp,
  Wallet, Award, ArrowRight, Globe, MapPin
} from 'lucide-react'
import { userProfile, transactions, wallets } from '@/data/mockData'

export default function Profile() {
  const completedTxs = transactions.filter((t) => t.status === 'completed')
  const totalVolume = completedTxs.reduce((sum, t) => sum + t.fiatValue, 0)

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0 space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-20 h-20 rounded-full object-cover border-3 border-aegis-accent-purple/20"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gradient-brand flex items-center justify-center border-2 border-white dark:border-card">
              <Check size={14} className="text-white" />
            </div>
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">{userProfile.name}</h2>
            <p className="text-sm text-aegis-secondary-dark">{userProfile.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <span className="flex items-center gap-1 text-[10px] bg-aegis-success-green/10 text-aegis-success-green px-2.5 py-1 rounded-full font-medium">
                <Shield size={10} /> {userProfile.verificationStatus}
              </span>
              <span className="flex items-center gap-1 text-[10px] bg-purple-50 dark:bg-purple-900/20 text-aegis-accent-purple px-2.5 py-1 rounded-full font-medium">
                <Award size={10} /> {userProfile.level}
              </span>
              <span className="flex items-center gap-1 text-[10px] bg-aegis-bg-elevated text-aegis-tertiary-dark px-2.5 py-1 rounded-full font-medium">
                <MapPin size={10} /> {userProfile.country}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 bg-aegis-bg-elevated rounded-xl p-3 min-w-[80px]">
            <span className="text-xs text-aegis-tertiary-dark">Level</span>
            <span className="text-lg font-semibold text-aegis-primary-dark dark:text-white">{userProfile.level}</span>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-aegis-tertiary-dark">XP Progress</span>
            <span className="text-xs text-aegis-tertiary-dark">{userProfile.xp} / {userProfile.maxXp}</span>
          </div>
          <div className="h-2 bg-aegis-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full gradient-brand rounded-full"
              style={{ width: `${(userProfile.xp / userProfile.maxXp) * 100}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Member Since', value: userProfile.memberSince, icon: Calendar },
          { label: 'Total Transactions', value: `${userProfile.totalTransactions}`, icon: Receipt },
          { label: 'Total Volume', value: `₦${(totalVolume / 1e6).toFixed(1)}M`, icon: TrendingUp },
          { label: 'Wallets', value: `${wallets.length} Connected`, icon: Wallet },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <stat.icon size={16} className="text-aegis-accent-purple mb-2" />
            <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{stat.value}</p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Connected Accounts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-3">Connected Accounts</h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Wallet size={16} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">MetaMask</p>
              <p className="text-xs text-aegis-tertiary-dark">0x7A2b...C99D</p>
            </div>
            <span className="text-[10px] bg-aegis-success-green/10 text-aegis-success-green px-2 py-0.5 rounded-full font-medium">Active</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Globe size={16} className="text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Bank Account</p>
              <p className="text-xs text-aegis-tertiary-dark">**** **** **** 4521</p>
            </div>
            <span className="text-[10px] bg-aegis-success-green/10 text-aegis-success-green px-2 py-0.5 rounded-full font-medium">Verified</span>
          </div>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Recent Activity</h3>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {transactions.slice(0, 3).map((tx, index) => (
            <div
              key={tx.id}
              className={`flex items-center gap-3 px-4 py-3 ${index < 2 ? 'border-b border-border' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                tx.type === 'receive' ? 'bg-green-50 dark:bg-green-900/20' :
                tx.type === 'send' ? 'bg-red-50 dark:bg-red-900/20' :
                'bg-purple-50 dark:bg-purple-900/20'
              }`}>
                {tx.type === 'receive' ? <TrendingUp size={14} className="text-aegis-success-green" /> :
                 tx.type === 'send' ? <ArrowRight size={14} className="text-red-500" /> :
                 <Wallet size={14} className="text-aegis-accent-purple" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-aegis-primary-dark dark:text-white">{tx.description}</p>
                <p className="text-xs text-aegis-tertiary-dark">
                  {new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className={`text-sm font-medium ${
                tx.type === 'receive' ? 'text-aegis-success-green' : 'text-aegis-primary-dark dark:text-white'
              }`}>
                {tx.type === 'receive' ? '+' : '-'}{tx.amount} {tx.symbol}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
