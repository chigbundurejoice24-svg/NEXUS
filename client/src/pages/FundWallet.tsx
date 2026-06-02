import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, CreditCard, Zap, Star, Check,
  Clock, ExternalLink, Wallet, Loader2, AlertCircle,
} from 'lucide-react';
import { africanCountries } from '@/data/mockData';
import { useNgnRate } from '@/hooks/useNgnRate';
import { openTransak, openMoonPay } from '@/hooks/useOnramp';
import { trpc } from '@/lib/trpc';
import { getToken } from '@/lib/trpc';

interface Provider {
  id: string;
  name: string;
  description: string;
  processingTime: string;
  rating: number;
  fee: string;
  isRecommended?: boolean;
  color: string;
  open: (wallet: string, fiat: string, amount: number, email?: string) => void;
}

const PROVIDERS: Provider[] = [
  {
    id: 'transak',
    name: 'Transak',
    description: 'Card, bank transfer, mobile money',
    processingTime: '5–10 min',
    rating: 4.8,
    fee: '1.5–2%',
    isRecommended: true,
    color: '#0070F3',
    open: (w, f, a, e) => openTransak({ walletAddress: w, fiatCurrency: f, defaultAmount: a, email: e }),
  },
  {
    id: 'moonpay',
    name: 'MoonPay',
    description: 'Card & bank transfer, 150+ countries',
    processingTime: '10–20 min',
    rating: 4.6,
    fee: '2.5–3.5%',
    color: '#7B2FBE',
    open: (w, f, a, e) => openMoonPay({ walletAddress: w, fiatCurrency: f, defaultAmount: a, email: e }),
  },
];

export default function FundWallet() {
  const { rate, loading: rateLoading } = useNgnRate();
  const [amount, setAmount] = useState('50000');
  const [selectedCurrency, setSelectedCurrency] = useState(africanCountries[0]);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>('transak');
  const [launching, setLaunching] = useState(false);

  // Fetch the logged-in user's wallet addresses
  const hasToken = !!getToken();
  const { data: wallets, isLoading: walletsLoading } = (trpc as any).accounts.myWallets.useQuery(
    undefined, { enabled: hasToken, retry: false }
  );

  // Pick the first EMBEDDED BSC wallet as the deposit address
  const embeddedWallet = wallets?.find(
    (w: any) => w.type === 'EMBEDDED' && (w.chainId === 56 || w.chainId === '56')
  );
  const walletAddress: string | null = embeddedWallet?.address ?? null;

  const fiatNum = parseFloat(amount) || 0;
  const usdtEstimate = rate > 0 ? (fiatNum / rate).toFixed(2) : '—';

  const handleLaunch = () => {
    if (!walletAddress) return;
    const provider = PROVIDERS.find(p => p.id === selectedProvider);
    if (!provider) return;
    setLaunching(true);
    try {
      provider.open(walletAddress, selectedCurrency.currency, fiatNum);
    } finally {
      setTimeout(() => setLaunching(false), 1500);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark mb-6">
        Add funds to your wallet — sent directly on-chain, no middleman.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        {/* Wallet Address Banner */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-aegis-accent-purple" />
            <span className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">
              Your Deposit Address (BSC · USDT)
            </span>
          </div>
          {walletsLoading ? (
            <div className="flex items-center gap-2 mt-1">
              <Loader2 size={14} className="animate-spin text-aegis-tertiary-dark" />
              <span className="text-xs text-aegis-tertiary-dark">Loading wallet…</span>
            </div>
          ) : walletAddress ? (
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="font-mono text-sm text-aegis-primary-dark dark:text-white break-all">
                {walletAddress}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(walletAddress)}
                className="text-[10px] px-2 py-1 bg-aegis-bg-elevated rounded-lg text-aegis-tertiary-dark hover:text-aegis-primary-dark transition-colors flex-shrink-0"
              >
                Copy
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <AlertCircle size={14} className="text-amber-500" />
              <p className="text-xs text-aegis-tertiary-dark">
                {hasToken ? 'No embedded wallet yet — register to get one automatically.' : 'Log in to see your wallet address.'}
              </p>
            </div>
          )}
          <p className="text-[11px] text-aegis-tertiary-dark mt-2">
            The provider sends USDT directly to this address. Aegis never touches your funds.
          </p>
        </div>

        {/* Currency */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
            Pay With
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
          <AnimatePresence>
            {showCurrencyDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                className="mt-2 border border-border rounded-lg overflow-hidden bg-card max-h-48 overflow-y-auto"
              >
                {africanCountries.map((c) => (
                  <button key={c.code} onClick={() => { setSelectedCurrency(c); setShowCurrencyDropdown(false); }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors">
                    <span className="text-xl">{c.flag}</span>
                    <p className="text-sm text-aegis-primary-dark dark:text-white">{c.currency}</p>
                    <p className="text-xs text-aegis-tertiary-dark ml-auto">{c.name}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Amount */}
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
            Amount
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
              className="flex-1 text-3xl font-semibold bg-transparent text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none"
            />
            <span className="text-lg font-medium text-aegis-primary-dark dark:text-white">
              {selectedCurrency.currency}
            </span>
          </div>
          {fiatNum > 0 && (
            <p className="text-sm text-aegis-secondary-dark mt-2">
              {rateLoading ? 'Fetching rate…' : `≈ ${usdtEstimate} USDT  (1 USD = ${selectedCurrency.currency} ${rate.toFixed(2)})`}
            </p>
          )}
        </div>

        {/* Providers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Choose Provider</h3>
            <span className="text-xs text-aegis-tertiary-dark">KYC handled by provider</span>
          </div>
          <div className="space-y-3">
            {PROVIDERS.map((provider, idx) => {
              const isSelected = selectedProvider === provider.id;
              return (
                <motion.div key={provider.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`relative bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-aegis-accent-purple shadow-glow' :
                    provider.isRecommended ? 'border-aegis-accent-purple/40' : 'border-border'
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
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: provider.color + '20' }}>
                      <CreditCard size={20} style={{ color: provider.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{provider.name}</p>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={10} className={i < Math.floor(provider.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                          ))}
                          <span className="text-[10px] text-aegis-tertiary-dark ml-1">{provider.rating}</span>
                        </div>
                      </div>
                      <p className="text-xs text-aegis-tertiary-dark">{provider.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-aegis-secondary-dark flex items-center gap-1">
                          <Clock size={10} /> {provider.processingTime}
                        </span>
                        <span className="text-xs text-aegis-secondary-dark">Fee: {provider.fee}</span>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="text-aegis-accent-purple flex-shrink-0 mt-1" />}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleLaunch}
          disabled={!walletAddress || !selectedProvider || fiatNum <= 0 || launching}
          className="w-full py-4 rounded-xl gradient-brand text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {launching ? (
            <><Loader2 size={18} className="animate-spin" /> Launching…</>
          ) : (
            <><ExternalLink size={18} /> Continue with {PROVIDERS.find(p => p.id === selectedProvider)?.name ?? 'Provider'}</>
          )}
        </motion.button>

        {/* Disclaimer */}
        <p className="text-center text-[11px] text-aegis-tertiary-dark pb-4">
          Aegis never holds your funds. USDT is sent directly to your wallet address.
          KYC is handled securely by the selected provider.
        </p>
      </motion.div>
    </div>
  );
}
