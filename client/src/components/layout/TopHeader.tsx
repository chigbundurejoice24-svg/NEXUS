/**
 * TopHeader.tsx — Top navigation bar with live unread badge + PWA install button
 */
import { Bell, Menu, Download, X, Share, PlusSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trpc, getToken } from "@/lib/trpc";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useState } from "react";

interface Props { title: string; onMenuToggle: () => void; }

function IOSModal({ onClose }: { onClose: () => void }) {
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
            <div><p className="text-sm dark:text-white font-medium">Tap the Share button</p>
              <p className="text-xs text-aegis-tertiary-dark flex items-center gap-1 mt-0.5"><Share size={11}/> Arrow icon at the bottom of Safari</p></div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#5B3CF5] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <div><p className="text-sm dark:text-white font-medium">Tap "Add to Home Screen"</p>
              <p className="text-xs text-aegis-tertiary-dark flex items-center gap-1 mt-0.5"><PlusSquare size={11}/> Scroll down in the share sheet</p></div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#5B3CF5] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <div><p className="text-sm dark:text-white font-medium">Tap "Add"</p>
              <p className="text-xs text-aegis-tertiary-dark">AEGIS appears on your home screen like a real app</p></div>
          </li>
        </ol>
        <button onClick={onClose} className="w-full py-3 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-medium">Got it</button>
      </div>
    </div>
  );
}

export default function TopHeader({ title, onMenuToggle }: Props) {
  const navigate  = useNavigate();
  const hasToken  = !!getToken();
  const [showIOS, setShowIOS] = useState(false);
  const { install, canInstall, isIOS } = usePWAInstall();

  const { data } = trpc.notify.unreadCount.useQuery(undefined, {
    enabled: hasToken,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const unread = (data as any)?.count ?? 0;

  async function handleInstall() {
    const result = await install();
    if (result === "ios") setShowIOS(true);
  }

  return (
    <>
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border bg-background flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
            <Menu size={18} className="text-aegis-tertiary-dark"/>
          </button>
          <h1 className="text-base font-semibold text-aegis-primary-dark dark:text-white">{title}</h1>
        </div>

        <div className="flex items-center gap-1">
          {canInstall && (
            <button onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-lg text-xs font-medium mr-1">
              <Download size={12}/>
              {isIOS ? "Add to Home" : "Install"}
            </button>
          )}

          <button onClick={() => navigate("/notifications")}
            className="relative p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
            <Bell size={18} className="text-aegis-tertiary-dark"/>
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] text-white font-bold leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      {showIOS && <IOSModal onClose={() => setShowIOS(false)} />}
    </>
  );
}
