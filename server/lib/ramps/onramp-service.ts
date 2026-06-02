/**
 * onramp-service.ts
 * Unified on-ramp service: MoonPay, Transak, Yellow Card.
 * Picks the best provider or returns all options for the user to choose.
 */
import { getDb } from "../../db";
import { linkedWallets } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface OnRampProvider {
  name: string;
  id: string;
  generateUrl(params: {
    walletAddress: string;
    fiatAmount: number;
    fiatCurrency: string;
    cryptoCurrency: string;
  }): string;
}

const moonpay: OnRampProvider = {
  id: "moonpay",
  name: "MoonPay",
  generateUrl: ({ walletAddress, fiatAmount, fiatCurrency, cryptoCurrency }) => {
    const apiKey = process.env.MOONPAY_API_KEY ?? "pk_test_key";
    const params = new URLSearchParams({
      apiKey,
      currencyCode: cryptoCurrency.toLowerCase() + "_bsc",
      walletAddress,
      baseCurrencyAmount: String(fiatAmount),
      baseCurrencyCode: fiatCurrency.toUpperCase(),
    });
    return `https://buy.moonpay.com?${params}`;
  },
};

const transak: OnRampProvider = {
  id: "transak",
  name: "Transak",
  generateUrl: ({ walletAddress, fiatAmount, fiatCurrency, cryptoCurrency }) => {
    const apiKey = process.env.TRANSAK_API_KEY ?? "";
    const env = process.env.TRANSAK_ENV ?? "STAGING";
    const params = new URLSearchParams({
      apiKey: apiKey || "demo",
      environment: env,
      walletAddress,
      defaultFiatCurrency: fiatCurrency.toUpperCase(),
      defaultCryptoCurrency: cryptoCurrency.toUpperCase(),
      network: "bsc",
      defaultFiatAmount: String(fiatAmount),
      disableWalletAddressForm: "true",
      productsAvailed: "BUY",
      partnerName: "Aegis",
    });
    const subdomain = env === "STAGING" ? "global-stg" : "global";
    return `https://${subdomain}.transak.com?${params}`;
  },
};

const yellowcard: OnRampProvider = {
  id: "yellowcard",
  name: "Yellow Card",
  generateUrl: ({ walletAddress, fiatAmount, fiatCurrency, cryptoCurrency }) => {
    const params = new URLSearchParams({
      address: walletAddress,
      amount: String(fiatAmount),
      currency: fiatCurrency.toUpperCase(),
      crypto: cryptoCurrency.toUpperCase(),
    });
    return `https://web.yellowcard.io?${params}`;
  },
};

export const ALL_PROVIDERS: OnRampProvider[] = [transak, moonpay, yellowcard];

const PROVIDER_META: Record<string, { fee: string; time: string; recommended?: boolean; color: string }> = {
  transak:    { fee: "1.5–2%",   time: "5–10 min",  recommended: true, color: "#0070F3" },
  moonpay:    { fee: "2.5–3.5%", time: "10–20 min", color: "#7B2FBE" },
  yellowcard: { fee: "1–2%",     time: "2–5 min",   color: "#F7931A" },
};

export class OnRampService {
  /**
   * Returns the primary (recommended) provider URL for a user.
   */
  static async getBestUrl(params: {
    userId: number;
    fiatAmount: number;
    fiatCurrency: string;
    cryptoCurrency: string;
  }): Promise<{ url: string; provider: string }> {
    const walletAddress = await OnRampService._getWallet(params.userId);
    const provider = ALL_PROVIDERS[0];
    return {
      url: provider.generateUrl({ walletAddress, ...params }),
      provider: provider.name,
    };
  }

  /**
   * Returns all provider URLs with metadata so the frontend can show options.
   */
  static async getAllUrls(params: {
    userId: number;
    fiatAmount: number;
    fiatCurrency: string;
    cryptoCurrency: string;
  }): Promise<{ id: string; provider: string; url: string; fee: string; time: string; recommended?: boolean; color: string; estimatedCrypto: string }[]> {
    const walletAddress = await OnRampService._getWallet(params.userId);
    const fxRate = 1 / 1595; // approx NGN/USDT — replace with live rate if needed
    const estimatedUsdt = (params.fiatAmount * fxRate * 0.98).toFixed(2);

    return ALL_PROVIDERS.map((p) => ({
      id: p.id,
      provider: p.name,
      url: p.generateUrl({ walletAddress, ...params }),
      estimatedCrypto: estimatedUsdt,
      ...PROVIDER_META[p.id],
    }));
  }

  static async _getWallet(userId: number): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const [wallet] = await db
      .select({ address: linkedWallets.address })
      .from(linkedWallets)
      .where(eq(linkedWallets.userId, userId))
      .limit(1);
    if (!wallet) throw new Error("No wallet found — please register first");
    return wallet.address;
  }
}
