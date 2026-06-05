/**
 * usePreferences.ts — Persistent user preferences hook
 *
 * DB is source of truth. localStorage is a fast local mirror.
 * Flow:
 *   1. On mount: read from localStorage instantly (no flicker)
 *   2. After auth: fetch from DB → merge → apply to DOM + localStorage
 *   3. On change: update localStorage immediately + debounce-save to DB
 *
 * This means theme/country/currency survive:
 *   - App upgrades / redeployments
 *   - Browser cache clears
 *   - New devices (after login)
 */
import { useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";

// Keys
const K_THEME    = "aegis_theme";
const K_COUNTRY  = "aegis_country";
const K_CURRENCY = "aegis_currency";
const K_NOTIFS   = "aegis_notifications";

export type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(K_THEME, theme);
}

export function usePreferences() {
  const { user, isLoading: authLoading } = useCurrentUser();
  const savePrefs = trpc.preferences.save.useMutation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch DB prefs after login
  const { data: dbPrefs } = trpc.preferences.get.useQuery(undefined, {
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Sync DB → localStorage + DOM on first load after login
  useEffect(() => {
    if (!dbPrefs) return;
    if (dbPrefs.theme)    applyTheme(dbPrefs.theme as Theme);
    if (dbPrefs.country)  localStorage.setItem(K_COUNTRY,  dbPrefs.country);
    if (dbPrefs.currency) localStorage.setItem(K_CURRENCY, dbPrefs.currency);
    if (dbPrefs.notifications !== null && dbPrefs.notifications !== undefined) {
      localStorage.setItem(K_NOTIFS, String(dbPrefs.notifications));
    }
  }, [dbPrefs]);

  // Debounced DB save
  function debounceSave(patch: Parameters<typeof savePrefs.mutate>[0]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (user) savePrefs.mutate(patch);
    }, 1000);
  }

  const setTheme = useCallback((theme: Theme) => {
    applyTheme(theme);
    debounceSave({ theme });
  }, [user]);

  const setCountry = useCallback((country: string, currency?: string) => {
    localStorage.setItem(K_COUNTRY, country);
    if (currency) localStorage.setItem(K_CURRENCY, currency);
    debounceSave({ country, currency });
  }, [user]);

  const setNotifications = useCallback((on: boolean) => {
    localStorage.setItem(K_NOTIFS, String(on));
    debounceSave({ notifications: on });
  }, [user]);

  // Read current values (localStorage as instant source)
  const currentTheme   = (localStorage.getItem(K_THEME) ?? "light") as Theme;
  const currentCountry = localStorage.getItem(K_COUNTRY) ?? "NG";
  const currentCurrency= localStorage.getItem(K_CURRENCY) ?? "NGN";
  const notifications  = localStorage.getItem(K_NOTIFS) !== "false";

  return { currentTheme, currentCountry, currentCurrency, notifications, setTheme, setCountry, setNotifications, isSaving: savePrefs.isPending };
}
