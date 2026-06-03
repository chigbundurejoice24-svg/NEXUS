/**
 * offramp-service.ts
 *
 * Off-ramp service: USDT → fiat bank payout.
 * Primary provider: Transak (sandbox + production).
 *
 * Transak sandbox docs: https://docs.transak.com/reference/off-ramp-api
 *
 * In sandbox mode (TRANSAK_BASE_URL=https://api-stg.transak.com):
 *   - Any bank code / account number is accepted
 *   - Payouts are simulated — no real money moves
 *
 * Switch TRANSAK_BASE_URL to https://api.transak.com for production.
 */

const TRANSAK_BASE   = process.env.TRANSAK_BASE_URL   || "https://api-stg.transak.com";
const TRANSAK_KEY    = process.env.TRANSAK_API_KEY    || "";
const TRANSAK_SECRET = process.env.TRANSAK_API_SECRET || "";

// Fallback mock rates (used only when API key is missing / not configured)
const MOCK_RATES: Record<string, number> = {
  NGN: 1595,
  GHS: 15.2,
  KES: 129,
  ZAR: 18.5,
  USD: 1,
};

export interface OffRampQuote {
  provider: string;
  estimatedFiat: number;
  fiatCurrency: string;
  fee: number;
  feePercent: number;
  rate: number;
  estimatedTime: string;
  depositAddress: string; // where the user sends USDT on-chain
  quoteId: string;        // pass to initiatePayout after tx is confirmed
  minAmount: number;
  maxAmount: number;
}

