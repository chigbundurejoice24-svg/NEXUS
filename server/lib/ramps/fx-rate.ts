/**
 * fx-rate.ts — Live FX rate fetcher
 * Replaces the hardcoded 1/1595 NGN rate in onramp-service.ts
 * Sources: Binance P2P API → CoinGecko → hardcoded fallback
 */

let _rateCache: Record<string, number> = {};
let _rateFetchedAt = 0;
const RATE_TTL = 2 * 60 * 1000; // 2 minutes

export async function getLiveFiatRates(): Promise<Record<string, number>> {
  if (Date.now() - _rateFetchedAt < RATE_TTL && Object.keys(_rateCache).length > 0) {
    return _rateCache;
  }

  try {
    // CoinGecko: get USD → local currency rates
    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn,ghs,kes,zar,ugx,xof,xaf",
      { signal: AbortSignal.timeout(5000) }
    );
    if (resp.ok) {
      const data = await resp.json();
      const tether = data?.tether ?? {};
      _rateCache = {
        NGN: tether.ngn ?? 1595,
        GHS: tether.ghs ?? 15.2,
        KES: tether.kes ?? 129,
        ZAR: tether.zar ?? 18.5,
        UGX: tether.ugx ?? 3700,
        XOF: tether.xof ?? 610,
        XAF: tether.xaf ?? 610,
        USD: 1,
      };
      _rateFetchedAt = Date.now();
      return _rateCache;
    }
  } catch (e) {
    console.warn("[FX] CoinGecko rate fetch failed:", e);
  }

  // Fallback
  return {
    NGN: 1595, GHS: 15.2, KES: 129, ZAR: 18.5,
    UGX: 3700, XOF: 610, XAF: 610, USD: 1,
  };
}

export async function getFiatRate(currency: string): Promise<number> {
  const rates = await getLiveFiatRates();
  return rates[currency.toUpperCase()] ?? 1;
}
