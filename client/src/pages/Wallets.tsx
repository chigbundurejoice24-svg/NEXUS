import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Eye, EyeOff, Plus, Send, Download, Wallet,
  Trash2, PencilLine, Check, X, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "@/hooks/useWalletStore";

const NGN_PER_USD = 1595.20;

const NETWORK_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  bsc: "BNB Chain",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
};

export default function Wallets() {
  const navigate = useNavigate();
  const { wallets, totalUsd, totalNgn, add, remove, rename } = useWalletStore();

  const [showBalances, setShowBalances] = useState(true);
  const [addingWallet, setAddingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  // Use uncontrolled refs to avoid React state timing issues with input values
  const addressRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    setError(null);
    const address = addressRef.current?.value?.trim() ?? "";
    const label = labelRef.current?.value?.trim() ?? "";

    if (!address) {
      setError("Please enter a wallet address");
      return;
    }

    const err = add(address, label || "My Wallet");
    if (err) {
      setError(err);
      return;
    }

    // Success — close form and clear
    setAddingWallet(false);
    if (addressRef.current) addressRef.current.value = "";
    if (labelRef.current) labelRef.current.value = "";
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-aegis-secondary-dark">Manage all your wallets in one place</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors"
          >
            {showBalances ? <EyeOff size={16} /> : <Eye size={16} />}
            {showBalances ? "Hide" : "Show"}
          </button>
          <button
            onClick={() => { setAddingWallet(true); setError(null); }}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Connect Wallet
          </button>
        </div>
      </div>

      {/* Add wallet form — uncontrolled inputs via ref */}
      {addingWallet && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-aegis-accent-purple/40 rounded-xl p-5 space-y-3"
        >
          <h3 className="text-sm font-semibold text-aegis-primary-dark dark:text-white">Connect EVM Wallet</h3>
          <input
            ref={addressRef}
            type="text"
            defaultValue=""
            placeholder="0x... wallet address"
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm font-mono text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          <input
            ref={labelRef}
            type="text"
            defaultValue=""
            placeholder="Label (optional — e.g. Main Wallet)"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-aegis-bg-elevated text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Connect
            </button>
            <button
              onClick={() => { setAddingWallet(false); setError(null); }}
              className="px-4 py-2 border border-border rounded-lg text-sm text-aegis-secondary-dark hover:bg-aegis-bg-elevated"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Total balance */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-1">
          Total Portfolio Value
        </p>
        <h2 className="text-3xl font-semibold text-aegis-primary-dark dark:text-white">
          {showBalances
            ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : "••••••"}
        </h2>
        <p className="text-sm text-aegis-secondary-dark mt-1">
          {showBalances
            ? `≈ ₦${totalNgn.toLocaleString("en-US", { minimumFractionDigits: 2 })} NGN`
            : "••••••"}
        </p>
        <p className="text-sm text-aegis-tertiary-dark mt-1">
          {wallets.length} wallet{wallets.length !== 1 ? "s" : ""} connected
        </p>
      </div>

      {/* Wallet cards */}
      {wallets.length === 0 ? (
        <motion.button
          onClick={() => setAddingWallet(true)}
          whileHover={{ y: -4 }}
          className="w-full border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 p-10 hover:border-aegis-accent-purple/40 transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-aegis-bg-elevated flex items-center justify-center">
            <Plus size={24} className="text-aegis-accent-purple" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Connect Your First Wallet</p>
            <p className="text-xs text-aegis-tertiary-dark mt-0.5">Paste any EVM address to track its balance live</p>
          </div>
        </motion.button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {wallets.map((w, index) => {
            const isEditing = editingId === w.id;
            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <div className="h-1.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB]" />
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                        <Wallet size={18} className="text-aegis-accent-purple" />
                      </div>
                      <div className="min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="text-sm font-semibold bg-transparent border-b border-aegis-accent-purple focus:outline-none text-aegis-primary-dark dark:text-white w-28"
                            />
                            <button onClick={() => { rename(w.id, editLabel); setEditingId(null); }}>
                              <Check size={14} className="text-green-500" />
                            </button>
                            <button onClick={() => setEditingId(null)}>
                              <X size={14} className="text-red-400" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">{w.label}</p>
                        )}
                        <p className="text-xs text-aegis-tertiary-dark">All chains</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(w.id); setEditLabel(w.label); }}
                        className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors"
                      >
                        <PencilLine size={13} className="text-aegis-tertiary-dark" />
                      </button>
                      <button
                        onClick={() => remove(w.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="mb-3">
                    {w.loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-aegis-tertiary-dark" />
                        <span className="text-xs text-aegis-tertiary-dark">Fetching live balance...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-2xl font-semibold text-aegis-primary-dark dark:text-white">
                          {showBalances
                            ? `$${w.balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                            : "••••••"}
                        </p>
                        <p className="text-sm text-aegis-secondary-dark mt-0.5">
                          {showBalances
                            ? `≈ ₦${(w.balanceUsd * NGN_PER_USD).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                            : "••••••"}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-2 p-2 bg-aegis-bg-elevated rounded-lg mb-3">
                    <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{w.address}</p>
                  </div>

                  {/* Asset breakdown */}
                  {w.assets.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {w.assets.slice(0, 5).map((a) => (
                        <div key={`${a.network}:${a.symbol}`} className="flex items-center justify-between text-xs">
                          <span className="text-aegis-tertiary-dark">
                            {a.symbol} ({NETWORK_LABELS[a.network] ?? a.network})
                          </span>
                          <span className="font-medium text-aegis-secondary-dark">
                            ${a.balanceUsd.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!w.loading && w.assets.length === 0 && (
                    <p className="text-xs text-aegis-tertiary-dark mb-3">No token balances found on-chain</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate("/send")}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white"
                    >
                      <Send size={14} /> Send
                    </button>
                    <button
                      onClick={() => navigate("/receive")}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg border border-border hover:bg-aegis-bg-elevated transition-colors text-aegis-primary-dark dark:text-white"
                    >
                      <Download size={14} /> Receive
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Add more */}
          <motion.button
            onClick={() => setAddingWallet(true)}
            whileHover={{ y: -4 }}
            className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 p-8 hover:border-aegis-accent-purple/40 hover:bg-aegis-accent-purple/5 transition-all min-h-[250px]"
          >
            <div className="w-12 h-12 rounded-full bg-aegis-bg-elevated flex items-center justify-center">
              <Plus size={24} className="text-aegis-accent-purple" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">Add Wallet</p>
              <p className="text-xs text-aegis-tertiary-dark mt-0.5">Connect another EVM address</p>
            </div>
          </motion.button>
        </div>
      )}
    </div>
  );
}
