import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, ChevronDown, Download, QrCode, Info } from 'lucide-react'
import { wallets } from '@/data/mockData'

export default function ReceiveMoney() {
  const [selectedWallet, setSelectedWallet] = useState(wallets[0])
  const [showDropdown, setShowDropdown] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark mb-6">Receive from any wallet or bank</p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        {/* Select Wallet */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
            Select Wallet
          </label>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${selectedWallet.color}15` }}
            >
              <span className="text-sm font-bold" style={{ color: selectedWallet.color }}>
                {selectedWallet.symbol.slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedWallet.symbol} ({selectedWallet.chain})</p>
            </div>
            <ChevronDown size={16} className="text-aegis-tertiary-dark" />
          </button>

          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
            >
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => {
                    setSelectedWallet(wallet)
                    setShowDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${wallet.color}15` }}
                  >
                    <span className="text-xs font-bold" style={{ color: wallet.color }}>
                      {wallet.symbol.slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm text-aegis-primary-dark dark:text-white">{wallet.symbol}</p>
                    <p className="text-xs text-aegis-tertiary-dark">{wallet.chain}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* QR Code */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col items-center">
            <div className="w-48 h-48 bg-white rounded-2xl p-4 flex items-center justify-center mb-4">
              {/* Generated QR code pattern */}
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <rect width="200" height="200" fill="white" />
                {/* QR Pattern - simplified representation */}
                <g fill="#080C10">
                  {/* Position patterns */}
                  <rect x="10" y="10" width="50" height="50" />
                  <rect x="13" y="13" width="44" height="44" fill="white" />
                  <rect x="18" y="18" width="34" height="34" />
                  <rect x="23" y="23" width="24" height="24" fill="white" />
                  <rect x="28" y="28" width="14" height="14" />

                  <rect x="140" y="10" width="50" height="50" />
                  <rect x="143" y="13" width="44" height="44" fill="white" />
                  <rect x="148" y="18" width="34" height="34" />
                  <rect x="153" y="23" width="24" height="24" fill="white" />
                  <rect x="158" y="28" width="14" height="14" />

                  <rect x="10" y="140" width="50" height="50" />
                  <rect x="13" y="143" width="44" height="44" fill="white" />
                  <rect x="18" y="148" width="34" height="34" />
                  <rect x="23" y="153" width="24" height="24" fill="white" />
                  <rect x="28" y="158" width="14" height="14" />

                  {/* Data modules - random pattern */}
                  {Array.from({ length: 25 }).map((_, i) =>
                    Array.from({ length: 25 }).map((_, j) => {
                      const x = 70 + i * 5
                      const y = 70 + j * 5
                      if ((i * 7 + j * 13) % 3 === 0 && x < 135 && y < 135) {
                        return <rect key={`${i}-${j}`} x={x} y={y} width="5" height="5" />
                      }
                      return null
                    })
                  )}

                  {/* Small timing patterns */}
                  <rect x="65" y="10" width="5" height="5" />
                  <rect x="75" y="10" width="5" height="5" />
                  <rect x="85" y="10" width="5" height="5" />
                  <rect x="95" y="10" width="5" height="5" />
                  <rect x="105" y="10" width="5" height="5" />
                  <rect x="115" y="10" width="5" height="5" />
                  <rect x="125" y="10" width="5" height="5" />

                  <rect x="10" y="65" width="5" height="5" />
                  <rect x="10" y="75" width="5" height="5" />
                  <rect x="10" y="85" width="5" height="5" />
                  <rect x="10" y="95" width="5" height="5" />
                  <rect x="10" y="105" width="5" height="5" />
                  <rect x="10" y="115" width="5" height="5" />
                  <rect x="10" y="125" width="5" height="5" />

                  {/* Additional data */}
                  <rect x="70" y="65" width="5" height="5" />
                  <rect x="80" y="75" width="5" height="5" />
                  <rect x="90" y="85" width="5" height="5" />
                  <rect x="100" y="65" width="5" height="5" />
                  <rect x="110" y="75" width="5" height="5" />
                  <rect x="120" y="85" width="5" height="5" />
                  <rect x="130" y="65" width="5" height="5" />
                  <rect x="70" y="100" width="5" height="5" />
                  <rect x="85" y="110" width="5" height="5" />
                  <rect x="100" y="120" width="5" height="5" />
                  <rect x="115" y="100" width="5" height="5" />
                  <rect x="125" y="115" width="5" height="5" />
                  <rect x="130" y="130" width="5" height="5" />

                  {/* Corner elements */}
                  <rect x="145" y="145" width="5" height="5" />
                  <rect x="155" y="155" width="5" height="5" />
                  <rect x="165" y="145" width="5" height="5" />
                  <rect x="175" y="165" width="5" height="5" />
                  <rect x="185" y="155" width="5" height="5" />
                  <rect x="145" y="175" width="5" height="5" />
                  <rect x="165" y="185" width="5" height="5" />
                  <rect x="185" y="185" width="5" height="5" />
                  <rect x="155" y="170" width="5" height="5" />
                  <rect x="175" y="145" width="5" height="5" />
                </g>
                {/* AEGIS logo center */}
                <rect x="80" y="80" width="40" height="40" rx="4" fill="white" />
                <text x="100" y="107" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#5B3CF5">A</text>
              </svg>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-aegis-bg-elevated rounded-lg mb-4">
              <QrCode size={14} className="text-aegis-accent-purple" />
              <span className="text-xs text-aegis-secondary-dark">Scan to send {selectedWallet.symbol}</span>
            </div>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
            Your Wallet Address
          </label>
          <div className="flex items-center gap-2 p-3 bg-aegis-bg-elevated rounded-lg">
            <code className="flex-1 text-xs text-aegis-primary-dark dark:text-white font-mono truncate">
              {selectedWallet.address}
            </code>
            <button
              onClick={() => handleCopy(selectedWallet.address)}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-card transition-colors flex-shrink-0"
            >
              {copiedAddress ? <Check size={16} className="text-aegis-success-green" /> : <Copy size={16} className="text-aegis-tertiary-dark" />}
            </button>
          </div>
        </div>

        {/* Share Options */}
        <div className="flex gap-3">
          <button
            onClick={() => handleCopy(selectedWallet.address)}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-medium text-aegis-primary-dark dark:text-white hover:bg-aegis-bg-elevated transition-colors"
          >
            <Copy size={16} /> Copy
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-medium text-aegis-primary-dark dark:text-white hover:bg-aegis-bg-elevated transition-colors">
            <Download size={16} /> Download
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Info size={16} className="text-aegis-accent-blue flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Send only {selectedWallet.symbol} to this address. Sending any other token may result in permanent loss.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
