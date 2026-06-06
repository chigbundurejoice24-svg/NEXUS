/**
 * InstallBanner.tsx — "Install App" button + iOS instructions modal
 *
 * Place anywhere. Shows only when:
 *   - App is not already installed
 *   - Browser supports PWA install (Chrome/Edge/Android) OR is iOS Safari
 */
import { useState } from "react";
import { Download, X, Share, PlusSquare, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function InstallBanner({ compact = false }: { compact?: boolean }) {
  const { install, canInstall, isInstalled, isIOS } = usePWAInstall();
  const [showIOS, setShowIOS]   = useState(false);
  const [outcome, setOutcome]   = useState<string | null>(null);

  if (isInstalled) return null;
  if (!canInstall)  return null;

  async function handleInstall() {
    const result = await install();
    if (result === "ios") { setShowIOS(true); return; }
    setOutcome(result);
  }

  if (compact) {
    return (
      <>
        <button onClick={handleInstall}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-medium w-full justify-center">
          <Download size={15} />
          {isIOS ? "Add to Home Screen" : "Install AEGIS App"}
        </button>
        {showIOS && <IOSInstructions onClose={() => setShowIOS(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-9 h-9 rounded-xl bg-[#5B3CF5]/10 flex items-center justify-center flex-shrink-0">
          <Smartphone size={16} className="text-[#5B3CF5]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium dark:text-white">Install AEGIS App</p>
          <p className="text-xs text-aegis-tertiary-dark">Works offline · faster · no browser bar</p>
        </div>
        <button onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-lg text-xs font-medium flex-shrink-0">
          <Download size={12} />
          {isIOS ? "Add" : "Install"}
        </button>
      </div>
      {showIOS && <IOSInstructions onClose={() => setShowIOS(false)} />}
    </>
  );
}

function IOSInstructions({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card w-full max-w-sm rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold dark:text-white">Install on iPhone / iPad</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated"><X size={16}/></button>
        </div>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#5B3CF5] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <div>
              <p className="text-sm dark:text-white font-medium">Tap the Share button</p>
              <p className="text-xs text-aegis-tertiary-dark flex items-center gap-1 mt-0.5">
                <Share size={11} /> The box with an arrow at the bottom of Safari
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#5B3CF5] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <div>
              <p className="text-sm dark:text-white font-medium">Tap "Add to Home Screen"</p>
              <p className="text-xs text-aegis-tertiary-dark flex items-center gap-1 mt-0.5">
                <PlusSquare size={11} /> Scroll down in the share sheet
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#5B3CF5] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <div>
              <p className="text-sm dark:text-white font-medium">Tap "Add"</p>
              <p className="text-xs text-aegis-tertiary-dark">AEGIS will appear on your home screen like a real app</p>
            </div>
          </li>
        </ol>
        <button onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-medium">
          Got it
        </button>
      </div>
    </div>
  );
}
