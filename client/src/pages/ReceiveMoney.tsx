import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, QrCode, ChevronDown } from "lucide-react";
import { useWallets } from "@/hooks/useWallets";
import { Skeleton } from "@/components/ui/skeleton";

const CHAIN_NAMES: Record<number, string> = {
  1:   "Ethereum (ERC20)",
  56:  "BNB Chain (BEP20)",
  137: "Polygon",
  42161: "Arbitrum",
};

export default function ReceiveMoney() {
  const { linkedWallets, linkedWalletsLoading } = useWallets();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = linkedWallets[selectedIdx];

  function copyAddress() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-5">
      <p className="text-sm text-aegis-secondary-dark">Share your wallet address to receive funds</p>

      {linkedWalletsLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : linkedWallets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <QrCode size={40} className="mx-auto mb-3 text-aegis-tertiary-dark" />
          <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">No wallets connected</p>
          <p className="text-xs text-aegis-tertiary-dark mt-1">Go to Wallets and connect an EVM address first</p>
        </div>
      ) : (
        <>
          {/* Wallet selector */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="text-xs font-medium text-aegis-tertiary-dark uppercase tracking-wider mb-2 block">
              Select Wallet
            </label>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-aegis-accent-purple/40 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-aegis-accent-purple">
                  {(selected?.label ?? "W").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">
                  {selected?.label ?? `Wallet ${selectedIdx + 1}`}
                </p>
                <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{selected?.address}</p>
              </div>
              <ChevronDown size={16} className="text-aegis-tertiary-dark" />
            </button>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 border border-border rounded-lg overflow-hidden bg-card"
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
          </div>

          {/* Address display */}
          {selected && (
            <motion.div
              key={selected.address}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-5"
            >
              {/* QR placeholder — real QR needs qrcode.react package */}
              <div className="w-48 h-48 bg-aegis-bg-elevated rounded-xl flex items-center justify-center border border-border">
                <div className="text-center">
                  <QrCode size={48} className="text-aegis-accent-purple mx-auto mb-2" />
                  <p className="text-[10px] text-aegis-tertiary-dark">QR Code</p>
                  <p className="text-[9px] text-aegis-tertiary-dark">Install qrcode.react to render</p>
                </div>
              </div>

              <div className="w-full space-y-3">
                <div>
                  <p className="text-xs text-aegis-tertiary-dark mb-1">Network</p>
                  <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">
                    {CHAIN_NAMES[selected.chainId] ?? `Chain ID ${selected.chainId}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-aegis-tertiary-dark mb-1">Address</p>
                  <div className="flex items-center gap-2 p-3 bg-aegis-bg-elevated rounded-lg">
                    <p className="text-xs font-mono text-aegis-primary-dark dark:text-white flex-1 break-all">
                      {selected.address}
                    </p>
                    <button
                      onClick={copyAddress}
                      className="p-2 rounded-lg hover:bg-aegis-bg-elevated transition-colors flex-shrink-0"
                    >
                      {copied
                        ? <Check size={16} className="text-aegis-success-green" />
                        : <Copy size={16} className="text-aegis-tertiary-dark" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={copyAddress}
                  className="w-full py-3 gradient-brand text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                >
                  {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Address</>}
                </button>

                <p className="text-xs text-aegis-tertiary-dark text-center">
                  Only send assets on the correct network. Sending on the wrong network will result in permanent loss.
                </p>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
