/**
 * useNgnRate.ts — fetches live NGN/USD rate
 *
 * Uses open.er-api.com (free tier, no API key required).
 * Falls back to 1,595 if the fetch fails.
 */
import { useEffect, useState } from "react";

const FALLBACK = 1595.20;
const CACHE_KEY = "aegis_ngn_rate";
const CACHE_TTL = 15 * 60 * 1000; // 15 min

export function useNgnRate() {
  const [rate, setRate]       = useState<number>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try cache first
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setRate(cached.rate);
        setLoading(false);
        return;
      }
    } catch {}

    // Fetch live rate
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(data => {
        const ngn = data?.rates?.NGN;
        if (typeof ngn === "number" && ngn > 0) {
          setRate(ngn);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: ngn, ts: Date.now() }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { rate, loading };
}
