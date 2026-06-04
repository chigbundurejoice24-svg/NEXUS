/**
 * Wallets.tsx — Wallet management page
 * - Shows embedded (auto-generated) Aegis wallet at top
 * - Shows all connected external wallets
 * - Live balance per wallet with loading indicator
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Plus, Send, Download, Wallet,
  Trash2, PencilLine, Check, X, Loader2, Shield, Copy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "@/hooks/useWalletStore";
import { useCurrentUser } from "@/hooks/useAuth";
import { useNgnRate } from "@/hooks/useNgnRate";

const NETWORK_LABELS: Record<string, string> = {
  ethereum: "Ethereum", bsc: "BNB Chain", polygon: "Polygon", arbitrum: "Arbitrum",
};
const NETWORK_COLORS: Record<string, string> = {
  ethereum: "bg-blue-500/20 text-blue-400",
  bsc:      "bg-yellow-500/20 text-yellow-400",
  polygon:  "bg-purple-500/20 text-purple-400",
  arbitrum: "bg-cyan-500/20 text-cyan-400",
};

export default function Wallets() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { wallets, totalUsd, add, remove, rename } = useWalletStore();
  const { rate: NGN_PER_USD } = useNgnRate();

  const [showBalances, setShowBalances] = useState(true);
  const [addingWallet, setAddingWallet] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editLabel, setEditLabel]       = useState("");
  const [copiedAddr, setCopiedAddr]     = useState<string | null>(null);

  const addressRef = useRef<HTMLInputElement>(null);
  const labelRef   = useRef<HTMLInputElement>(null);

  const embeddedAddress = (user as any)?.walletAddress as string | null ?? null;
  const totalNgn = totalUsd * NGN_PER_USD;

  function copyAddr(addr: string) {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  }

  function handleAdd() {
    setError(null);
    const address = addressRef.current?.value?.trim() ?? "";
    const label   = labelRef.current?.value?.trim() ?? "";
    if (!address) { setError("Please enter a wallet address"); return; }
    const err = add(address, label || "My Wallet");
    if (err) { setError(err); return; }
    setAddingWallet(false);
    if (addressRef.current) addressRef.current.value = "";
    if (labelRef.current)   labelRef.current.value   = "";
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-aegis-primary-dark dark:text-white">My Wallets</h2>
          <p className="text-sm text-aegis-secondary-dark">Manage all your wallets in one place</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBalances(!showBalances)}
            className="px-3 py-2 bg-card border border-border rounded-xl text-xs flex items-center gap-1.5 hover:bg-aegis-bg-elevated transition-colors text-aegis-secondary-dark">
            {showBalances ? <EyeOff size={13}/> : <Eye size={13}/>}
            {showBalances ? "Hide" : "Show"} Balances
          </button>
          <button onClick={() => { setAddingWallet(!addingWallet); setError(null); }}
            className="px-3 py-2 gradient-brand text-white rounded-xl text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity">
            <Plus size={13}/> Add Wallet
          </button>
        </div>
      </div>

      {/* Total Balance Card */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
        className="bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] rounded-2xl p-6 text-white">
        <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Total Portfolio Value</p>
        <h3 className="text-3xl font-semibold">
          {showBalances ? `$${totalUsd.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "••••••"}
        </h3>
        <p className="text-sm text-white/60 mt-1">
          {showBalances ? `≈ ₦${totalNgn.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "••••••"}
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={() => navigate("/send")}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium transition-colors">
            <Send size={14}/> Send
          </button>
          <button onClick={() => navigate("/receive")}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-medium transition-colors">
            <Download size={14}/> Receive
          </button>
        </div>
      </motion.div>

      {/* Add wallet form */}
      <AnimatePresence>
        {addingWallet && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
            className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
            <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Connect External Wallet</h3>
            <input ref={addressRef} placeholder="0x... wallet address"
              className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5B3CF5]/50 dark:text-white" />
            <input ref={labelRef} placeholder="Label (e.g. Hot Wallet)"
              className="w-full px-3 py-2.5 rounded-xl bg-aegis-bg-elevated border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[#5B3CF5]/50 dark:text-white" />
            {error && <p className="text-xs text-red-400 flex items-center gap-1"><X size={12}/>{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleAdd}
                className="flex-1 py-2.5 gradient-brand text-white rounded-xl text-sm font-semibold hover:opacity-90">
                Add Wallet
              </button>
              <button onClick={() => { setAddingWallet(false); setError(null); }}
                className="px-4 py-2.5 bg-aegis-bg-elevated border border-border text-aegis-secondary-dark rounded-xl text-sm hover:bg-card transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Embedded (Auto) Aegis Wallet ── */}
      {embeddedAddress && (
        <div>
          <p className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-2">Aegis Wallet</p>
          <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
            className="bg-gradient-to-r from-[#5B3CF5]/10 to-[#3B5BDB]/10 border border-[#5B3CF5]/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#5B3CF5]/20 flex items-center justify-center">
                <Shield size={18} className="text-[#5B3CF5]"/>
              </div>
              <div>
                <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">My Aegis Wallet</p>
                <p className="text-xs text-aegis-tertiary-dark">Auto-generated · BNB Chain</p>
              </div>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Active</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-black/10 dark:bg-white/5 rounded-xl">
              <p className="text-xs font-mono text-aegis-primary-dark dark:text-white flex-1 truncate">{embeddedAddress}</p>
              <button onClick={() => copyAddr(embeddedAddress)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                {copiedAddr === embeddedAddress ? <Check size={13} className="text-green-400"/> : <Copy size={13} className="text-aegis-tertiary-dark"/>}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── External wallets ── */}
      <div>
        <p className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-2">Connected Wallets</p>
        {wallets.length === 0 ? (
          <motion.button onClick={() => setAddingWallet(true)}
            className="w-full border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-[#5B3CF5]/40 transition-colors group">
            <div className="w-12 h-12 rounded-2xl bg-aegis-bg-elevated flex items-center justify-center group-hover:bg-[#5B3CF5]/10">
              <Plus size={22} className="text-aegis-tertiary-dark group-hover:text-[#5B3CF5]"/>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">No external wallets</p>
              <p className="text-xs text-aegis-tertiary-dark mt-0.5">Add a MetaMask, Trust Wallet, or any EVM address</p>
            </div>
          </motion.button>
        ) : (
          <div className="space-y-3">
            {wallets.map((w, i) => (
              <motion.div key={w.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-aegis-bg-elevated flex items-center justify-center">
                    <Wallet size={18} className="text-[#5B3CF5]"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === w.id ? (
                      <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter"){rename(w.id,editLabel);setEditingId(null);} if(e.key==="Escape")setEditingId(null); }}
                        className="text-sm font-semibold bg-transparent border-b border-[#5B3CF5] outline-none dark:text-white w-full" autoFocus />
                    ) : (
                      <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white truncate">{w.label}</p>
                    )}
                    <p className="text-xs font-mono text-aegis-tertiary-dark truncate">{w.address.slice(0,10)}...{w.address.slice(-6)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => copyAddr(w.address)} className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors">
                      {copiedAddr === w.address ? <Check size={14} className="text-green-400"/> : <Copy size={14} className="text-aegis-tertiary-dark"/>}
                    </button>
                    <button onClick={() => { setEditingId(w.id); setEditLabel(w.label); }} className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors">
                      <PencilLine size={14} className="text-aegis-tertiary-dark"/>
                    </button>
                    <button onClick={() => remove(w.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} className="text-red-400"/>
                    </button>
                  </div>
                </div>

                {/* Balance + assets */}
                {w.loading ? (
                  <div className="flex items-center gap-2 text-xs text-aegis-tertiary-dark">
                    <Loader2 size={12} className="animate-spin"/> Fetching balance...
                  </div>
                ) : w.error ? (
                  <p className="text-xs text-red-400">⚠ {w.error}</p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-lg font-semibold text-aegis-primary-dark dark:text-white">
                        {showBalances ? `$${w.balanceUsd.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "••••••"}
                      </p>
                      {w.assets.length === 0 && <p className="text-xs text-aegis-tertiary-dark">No assets found</p>}
                    </div>
                    {w.assets.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {w.assets.map((a, j) => (
                          <span key={j} className={`text-xs px-2 py-0.5 rounded-full font-medium ${NETWORK_COLORS[a.network] ?? "bg-gray-500/20 text-gray-400"}`}>
                            {showBalances ? `${a.balance} ${a.symbol}` : `•• ${a.symbol}`} · {NETWORK_LABELS[a.network] ?? a.network}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
