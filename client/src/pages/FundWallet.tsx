import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown, CreditCard, Moon, ArrowLeftRight,
  Users, Star, Check, Clock, Zap
} from 'lucide-react'
import { wallets, providers, africanCountries } from '@/data/mockData'

const providerIcons: Record<string, React.ElementType> = {
  CreditCard, Moon, ArrowLeftRight, Users,
}

export default function FundWallet() {
  const [selectedToken, setSelectedToken] = useState(wallets[0])
  const [selectedChain, setSelectedChain] = useState('BEP20')
  const [amount, setAmount] = useState('50000')
  const [selectedCurrency, setSelectedCurrency] = useState(africanCountries[0])
  const [showTokenDropdown, setShowTokenDropdown] = useState(false)
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)

  const chains = ['BEP20', 'ERC20', 'Bitcoin', 'TRC20']

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark mb-6">Add funds to your wallet</p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        {/* Select Currency */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
            Select Currency
          </label>
          <button
            onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
          >
            <span className="text-2xl">{selectedCurrency.flag}</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedCurrency.currency}</p>
              <p className="text-xs text-aegis-tertiary-dark">{selectedCurrency.name}</p>
            </div>
            <ChevronDown size={16} className="text-aegis-tertiary-dark" />
          </button>

          {showCurrencyDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
            >
              {africanCountries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => {
                    setSelectedCurrency(country)
                    setShowCurrencyDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors"
                >
                  <span className="text-xl">{country.flag}</span>
                  <p className="text-sm text-aegis-primary-dark dark:text-white">{country.currency}</p>
                  <p className="text-xs text-aegis-tertiary-dark ml-auto">{country.name}</p>
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Select Token */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
            Select Token
          </label>
          <button
            onClick={() => setShowTokenDropdown(!showTokenDropdown)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${selectedToken.color}15` }}
            >
              <span className="text-sm font-bold" style={{ color: selectedToken.color }}>
                {selectedToken.symbol.slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selectedToken.symbol} ({selectedToken.chain})</p>
            </div>
            <ChevronDown size={16} className="text-aegis-tertiary-dark" />
          </button>

          {showTokenDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
            >
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => {
                    setSelectedToken(wallet)
                    setShowTokenDropdown(false)
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
              placeholder="0"
              className="flex-1 text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"
            />
            <span className="text-lg font-medium text-aegis-primary-dark dark:text-white">{selectedCurrency.currency}</span>
          </div>
          {amount && (
            <p className="text-sm text-aegis-secondary-dark mt-2">
              ≈ {(parseFloat(amount) / 1595.20).toFixed(2)} {selectedToken.symbol}
            </p>
          )}
        </div>

        {/* Chain Selector */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
            Select Chain
          </label>
          <div className="flex flex-wrap gap-2">
            {chains.map((chain) => (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedChain === chain
                    ? 'gradient-brand text-white'
                    : 'bg-aegis-bg-elevated text-aegis-secondary-dark hover:text-aegis-primary-dark dark:hover:text-white'
                }`}
              >
                {chain}
              </button>
            ))}
          </div>
        </div>

        {/* Provider Comparison */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Compare Providers</h3>
            <span className="text-xs text-aegis-tertiary-dark">Sorted by best rate</span>
          </div>

          <div className="space-y-3">
            {providers.map((provider, index) => {
              const Icon = providerIcons[provider.logo] || CreditCard
              const isSelected = selectedProvider === provider.id

              return (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`relative bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-aegis-accent-purple shadow-glow'
                      : provider.isRecommended
                      ? 'border-aegis-accent-purple/40'
                      : 'border-border'
                  }`}
                >
                  {provider.isRecommended && (
                    <div className="absolute -top-2.5 right-4">
                      <span className="text-[10px] bg-aegis-success-green text-white px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Zap size={10} /> Best Rate
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
                      <Icon size={20} className="text-aegis-accent-purple" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{provider.name}</p>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={10}
                              className={i < provider.trustScore ? 'text-yellow-400 fill-yellow-400' : 'text-aegis-tertiary-dark'}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                        <div>
                          <p className="text-[10px] text-aegis-tertiary-dark">You receive</p>
                          <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                            {provider.estimatedReceive} {selectedToken.symbol}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-aegis-tertiary-dark">Fee</p>
                          <p className="text-sm text-aegis-secondary-dark">{provider.fees}%</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={12} className="text-aegis-tertiary-dark" />
                          <p className="text-xs text-aegis-secondary-dark">{provider.eta}</p>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={() => alert('Proceeding to payment... This is a demo.')}
          className="w-full py-3.5 gradient-brand text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-glow"
        >
          Continue to Payment
        </button>
      </motion.div>
    </div>
  )
}
