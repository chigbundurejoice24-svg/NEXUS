/**
 * useOnramp.ts
 *
 * Opens the Transak on-ramp widget with the user's embedded wallet
 * pre-filled. Transak is free to integrate (no API key needed for testing).
 *
 * Production: set VITE_TRANSAK_API_KEY in Vercel env vars.
 * Staging: use "test" key which shows the widget in sandbox mode.
 */

const TRANSAK_ENV = import.meta.env.VITE_TRANSAK_ENV ?? "STAGING";
const TRANSAK_KEY = import.meta.env.VITE_TRANSAK_API_KEY ?? "";

export interface OnrampOptions {
  walletAddress: string;
  fiatCurrency?: string;   // default: NGN
  defaultAmount?: number;  // default: 50000
  cryptoCurrency?: string; // default: USDT
  network?: string;        // default: bsc
  email?: string;
}

/**
 * Opens the Transak widget in a new tab with the user's wallet pre-filled.
 * Transak handles KYC, payment, and sends crypto directly to the wallet.
 */
export function openTransak(opts: OnrampOptions) {
  const params = new URLSearchParams({
    apiKey:         TRANSAK_KEY || "demo",
    environment:    TRANSAK_ENV,
    walletAddress:  opts.walletAddress,
    defaultFiatCurrency: opts.fiatCurrency ?? "NGN",
    defaultCryptoCurrency: opts.cryptoCurrency ?? "USDT",
    network:        opts.network ?? "bsc",
    defaultFiatAmount: String(opts.defaultAmount ?? 50000),
    ...(opts.email ? { email: opts.email } : {}),
    disableWalletAddressForm: "true", // user can't change the wallet
    productsAvailed: "BUY",
    partnerName:    "Aegis",
    hostURL:        window.location.origin,
    redirectURL:    window.location.origin + "/?onramp=success",
  });

  const url = `https://global${TRANSAK_ENV === "STAGING" ? "-stg" : ""}.transak.com/?${params.toString()}`;
  window.open(url, "_blank", "width=420,height=680,noopener,noreferrer");
}

/**
 * Opens MoonPay as a fallback (no API key needed for basic URL).
 */
export function openMoonPay(opts: OnrampOptions) {
  const params = new URLSearchParams({
    apiKey:      import.meta.env.VITE_MOONPAY_API_KEY ?? "pk_test_key",
    walletAddress: opts.walletAddress,
    currencyCode: (opts.cryptoCurrency ?? "USDT").toLowerCase() + "_bsc",
    baseCurrencyCode: opts.fiatCurrency ?? "NGN",
    baseCurrencyAmount: String(opts.defaultAmount ?? 50000),
    showAllCurrencies: "false",
    redirectURL: window.location.origin + "/?onramp=success",
  });
  const url = `https://buy${TRANSAK_ENV === "STAGING" ? "-sandbox" : ""}.moonpay.com?${params.toString()}`;
  window.open(url, "_blank", "width=420,height=680,noopener,noreferrer");
}
