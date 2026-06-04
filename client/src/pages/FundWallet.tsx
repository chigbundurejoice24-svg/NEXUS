/**
 * FundWallet.tsx — Wired to trpc.ramps.onrampAll for live provider URLs
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Star, Check, Clock, ExternalLink,
  Wallet, Loader2, AlertCircle, RefreshCw, Copy, CheckCheck,
} from 'lucide-react';
// African countries — inline (no mockData dependency)
const africanCountries = [
  { name: 'Nigeria',      code: 'NG', currency: 'NGN', flag: '🇳🇬' },
  { name: 'Ghana',        code: 'GH', currency: 'GHS', flag: '🇬🇭' },
  { name: 'Kenya',        code: 'KE', currency: 'KES', flag: '🇰🇪' },
  { name: 'South Africa', code: 'ZA', currency: 'ZAR', flag: '🇿🇦' },
  { name: 'Uganda',       code: 'UG', currency: 'UGX', flag: '🇺🇬' },
  { name: 'Tanzania',     code: 'TZ', currency: 'TZS', flag: '🇹🇿' },
  { name: 'Rwanda',       code: 'RW', currency: 'RWF', flag: '🇷🇼' },
  { name: 'Senegal',      code: 'SN', currency: 'XOF', flag: '🇸🇳' },
  { name: 'Côte d Ivoire',code: 'CI', currency: 'XOF', flag: '🇨🇮' },
  { name: 'Ethiopia',     code: 'ET', currency: 'ETB', flag: '🇪🇹' },
];
import { useNgnRate } from '@/hooks/useNgnRate';
import { trpc, getToken } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';

export default function FundWallet() {
  const { rate } = useNgnRate();
  const [amount, setAmount]                 = useState('50000');
  const [selectedCurrency, setCurrency]     = useState(africanCountries[0]);
  const [showDrop, setShowDrop]             = useState(false);
  const [selectedProvider, setProvider]     = useState<string>('transak');
  const [launching, setLaunching]           = useState(false);
  const [copied, setCopied]                 = useState(false);

  const hasToken  = !!getToken();
  const fiatNum   = parseFloat(amount) || 0;
  const usdtEst   = rate > 0 ? (fiatNum / rate).toFixed(2) : '—';

  // Wallet address from backend
  const { data: wallets, isLoading: walletLoading } = (trpc as any).accounts.myWallets.useQuery(
    undefined, { enabled: hasToken, retry: false }
  );
  const embeddedWallet = wallets?.find((w: any) => w.type === 'EMBEDDED');
  const walletAddress: string | null = embeddedWallet?.address ?? null;

  // Live provider URLs from backend
  const { data: providers, isLoading: providersLoading, refetch } = (trpc as any).ramps.onrampAll.useQuery(
    { fiatAmount: fiatNum || 50000, fiatCurrency: selectedCurrency.currency, cryptoCurrency: 'USDT' },
    { enabled: hasToken && fiatNum > 0 }
  );

  const selected = (providers ?? []).find((p: any) => p.id === selectedProvider) ?? providers?.[0];

  const handleLaunch = () => {
    if (!selected?.url) return;
    setLaunching(true);
    window.open(selected.url, '_blank', 'width=420,height=680,noopener,noreferrer');
    setTimeout(() => setLaunching(false), 1500);
  };

  const copyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 lg:pb-0">
      <p className="text-sm text-aegis-secondary-dark mb-6">Add funds — sent directly on-chain, no middleman.</p>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

        {/* Wallet Address Banner */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-aegis-accent-purple" />
            <span className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">Your Deposit Address (BSC · USDT)</span>
          </div>
          {walletLoading ? <Skeleton className="h-6 w-full mt-2" /> : walletAddress ? (
            <div className="flex items-center justify-between mt-2">
              <code className="text-sm font-mono text-aegis-primary-dark dark:text-white break-all flex-1">{walletAddress}</code>
              <button onClick={copyAddress} className="ml-3 p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors shrink-0">
                {copied ? <CheckCheck size={14} className="text-aegis-success-green" /> : <Copy size={14} className="text-aegis-tertiary-dark" />}
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1.5"><AlertCircle size={12} /> Log in to see your deposit address</p>
          )}
          <p className="text-[10px] text-aegis-tertiary-dark mt-2">The provider sends USDT directly here. Aegis never touches your funds.</p>
        </div>

        {/* Amount + Currency */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">Pay With</p>
          <div className="relative">
            <button onClick={() => setShowDrop(!showDrop)}
              className="w-full flex items-center justify-between px-4 py-3 border border-border rounded-xl bg-aegis-bg-elevated hover:border-aegis-accent-purple transition-all text-sm">
              <span className="flex items-center gap-2">
                <span className="text-xl">{selectedCurrency.flag}</span>
                <span className="font-medium">{selectedCurrency.name}</span>
                <span className="text-aegis-tertiary-dark">({selectedCurrency.currency})</span>
              </span>
              <ChevronDown size={14} className={`text-aegis-tertiary-dark transition-transform ${showDrop ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showDrop && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="absolute z-20 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                  {africanCountries.map(c => (
                    <button key={c.currency} onClick={() => { setCurrency(c); setShowDrop(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-aegis-bg-elevated transition-colors ${c.currency === selectedCurrency.currency ? 'bg-aegis-bg-elevated' : ''}`}>
                      <span className="text-xl">{c.flag}</span><span className="flex-1 text-left">{c.name}</span>
                      <span className="text-aegis-tertiary-dark text-xs">{c.currency}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-1.5">Amount</p>
            <div className="flex items-center border border-border rounded-xl overflow-hidden">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} onBlur={() => refetch()}
                className="flex-1 px-4 py-3 text-lg font-semibold bg-aegis-bg-elevated focus:outline-none"
                placeholder="50000" min="100" />
              <span className="px-4 text-sm font-medium text-aegis-secondary-dark border-l border-border bg-card py-3">{selectedCurrency.currency}</span>
            </div>
            <p className="text-xs text-aegis-tertiary-dark mt-1.5">≈ {usdtEst} USDT</p>
          </div>
        </div>

        {/* Providers */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider">Choose Provider</p>
            <p className="text-[10px] text-aegis-tertiary-dark">KYC handled by provider</p>
          </div>

          {!hasToken ? (
            <div className="text-center py-4 text-sm text-aegis-tertiary-dark">Log in to see live provider options</div>
          ) : providersLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-3">
              {(providers ?? []).map((p: any) => (
                <button key={p.id} onClick={() => setProvider(p.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all relative ${selectedProvider === p.id ? 'border-aegis-accent-purple bg-purple-50 dark:bg-purple-900/10' : 'border-border hover:border-aegis-accent-purple/40'}`}>
                  {p.recommended && (
                    <span className="absolute top-2 right-2 text-[9px] bg-aegis-success-green text-white px-1.5 py-0.5 rounded-full font-medium">Best Rate</span>
                  )}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: p.color + '22' }}>
                    <span className="text-xs font-bold" style={{ color: p.color }}>{p.provider[0]}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{p.provider}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-aegis-tertiary-dark flex items-center gap-1"><Clock size={10}/>{p.time}</span>
                      <span className="text-xs text-aegis-tertiary-dark">Fee: {p.fee}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-aegis-tertiary-dark">≈ {p.estimatedCrypto} USDT</p>
                    {selectedProvider === p.id && <Check size={16} className="text-aegis-accent-purple ml-auto mt-1" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <button onClick={handleLaunch} disabled={!walletAddress || !selected || launching}
          className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-aegis-accent-purple to-aegis-accent-blue text-white rounded-xl font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-50 shadow-glow">
          {launching ? <Loader2 size={18} className="animate-spin" /> : <ExternalLink size={18} />}
          {launching ? 'Opening…' : `Continue with ${selected?.provider ?? 'Provider'}`}
        </button>
        <p className="text-center text-xs text-aegis-tertiary-dark">You'll be redirected to the provider's secure page</p>
      </motion.div>
    </div>
  );
}
