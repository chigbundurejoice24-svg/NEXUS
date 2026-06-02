/**
 * offramp-service.ts
 * Off-ramp service for bank payouts (NGN, GHS, KES, ZAR).
 * Providers: Yellow Card (primary), BinancePay (fallback).
 * Currently returns mock quotes — swap TODO comments with real API calls.
 */

export interface OffRampQuote {
  provider: string;
  estimatedFiat: number;
  fiatCurrency: string;
  fee: number;
  feePercent: number;
  rate: number;
  estimatedTime: string;
  minAmount: number;
  maxAmount: number;
}

export interface PayoutParams {
  transactionId: string;
  recipientBankCode: string;
  recipientAccountNumber: string;
  recipientName: string;
  amountFiat: number;
  currency: string;
}

const RATES_BY_CURRENCY: Record<string, number> = {
  NGN: 1595,
  GHS: 15.2,
  KES: 129,
  ZAR: 18.5,
  USD: 1,
};

export class OffRampService {
  /**
   * Get quotes from all off-ramp providers.
   * Replace mock logic with real API calls for Yellow Card, etc.
   */
  static async getQuotes(params: {
    usdtAmount: number;
    currency: string;
  }): Promise<OffRampQuote[]> {
    const rate = RATES_BY_CURRENCY[params.currency.toUpperCase()] ?? 1;
    const rawFiat = params.usdtAmount * rate;

    return [
      {
        provider: "Yellow Card",
        estimatedFiat: rawFiat * (1 - 0.005),
        fiatCurrency: params.currency,
        fee: rawFiat * 0.005,
        feePercent: 0.5,
        rate,
        estimatedTime: "2–5 min",
        minAmount: 1,
        maxAmount: 10000,
      },
      {
        provider: "Flutterwave",
        estimatedFiat: rawFiat * (1 - 0.007),
        fiatCurrency: params.currency,
        fee: rawFiat * 0.007,
        feePercent: 0.7,
        rate: rate * 0.995,
        estimatedTime: "5–10 min",
        minAmount: 1,
        maxAmount: 5000,
      },
    ];
  }

  /**
   * Initiate a bank payout after USDT is confirmed received.
   * TODO: Replace with Yellow Card / Flutterwave API call.
   */
  static async initiatePayout(params: PayoutParams): Promise<{ success: boolean; reference: string }> {
    console.log("[OffRampService] Initiating payout", params);
    // TODO: POST to https://api.yellowcard.io/v2/payments
    return { success: true, reference: `REF_${Date.now()}` };
  }
}
