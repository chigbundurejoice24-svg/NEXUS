import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Send, ChevronDown, Clock, Zap, Route,
  AlertCircle
} from 'lucide-react'
import { wallets, africanCountries } from '@/data/mockData'

export default function SendMoney() {
  const [amount, setAmount] = useState('')
  const [selectedWallet, setSelectedWallet] = useState(wallets[0])
  const [recipientAddress, setRecipientAddress] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(africanCountries[0])
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [transferType, setTransferType] = useState<'wallet' | 'bank'>('wallet')

  const estimatedFee = amount ? parseFloat(amount) * 0.005 : 0
  const estimatedReceive = amount ? parseFloat(amount) - estimatedFee : 0

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark mb-6">Send to any wallet or bank account</p>

      {!showReview ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Transfer Type Toggle */}
          <div className="bg-aegis-bg-elevated rounded-xl p-1 flex">
            <button
              onClick={() => setTransferType('wallet')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                transferType === 'wallet'
                  ? 'bg-white dark:bg-card shadow-sm text-aegis-primary-dark dark:text-white'
                  : 'text-aegis-secondary-dark'
              }`}
            >
              Crypto Wallet
            </button>
            <button
              onClick={() => setTransferType('bank')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                transferType === 'bank'
                  ? 'bg-white dark:bg-card shadow-sm text-aegis-primary-dark dark:text-white'
                  : 'text-aegis-secondary-dark'
              }`}
            >
              Bank Account
            </button>
          </div>

          {/* From Wallet */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
              From Wallet
            </label>
            <button
              onClick={() => setShowWalletDropdown(!showWalletDropdown)}
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
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedWallet.symbol}</p>
                <p className="text-xs text-aegis-tertiary-dark">{selectedWallet.chain}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-aegis-primary-dark dark:text-white">{selectedWallet.balance} {selectedWallet.symbol}</p>
              </div>
              <ChevronDown size={16} className="text-aegis-tertiary-dark" />
            </button>

            {showWalletDropdown && (
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
                      setShowWalletDropdown(false)
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
                    <p className="text-sm text-aegis-secondary-dark">{wallet.balance}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Recipient */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
              {transferType === 'wallet' ? 'Recipient Wallet Address' : 'Bank Account'}
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder={transferType === 'wallet' ? 'Enter wallet address or select beneficiary' : 'Enter account number'}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30 focus:border-aegis-accent-purple transition-all"
            />
          </div>

          {/* Destination Country */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
              Destination Country
            </label>
            <button
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
            >
              <span className="text-xl">{selectedCountry.flag}</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedCountry.name}</p>
                <p className="text-xs text-aegis-tertiary-dark">{selectedCountry.currency}</p>
              </div>
              <ChevronDown size={16} className="text-aegis-tertiary-dark" />
            </button>

            {showCountryDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
              >
                {africanCountries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => {
                      setSelectedCountry(country)
                      setShowCountryDropdown(false)
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors"
                  >
                    <span className="text-xl">{country.flag}</span>
                    <p className="text-sm text-aegis-primary-dark dark:text-white">{country.name}</p>
                    <p className="text-xs text-aegis-tertiary-dark ml-auto">{country.currency}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Amount */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
              Amount
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"
              />
              <div className="flex items-center gap-2 px-3 py-2 bg-aegis-bg-elevated rounded-lg">
                <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedWallet.symbol}</span>
                <ChevronDown size={14} className="text-aegis-tertiary-dark" />
              </div>
            </div>
            {amount && (
              <p className="text-sm text-aegis-secondary-dark mt-2">
                ≈ ₦{(parseFloat(amount) * 1595.20).toLocaleString('en-US', { minimumFractionDigits: 2 })} NGN
              </p>
            )}
          </div>

          {/* Route Optimization */}
          {amount && parseFloat(amount) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-aegis-success-green/10 flex items-center justify-center flex-shrink-0">
                  <Route size={16} className="text-aegis-success-green" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Best Route Found</p>
                    <span className="text-[10px] bg-aegis-success-green text-white px-2 py-0.5 rounded-full font-medium">Recommended</span>
                  </div>
                  <p className="text-xs text-aegis-secondary-dark mt-1">
                    BEP20 network via Yellow Card offers the lowest fees and fastest settlement for {selectedCountry.name}.
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-aegis-success-green" />
                      <span className="text-xs text-aegis-secondary-dark">2-5 min</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap size={12} className="text-aegis-success-green" />
                      <span className="text-xs text-aegis-secondary-dark">Fee: {estimatedFee.toFixed(2)} {selectedWallet.symbol}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-aegis-secondary-dark">You send</span>
                <span className="font-medium text-aegis-primary-dark dark:text-white">{amount} {selectedWallet.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-aegis-secondary-dark">Fee</span>
                <span className="font-medium text-aegis-primary-dark dark:text-white">{estimatedFee.toFixed(2)} {selectedWallet.symbol}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">Recipient gets</span>
                <span className="text-sm font-semibold text-aegis-success-green">{estimatedReceive.toFixed(2)} {selectedWallet.symbol}</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={() => amount && parseFloat(amount) > 0 && setShowReview(true)}
            disabled={!amount || parseFloat(amount) <= 0 || !recipientAddress}
            className="w-full py-3.5 gradient-brand text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-glow"
          >
            Review Transfer
          </button>
        </motion.div>
      ) : (
        /* Review Screen */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="w-16 h-16 rounded-full gradient-brand flex items-center justify-center mx-auto mb-4">
              <Send size={28} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-aegis-primary-dark dark:text-white">Review Transfer</h3>
            <p className="text-sm text-aegis-secondary-dark mt-1">Please confirm the details below</p>
          </div>

          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            <div className="flex justify-between p-4">
              <span className="text-sm text-aegis-secondary-dark">From</span>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedWallet.symbol} ({selectedWallet.chain})</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm text-aegis-secondary-dark">To</span>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white truncate max-w-[200px]">{recipientAddress}</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm text-aegis-secondary-dark">Destination</span>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedCountry.flag} {selectedCountry.name}</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm text-aegis-secondary-dark">Amount</span>
              <span className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{amount} {selectedWallet.symbol}</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm text-aegis-secondary-dark">Fee</span>
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">{estimatedFee.toFixed(2)} {selectedWallet.symbol}</span>
            </div>
            <div className="flex justify-between p-4">
              <span className="text-sm font-medium text-aegis-primary-dark dark:text-white">Total</span>
              <span className="text-sm font-semibold text-aegis-success-green">{(parseFloat(amount) + estimatedFee).toFixed(2)} {selectedWallet.symbol}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Please double-check the recipient address. Crypto transactions cannot be reversed once confirmed.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowReview(false)}
              className="flex-1 py-3.5 border border-border rounded-xl font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => alert('Transfer initiated! This is a demo.')}
              className="flex-1 py-3.5 gradient-brand text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-glow"
            >
              Confirm Transfer
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
