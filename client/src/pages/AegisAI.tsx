import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Route, Shield, TrendingUp, AlertTriangle,
  Info, Zap, Brain, Activity, BarChart3
} from 'lucide-react'
import { aegisInsights } from '@/data/mockData'

const insightIcons: Record<string, React.ElementType> = {
  routing: Route,
  risk: AlertTriangle,
  liquidity: BarChart3,
  suggestion: TrendingUp,
  alert: Shield,
}

const insightColors: Record<string, { bg: string; icon: string }> = {
  routing: { bg: 'bg-green-50 dark:bg-green-900/20', icon: 'text-aegis-success-green' },
  risk: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-500' },
  liquidity: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-aegis-accent-blue' },
  suggestion: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-aegis-accent-purple' },
  alert: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: 'text-yellow-600' },
}

export default function AegisAI() {
  const [typedText, setTypedText] = useState('')
  const fullText = 'Hello David! I\'m Aegis AI, your intelligent routing assistant. I analyze market conditions, liquidity pools, and network congestion in real-time to optimize your transfers and minimize costs. Here\'s what I found today:'

  useEffect(() => {
    let index = 0
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index))
        index++
      } else {
        clearInterval(timer)
      }
    }, 30)
    return () => clearInterval(timer)
  }, [])

  const [cursorVisible, setCursorVisible] = useState(true)
  useEffect(() => {
    const timer = setInterval(() => setCursorVisible((v) => !v), 530)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark">Your intelligent financial assistant</p>

      {/* AI Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#5B3CF5] via-[#6B4CF5] to-[#3B5BDB] rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden"
      >
        {/* Background grid */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="ai-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ai-grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <Brain size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-semibold">Aegis AI Assistant</h2>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">BETA</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">
              {typedText}
              <span className={`inline-block w-[2px] h-4 bg-white ml-0.5 align-middle transition-opacity ${cursorVisible ? 'opacity-100' : 'opacity-0'}`} />
            </p>
          </div>
        </div>
      </motion.div>

      {/* AI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Routes Analyzed', value: '1,247', icon: Route, color: '#5B3CF5' },
          { label: 'Avg. Savings', value: '12.3%', icon: TrendingUp, color: '#03CD69' },
          { label: 'Risk Alerts', value: '3 Active', icon: Shield, color: '#F7931A' },
          { label: 'AI Confidence', value: '98.7%', icon: Activity, color: '#3B5BDB' },
        ].map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${metric.color}15` }}>
                <metric.icon size={16} style={{ color: metric.color }} />
              </div>
            </div>
            <p className="text-xl font-semibold text-aegis-primary-dark dark:text-white">{metric.value}</p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">{metric.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Insights */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">AI Insights</h3>
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-aegis-success-green" />
            <span className="text-xs text-aegis-success-green">Live</span>
          </div>
        </div>

        <div className="space-y-3">
          {aegisInsights.map((insight, index) => {
            const Icon = insightIcons[insight.type] || Info
            const colors = insightColors[insight.type]

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={colors.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{insight.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        insight.severity === 'success'
                          ? 'bg-green-50 dark:bg-green-900/20 text-aegis-success-green'
                          : insight.severity === 'warning'
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-aegis-accent-blue'
                      }`}>
                        {insight.severity}
                      </span>
                    </div>
                    <p className="text-sm text-aegis-secondary-dark leading-relaxed">{insight.description}</p>
                    <p className="text-xs text-aegis-tertiary-dark mt-2">{insight.timestamp}</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Smart Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.button
          whileHover={{ y: -2 }}
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:shadow-md transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
            <Zap size={18} className="text-aegis-accent-purple" />
          </div>
          <div>
            <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Optimize All Routes</p>
            <p className="text-xs text-aegis-tertiary-dark">Find best paths for pending transfers</p>
          </div>
        </motion.button>
        <motion.button
          whileHover={{ y: -2 }}
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:shadow-md transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <BarChart3 size={18} className="text-aegis-accent-blue" />
          </div>
          <div>
            <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Market Analysis</p>
            <p className="text-xs text-aegis-tertiary-dark">View detailed market insights</p>
          </div>
        </motion.button>
      </div>
    </div>
  )
}
