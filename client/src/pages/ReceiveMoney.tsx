import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Share2, ChevronDown, AlertTriangle } from "lucide-react";
import { useWallets } from "@/hooks/useWallets";
import { useCurrentUser } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const CHAIN_NAMES: Record<number, string> = {
  1:     "Ethereum (ERC20)",
  56:    "BNB Chain (BEP20)",
  137:   "Polygon",
  42161: "Arbitrum",
};

function QRCode({ address }: { address: string }) {
  const size = 200;
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(address)}&size=${size}x${size}&margin=10&color=5B3CF5&bgcolor=ffffff`;
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);

  return (
    <div className="relative w-52 h-52 flex items-center justify-center rounded-2xl overflow-hidden border-2 border-aegis-accent-purple/20 bg-white shadow-lg">
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-2 border-aegis-accent-purple border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error ? (
        <div className="text-center p-4">
          <AlertTriangle size={32} className="text-yellow-500 mx-auto mb-2" />
          <p className="text-xs text-aegis-tertiary-dark">QR unavailable offline</p>
        </div>
      ) : (
        <img
          src={url}
          alt="Wallet QR Code"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

export default function ReceiveMoney() {
  const { linkedWallets, linkedWalletsLoading } = useWallets();
  const { walletAddress: embeddedAddress } = useCurrentUser();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = linkedWallets[selectedIdx];

  function copyAddress() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function shareAddress() {
    if (!selected) return;
    if (navigator.share) {
      navigator.share({ title: "My Aegis Wallet", text: selected.address });
    } else {
      copyAddress();
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-5">
      <p className="text-sm text-aegis-secondary-dark">Share your wallet address to receive funds</p>

      {linkedWalletsLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : linkedWallets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-aegis-primary-dark dark:text-white mb-1">No wallets connected</p>
          <p className="text-xs text-aegis-tertiary-dark">Go to Wallets and connect an EVM address first</p>
        </div>
      ) : (
        <>
          {/* Wallet selector */}
          {linkedWallets.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-4 relative">
              <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
                Select Wallet
              </label>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-aegis-accent-purple">
                    {(selected?.label ?? "W").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">{selected?.label ?? `Wallet ${selectedIdx + 1}`}</p>
                  <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{selected?.address}</p>
                </div>
                <ChevronDown size={16} className={`text-aegis-tertiary-dark transition-transform ${showDropdown ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-4 right-4 top-full mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-10"
                  >
                    {linkedWallets.map((lw, i) => (
                      <button
                        key={lw.id}
                        onClick={() => { setSelectedIdx(i); setShowDropdown(false); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-aegis-bg-elevated transition-colors text-left"
                      >
                        <p className="text-sm text-aegis-primary-dark dark:text-white">{lw.label ?? `Wallet ${i + 1}`}</p>
                        <p className="text-xs text-aegis-tertiary-dark font-mono ml-auto truncate max-w-[160px]">{lw.address}</p>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* QR + address card */}
          {selected && (
            <motion.div
              key={selected.address}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-5"
            >
              <QRCode address={selected.address} />

              <div className="w-full space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-aegis-bg-elevated rounded-xl p-3">
                    <p className="text-xs text-aegis-tertiary-dark mb-0.5">Network</p>
                    <p className="font-medium text-aegis-primary-dark dark:text-white text-xs">
                      {CHAIN_NAMES[selected.chainId] ?? `Chain ${selected.chainId}`}
                    </p>
                  </div>
                  <div className="bg-aegis-bg-elevated rounded-xl p-3">
                    <p className="text-xs text-aegis-tertiary-dark mb-0.5">Token Standard</p>
                    <p className="font-medium text-aegis-primary-dark dark:text-white text-xs">ERC-20 / BEP-20</p>
                  </div>
                </div>

                {/* Address box */}
                <div className="flex items-center gap-2 p-3 bg-aegis-bg-elevated rounded-xl border border-border">
                  <p className="text-xs font-mono text-aegis-primary-dark dark:text-white flex-1 break-all leading-relaxed">
                    {selected.address}
                  </p>
                  <button onClick={copyAddress} className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
                    {copied
                      ? <Check size={16} className="text-green-500" />
                      : <Copy size={16} className="text-aegis-tertiary-dark" />}
                  </button>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={copyAddress}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-border hover:bg-aegis-bg-elevated transition-colors text-sm font-medium text-aegis-primary-dark dark:text-white"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={shareAddress}
                    className="flex items-center justify-center gap-2 py-3 gradient-brand text-white rounded-xl text-sm font-medium"
                  >
                    <Share2 size={16} /> Share
                  </button>
                </div>

                <p className="text-[11px] text-aegis-tertiary-dark text-center leading-relaxed">
                  ⚠️ Only send assets on the correct network. Sending on the wrong network may result in permanent loss.
                </p>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