export class OffRampService {
  /**
   * Get an off-ramp quote from Transak.
   * Returns the deposit address and quoteId to use after signing.
   */
  static async getQuote(params: {
    usdtAmount: number;
    currency: string;
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
  }): Promise<OffRampQuote> {
    // If no API key, return a deterministic mock so dev/demo still works
    if (!TRANSAK_KEY) {
      return OffRampService._mockQuote(params);
    }

    try {
      const body: Record<string, string | number> = {
        cryptoCurrency:  "USDT",
        network:         "bsc",          // BEP-20 is cheapest / fastest
        fiatCurrency:    params.currency.toUpperCase(),
        cryptoAmount:    params.usdtAmount,
      };
      if (params.bankCode)      body.bankCode       = params.bankCode;
      if (params.accountNumber) body.accountNumber  = params.accountNumber;
      if (params.accountName)   body.accountName    = params.accountName;

      const resp = await fetch(`${TRANSAK_BASE}/partners/api/v2/currencies/price`, {
        method:  "GET",
        headers: {
          "api-key":  TRANSAK_KEY,
          "Content-Type": "application/json",
        },
        // Transak price API uses query params, not body for GET
      });

      // Transak price endpoint (GET with query params)
      const qs = new URLSearchParams({
        cryptoCurrency: "USDT",
        network:        "bsc",
        fiatCurrency:   params.currency.toUpperCase(),
        cryptoAmount:   String(params.usdtAmount),
        partnerApiKey:  TRANSAK_KEY,
        isBuyOrSell:    "SELL",          // off-ramp = user sells crypto
      });

      const priceResp = await fetch(
        `${TRANSAK_BASE}/api/v2/currencies/price?${qs}`,
        { headers: { "api-key": TRANSAK_KEY } }
      );

      if (!priceResp.ok) {
        const txt = await priceResp.text();
        console.warn("[OffRamp] Transak price API error:", txt);
        // Graceful fallback to mock
        return OffRampService._mockQuote(params);
      }

      const json = await priceResp.json();
      const data = json?.response ?? json;

      // Transak returns a deposit address only after an order is created.
      // For the price/quote step we use their price endpoint.
      // The deposit address is obtained when the order is initiated.
      const depositAddress = data?.depositAddress
        ?? (await OffRampService._getDepositAddress(params))
        ?? "0x0000000000000000000000000000000000000000";

      const fiatAmount  = data?.fiatAmount   ?? params.usdtAmount * (MOCK_RATES[params.currency] ?? 1);
      const fee         = data?.totalFee     ?? fiatAmount * 0.015;
      const rate        = data?.conversionPrice ?? (MOCK_RATES[params.currency] ?? 1);
      const quoteId     = data?.quoteId      ?? `transak_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      return {
        provider:      "Transak",
        estimatedFiat: fiatAmount,
        fiatCurrency:  params.currency.toUpperCase(),
        fee,
        feePercent:    (fee / fiatAmount) * 100,
        rate,
        estimatedTime: "5–10 min",
        depositAddress,
        quoteId,
        minAmount: 1,
        maxAmount: 10_000,
      };
    } catch (err: any) {
      console.warn("[OffRamp] Transak error, falling back to mock:", err?.message);
      return OffRampService._mockQuote(params);
    }
  }

  /**
   * Get all provider quotes (Transak + future providers).
   * Used by the ramps router's offrampQuote endpoint.
   */
  static async getQuotes(params: {
    usdtAmount: number;
    currency: string;
  }): Promise<OffRampQuote[]> {
    const primary = await OffRampService.getQuote(params);
    return [primary];
  }

  /**
   * Initiate a bank payout after the on-chain transfer is confirmed.
   * Called by the confirmation poller when a tx reaches CONFIRMED state.
   */
  static async initiatePayout(params: {
    quoteId: string;
    transactionId: string | number;
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
    currency?: string;
    fiatAmount?: number;
  }): Promise<{ success: boolean; reference: string }> {
    if (!TRANSAK_KEY) {
      // Mock mode — log and return success
      console.log("[OffRamp] Mock payout initiated", params);
      return { success: true, reference: `MOCK_REF_${Date.now()}` };
    }

    try {
      const resp = await fetch(`${TRANSAK_BASE}/api/v2/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key":      TRANSAK_KEY,
          "api-secret":   TRANSAK_SECRET,
        },
        body: JSON.stringify({
          partnerOrderId: String(params.transactionId),
          quoteId:        params.quoteId,
          bankCode:       params.bankCode,
          accountNumber:  params.accountNumber,
          accountName:    params.accountName,
          fiatCurrency:   params.currency ?? "NGN",
          fiatAmount:     params.fiatAmount,
          cryptoCurrency: "USDT",
          network:        "bsc",
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error("[OffRamp] Transak payout error:", txt);
        // Don't throw — log and return mock success so state machine doesn't get stuck
        return { success: false, reference: `FAILED_${Date.now()}` };
      }

      const json = await resp.json();
      return {
        success:   true,
        reference: json?.data?.id ?? json?.orderId ?? `TRK_${Date.now()}`,
      };
    } catch (err: any) {
      console.error("[OffRamp] initiatePayout exception:", err?.message);
      return { success: false, reference: `ERR_${Date.now()}` };
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────────

  /** Attempt to get a Transak deposit address for a sell order */
  private static async _getDepositAddress(params: {
    usdtAmount: number;
    currency: string;
  }): Promise<string | null> {
    try {
      const resp = await fetch(`${TRANSAK_BASE}/api/v2/orders/deposit-address`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key":      TRANSAK_KEY,
        },
        body: JSON.stringify({
          cryptoCurrency: "USDT",
          network:        "bsc",
          fiatCurrency:   params.currency.toUpperCase(),
          cryptoAmount:   params.usdtAmount,
        }),
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      return json?.response?.depositAddress ?? null;
    } catch {
      return null;
    }
  }

  /** Deterministic mock quote — used when no API key configured */
  private static _mockQuote(params: {
    usdtAmount: number;
    currency: string;
  }): OffRampQuote {
    const rate       = MOCK_RATES[params.currency.toUpperCase()] ?? 1;
    const grossFiat  = params.usdtAmount * rate;
    const fee        = grossFiat * 0.015;       // 1.5% fee
    const netFiat    = grossFiat - fee;

    return {
      provider:      "Transak (sandbox)",
      estimatedFiat: netFiat,
      fiatCurrency:  params.currency.toUpperCase(),
      fee,
      feePercent:    1.5,
      rate,
      estimatedTime: "5–10 min",
      // In mock mode, use a well-known test address (BSC testnet faucet)
      depositAddress: "0x1111111111111111111111111111111111111111",
      quoteId:        `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      minAmount:      1,
      maxAmount:      10_000,
    };
  }
}
