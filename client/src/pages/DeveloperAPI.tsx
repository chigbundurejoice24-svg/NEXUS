/**
 * DeveloperAPI.tsx — Developer section
 * Watchlist button now links to /rates
 */
import { motion } from 'framer-motion'
import { Code, BookOpen, Terminal, Key, ArrowRight, Copy, Check, Star } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useAuth'

export default function DeveloperAPI() {
  const [copied, setCopied] = useState(false)
  const [joined, setJoined] = useState(() => !!localStorage.getItem("aegis_waitlist"))
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const mockApiKey = user
    ? `aegis_live_sk_${btoa(String(user.id ?? "")).replace(/=/g,"").slice(0,28)}`
    : 'aegis_live_sk_••••••••••••••••••••••••'

  function handleCopy() {
    navigator.clipboard.writeText(mockApiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleJoinWaitlist() {
    localStorage.setItem("aegis_waitlist", "1")
    setJoined(true)
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0 space-y-6">
      {/* Coming Soon Banner */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
        className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
        <Terminal size={16} className="text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Coming Soon — Private Beta</p>
          <p className="text-xs text-amber-700 dark:text-amber-500">Our Developer API is currently in private beta. Join the waitlist for early access.</p>
        </div>
      </motion.div>

      {/* Hero */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
        className="bg-gradient-to-br from-[#080C10] to-[#1a1f2e] rounded-2xl p-6 sm:p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%"><defs><pattern id="cg" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern></defs><rect width="100%" height="100%" fill="url(#cg)"/></svg>
        </div>
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-[#5B3CF5]/20 flex items-center justify-center mb-4">
            <Code size={28} className="text-[#5B3CF5]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold mb-2">AEGIS Developer API</h2>
          <p className="text-white/60 max-w-lg text-sm">Build powerful financial applications with our institutional-grade API. Access wallets, transfers, exchange rates, and more.</p>
          <div className="flex flex-wrap gap-3 mt-6">
            {joined ? (
              <div className="px-5 py-2.5 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium flex items-center gap-2">
                <Check size={14}/> You're on the waitlist!
              </div>
            ) : (
              <button onClick={handleJoinWaitlist}
                className="px-5 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                Join Waitlist <ArrowRight size={14}/>
              </button>
            )}
            {/* FIXED: Watchlist button goes to /rates */}
            <button onClick={() => navigate("/rates")}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2">
              <Star size={14}/> View Watchlist
            </button>
          </div>
        </div>
      </motion.div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: Terminal, title: "RESTful API",         desc: "Clean resource-oriented URLs with JSON responses." },
          { icon: Key,      title: "Secure Auth",         desc: "API key authentication with HMAC-SHA256 signing." },
          { icon: BookOpen, title: "Comprehensive Docs",  desc: "Code examples in JavaScript, Python, and cURL." },
          { icon: Code,     title: "Webhooks",            desc: "Real-time event notifications for all transactions." },
        ].map((f, i) => (
          <motion.div key={f.title} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
            className="bg-card border border-border rounded-xl p-5">
            <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center mb-3">
              <f.icon size={20} className="text-[#5B3CF5]"/>
            </div>
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-1">{f.title}</h3>
            <p className="text-xs text-aegis-secondary-dark">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Terminal preview */}
      <div>
        <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white mb-3">API Preview</h3>
        <div className="bg-[#080C10] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#111318] border-b border-white/5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"/>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"/>
            <div className="w-3 h-3 rounded-full bg-green-500/80"/>
            <span className="text-xs text-white/40 ml-2">bash</span>
          </div>
          <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto">
            <p className="text-white/40"># Get wallet balance</p>
            <p><span className="text-[#5B3CF5]">curl</span><span className="text-white/70"> https://api.aegis.cozanet.net/v1/wallets </span><span className="text-yellow-400">\</span></p>
            <p className="ml-4"><span className="text-[#5B3CF5]">-H</span><span className="text-green-400"> "Authorization: Bearer YOUR_API_KEY"</span></p>
            <p className="mt-3 text-white/40"># Response</p>
            <p className="text-white/70">{"{"}</p>
            <p className="ml-4 text-white/70"><span className="text-blue-400">"balance"</span>: <span className="text-orange-400">1250.50</span>,</p>
            <p className="ml-4 text-white/70"><span className="text-blue-400">"currency"</span>: <span className="text-green-400">"USDT"</span>,</p>
            <p className="ml-4 text-white/70"><span className="text-blue-400">"chain"</span>: <span className="text-green-400">"BEP20"</span></p>
            <p className="text-white/70">{"}"}</p>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Key size={18} className="text-[#5B3CF5]"/>
          <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">API Keys</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">Beta Access Required</span>
        </div>
        <p className="text-xs text-aegis-secondary-dark mb-3">Your API keys will appear here once you have access.</p>
        <div className="flex items-center gap-2 p-3 bg-aegis-bg-elevated rounded-lg">
          <code className="flex-1 text-xs text-aegis-tertiary-dark font-mono truncate">{mockApiKey}</code>
          <button onClick={handleCopy} className="p-1.5 rounded hover:bg-card transition-colors flex-shrink-0">
            {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14} className="text-aegis-tertiary-dark"/>}
          </button>
        </div>
      </div>
    </div>
  )
}
