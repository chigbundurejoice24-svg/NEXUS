import { motion } from 'framer-motion'
import { Code, BookOpen, Terminal, Key, ArrowRight, Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function DeveloperAPI() {
  const [copied, setCopied] = useState(false)
  const mockApiKey = 'aegis_live_sk_2vJ8mKpQ9xYzAbC3dEfGhIjKlMnOpQr'

  const handleCopy = () => {
    navigator.clipboard.writeText(mockApiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0 space-y-6">
      {/* Coming Soon Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3"
      >
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <Terminal size={16} className="text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Coming Soon</p>
          <p className="text-xs text-amber-700 dark:text-amber-500">
            Our Developer API is currently in private beta. Join the waitlist to get early access.
          </p>
        </div>
      </motion.div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-[#080C10] to-[#1a1f2e] rounded-2xl p-6 sm:p-10 text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="code-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#code-grid)" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-aegis-accent-purple/20 flex items-center justify-center mb-4">
            <Code size={28} className="text-aegis-accent-purple" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold mb-2">AEGIS Developer API</h2>
          <p className="text-white/60 max-w-lg">
            Build powerful financial applications with our institutional-grade API. Access wallets, transfers, exchange rates, and more.
          </p>
          <button className="mt-6 px-5 py-2.5 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-glow inline-flex items-center gap-2">
            Join Waitlist <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            icon: Terminal,
            title: 'RESTful API',
            description: 'Clean, predictable resource-oriented URLs with JSON responses.',
          },
          {
            icon: Key,
            title: 'Secure Authentication',
            description: 'API key authentication with HMAC-SHA256 request signing.',
          },
          {
            icon: BookOpen,
            title: 'Comprehensive Docs',
            description: 'Detailed documentation with code examples in multiple languages.',
          },
          {
            icon: Code,
            title: 'Webhooks',
            description: 'Real-time event notifications for transactions and transfers.',
          },
        ].map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center mb-3">
              <feature.icon size={20} className="text-aegis-accent-purple" />
            </div>
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-1">{feature.title}</h3>
            <p className="text-xs text-aegis-secondary-dark">{feature.description}</p>
          </motion.div>
        ))}
      </div>

      {/* Mock API Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-3">API Preview</h3>
        <div className="bg-[#080C10] rounded-xl overflow-hidden">
          {/* Terminal Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#111318] border-b border-white/5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="text-xs text-white/40 ml-2">bash</span>
          </div>
          {/* Code */}
          <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto">
            <p className="text-white/40"># Get wallet balance</p>
            <p>
              <span className="text-aegis-accent-purple">curl</span>
              <span className="text-white/70"> https://api.aegis.co/v1/wallets </span>
              <span className="text-yellow-400">\</span>
            </p>
            <p className="ml-4">
              <span className="text-aegis-accent-purple">-H</span>
              <span className="text-green-400"> &quot;Authorization: Bearer </span>
              <span className="text-green-400/60">YOUR_API_KEY&quot;</span>
            </p>
            <p className="mt-3 text-white/40"># Response</p>
            <p className="text-white/70">{'{'}</p>
            <p className="ml-4 text-white/70">
              <span className="text-blue-400">&quot;balance&quot;</span>: <span className="text-orange-400">1250.50</span>,
            </p>
            <p className="ml-4 text-white/70">
              <span className="text-blue-400">&quot;currency&quot;</span>: <span className="text-green-400">&quot;USDT&quot;</span>,
            </p>
            <p className="ml-4 text-white/70">
              <span className="text-blue-400">&quot;chain&quot;</span>: <span className="text-green-400">&quot;BEP20&quot;</span>
            </p>
            <p className="text-white/70">{'}'}</p>
          </div>
        </div>
      </motion.div>

      {/* API Key Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <Key size={18} className="text-aegis-accent-purple" />
          <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">API Keys</h3>
        </div>
        <p className="text-xs text-aegis-secondary-dark mb-3">
          Your API keys will appear here once you have access.
        </p>
        <div className="flex items-center gap-2 p-3 bg-aegis-bg-elevated rounded-lg">
          <code className="flex-1 text-xs text-aegis-tertiary-dark font-mono truncate">{mockApiKey}</code>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white dark:hover:bg-card transition-colors flex-shrink-0"
          >
            {copied ? <Check size={14} className="text-aegis-success-green" /> : <Copy size={14} className="text-aegis-tertiary-dark" />}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
