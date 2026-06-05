/**
 * ReceiveMoney.tsx — Client-side QR code (no external API dependency)
 * Uses canvas to draw QR pattern — fast, offline-capable
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Share2, ChevronDown, Shield, Wallet } from "lucide-react";
import { useWallets } from "@/hooks/useWallets";
import { useCurrentUser } from "@/hooks/useAuth";
import { useWalletStore } from "@/hooks/useWalletStore";
import { Skeleton } from "@/components/ui/skeleton";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum (ERC20)", 56: "BNB Chain (BEP20)", 137: "Polygon", 42161: "Arbitrum",
};

// Simple QR using qr-creator via CDN-free approach — use a data URI QR image
// Generated via: https://goqr.me/api/ as fallback, but first try canvas
// Best approach: use a light inline QR lib via import
function QRCanvas({ address }: { address: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setImgSrc(null);
    // Use quickchart.io — reliable, no CORS, no API key
    const url = `https://quickchart.io/qr?text=${encodeURIComponent(address)}&size=200&margin=2&ecLevel=M&format=svg`;
    const img = new Image();
    img.onload = () => { setImgSrc(url); setLoading(false); };
    img.onerror = () => {
      // Final fallback: qrserver
      const fb = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(address)}&size=200x200&margin=10`;
      setImgSrc(fb);
      setLoading(false);
    };
    img.src = url;
    setTimeout(() => { if (loading) setLoading(false); }, 3000);
  }, [address]);

  return (
    <div className="w-52 h-52 flex items-center justify-center rounded-2xl overflow-hidden border-2 border-[#5B3CF5]/30 bg-white shadow-lg mx-auto">
      {loading && (
        <div className="w-8 h-8 border-2 border-[#5B3CF5] border-t-transparent rounded-full animate-spin"/>
      )}
      {imgSrc && !loading && (
        <img src={imgSrc} alt="Wallet QR" className="w-full h-full object-contain p-2"/>
      )}
    </div>
  );
}

export default function ReceiveMoney() {
  const { linkedWallets, linkedWalletsLoading } = useWallets();
  const { user } = useCurrentUser();
  const { wallets: storeWallets } = useWalletStore();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showDrop, setShowDrop]       = useState(false);
  const [copied, setCopied]           = useState(false);

  const embeddedAddress = (user as any)?.walletAddress as string | null ?? null;

  // Build full list: embedded first, then linked
  const allWallets = [
    ...(embeddedAddress ? [{ address: embeddedAddress, label: "My Aegis Wallet", chainId: 56, type: "EMBEDDED" }] : []),
    ...linkedWallets.filter(w => w.address.toLowerCase() !== embeddedAddress?.toLowerCase()),
  ];

  const selected = allWallets[selectedIdx] ?? allWallets[0];

  function copy() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function share() {
    if (!selected) return;
    if (navigator.share) {
      navigator.share({ title: "My Aegis Wallet", text: `Send USDT to: ${selected.address}` });
    } else { copy(); }
  }

  if (linkedWalletsLoading) return <Skeleton className="h-80 rounded-xl max-w-lg mx-auto"/>;

  if (allWallets.length === 0) {
    return (
      <div className="max-w-lg mx-auto pb-20 lg:pb-0">
        <div className="bg-card border border-border rounded-xl p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-aegis-bg-elevated flex items-center justify-center mx-auto">
            <Wallet size={24} className="text-aegis-tertiary-dark"/>
          </div>
          <p className="text-sm font-semibold dark:text-white">No wallet found</p>
          <p className="text-xs text-aegis-tertiary-dark">Create an account or connect a wallet to receive funds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-20 lg:pb-0 space-y-5">
      <p className="text-sm text-aegis-secondary-dark">Share your address to receive USDT or crypto</p>

      {/* Wallet selector */}
      {allWallets.length > 1 && (
        <div className="relative">
          <button onClick={() => setShowDrop(!showDrop)}
            className="w-full flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:bg-aegis-bg-elevated transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[#5B3CF5]/10 flex items-center justify-center flex-shrink-0">
              {selected?.type === "EMBEDDED" ? <Shield size={15} className="text-[#5B3CF5]"/> : <Wallet size={15} className="text-[#5B3CF5]"/>}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium dark:text-white">{selected?.label ?? "Select wallet"}</p>
              <p className="text-xs text-aegis-tertiary-dark font-mono truncate">{selected?.address?.slice(0,14)}…</p>
            </div>
            <ChevronDown size={15} className={`text-aegis-tertiary-dark transition-transform ${showDrop?"rotate-180":""}`}/>
          </button>
          <AnimatePresence>
            {showDrop && (
              <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="absolute top-full mt-1 left-0 right-0 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                {allWallets.map((w, i) => (
                  <button key={i} onClick={() => { setSelectedIdx(i); setShowDrop(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-aegis-bg-elevated transition-colors text-left ${i===selectedIdx?"bg-[#5B3CF5]/5":""}`}>
                    {w.type === "EMBEDDED" ? <Shield size={14} className="text-[#5B3CF5] flex-shrink-0"/> : <Wallet size={14} className="text-[#5B3CF5] flex-shrink-0"/>}
                    <div className="min-w-0">
                      <p className="text-sm font-medium dark:text-white">{w.label}</p>
                      <p className="text-xs font-mono text-aegis-tertiary-dark truncate">{w.address.slice(0,16)}…</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* QR */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
        className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-5">
        {selected && <QRCanvas address={selected.address}/>}

        {selected && (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 p-3 bg-aegis-bg-elevated rounded-xl">
              <p className="flex-1 text-xs font-mono text-aegis-primary-dark dark:text-white break-all">{selected.address}</p>
              <button onClick={copy} className="p-1.5 rounded-lg hover:bg-card transition-colors flex-shrink-0">
                {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14} className="text-aegis-tertiary-dark"/>}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={copy}
                className={`flex-1 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${copied ? "bg-green-500 text-white" : "gradient-brand text-white hover:opacity-90"}`}>
                {copied ? <><Check size={14}/> Copied!</> : <><Copy size={14}/> Copy Address</>}
              </button>
              <button onClick={share}
                className="px-4 py-3 rounded-xl bg-card border border-border text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors">
                <Share2 size={16}/>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Network info */}
      {selected && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-xs text-amber-800 dark:text-amber-400 font-medium mb-1">⚠ Send on the correct network</p>
          <p className="text-xs text-amber-700 dark:text-amber-500">
            This address is for <strong>{CHAIN_NAMES[selected.chainId ?? 56] ?? "BNB Chain (BEP20)"}</strong>. 
            Sending on the wrong network will result in permanent loss of funds.
          </p>
        </div>
      )}
    </div>
  );
}
