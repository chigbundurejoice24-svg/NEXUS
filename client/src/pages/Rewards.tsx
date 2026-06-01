import { motion } from 'framer-motion'
import {
  Trophy, Users, Star, Check, Lock,
  Zap, Target
} from 'lucide-react'
import { rewards, userProfile } from '@/data/mockData'

export default function Rewards() {
  const completedCount = rewards.filter((r) => r.completed).length
  const totalPoints = rewards.filter((r) => r.completed).reduce((sum, r) => sum + r.points, 0)

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark">Earn rewards as you use Aegis</p>

      {/* Points Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#5B3CF5] via-[#6B4CF5] to-[#3B5BDB] rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="reward-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#reward-grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-sm text-white/70 mb-1">Your Points</p>
            <h2 className="text-4xl font-semibold">{totalPoints.toLocaleString()}</h2>
            <p className="text-sm text-white/70 mt-2">
              {completedCount} of {rewards.length} tasks completed
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${(completedCount / rewards.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/70">{Math.round((completedCount / rewards.length) * 100)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <Trophy size={32} className="mx-auto mb-1 text-yellow-300" />
              <p className="text-xs text-white/70">Level {userProfile.level}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Referrals', value: '3', icon: Users, sub: '+150 pts' },
          { label: 'Streak', value: '7 days', icon: Zap, sub: 'Keep it up!' },
          { label: 'Tasks Done', value: `${completedCount}`, icon: Check, sub: 'Great progress' },
          { label: 'Next Reward', value: '250 pts', icon: Target, sub: '2 tasks away' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <stat.icon size={18} className="text-aegis-accent-purple mb-2" />
            <p className="text-lg font-semibold text-aegis-primary-dark dark:text-white">{stat.value}</p>
            <p className="text-xs text-aegis-tertiary-dark">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Referral Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-5"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
            <Users size={24} className="text-aegis-accent-purple" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Refer Friends, Earn Together</h3>
            <p className="text-xs text-aegis-secondary-dark mt-0.5">
              Earn 500 points for each friend who joins and completes their first transfer.
            </p>
          </div>
          <button className="px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-glow flex-shrink-0">
            Invite Friends
          </button>
        </div>
      </motion.div>

      {/* Tasks */}
      <div>
        <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white mb-4">Available Tasks</h3>
        <div className="space-y-3">
          {rewards.map((reward, index) => (
            <motion.div
              key={reward.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-4 p-4 bg-card border rounded-xl transition-all ${
                reward.completed ? 'border-aegis-success-green/30' : 'border-border'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                reward.completed
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-aegis-bg-elevated'
              }`}>
                {reward.completed ? (
                  <Check size={18} className="text-aegis-success-green" />
                ) : (
                  <Lock size={18} className="text-aegis-tertiary-dark" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${
                    reward.completed ? 'text-aegis-success-green line-through' : 'text-aegis-primary-dark dark:text-white'
                  }`}>
                    {reward.title}
                  </p>
                  <span className="text-[10px] bg-aegis-bg-elevated text-aegis-tertiary-dark px-2 py-0.5 rounded-full capitalize">
                    {reward.category}
                  </span>
                </div>
                <p className="text-xs text-aegis-secondary-dark mt-0.5">{reward.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star size={14} className={reward.completed ? 'text-aegis-success-green' : 'text-aegis-tertiary-dark'} />
                <span className={`text-sm font-medium ${
                  reward.completed ? 'text-aegis-success-green' : 'text-aegis-primary-dark dark:text-white'
                }`}>
                  +{reward.points}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Ecosystem Activity */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-4">Ecosystem Activity</h3>
        <div className="space-y-3">
          {[
            { action: 'Completed a transfer', points: 100, time: '2 hours ago' },
            { action: 'Funded wallet via Yellow Card', points: 50, time: '5 hours ago' },
            { action: 'Referred a friend', points: 500, time: '1 day ago' },
            { action: 'Daily check-in streak', points: 25, time: '1 day ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full gradient-brand" />
                <p className="text-sm text-aegis-primary-dark dark:text-white">{activity.action}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-aegis-success-green font-medium">+{activity.points}</span>
                <span className="text-xs text-aegis-tertiary-dark">{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
