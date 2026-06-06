/**
 * usePWAInstall.ts
 *
 * Captures the browser's beforeinstallprompt event so we can trigger
 * the native "Add to Home Screen / Install" dialog on demand.
 *
 * Works on Chrome/Edge/Android. On iOS Safari, shows manual instructions
 * (iOS doesn't support beforeinstallprompt).
 */
import { useState, useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [isIOS, setIsIOS]                   = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Already installed as PWA?
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install(): Promise<"accepted" | "dismissed" | "ios" | "already"> {
    if (isInstalled) return "already";
    if (isIOS)       return "ios";
    if (!deferredPrompt) return "dismissed";

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
    return outcome;
  }

  const canInstall = !isInstalled && (!!deferredPrompt || isIOS);

  return { install, canInstall, isInstalled, isIOS };
}
