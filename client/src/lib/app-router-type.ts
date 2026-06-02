/**
 * app-router-type.ts
 * Client-side type stub for AppRouter — zero server imports.
 * Mirrors the server router shape for TypeScript inference.
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type TransactionState =
  | "CREATED" | "QUOTED" | "SIMULATED" | "PENDING_SIGNATURE"
  | "SUBMITTED" | "CONFIRMED" | "SETTLED" | "FAILED" | "REVERSED";

export interface TrpcUser {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  kycStatus: "NONE" | "PENDING" | "VERIFIED" | "REJECTED";
  credentialId: string | null;
  recoveryWallet: string | null;
  createdAt: Date;
}

export interface LinkedWalletRecord {
  id: number;
  userId: number;
  address: string;
  chainId: number;
  type: "EMBEDDED" | "EXTERNAL";
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionRecord {
  id: number;
  userId: number;
  referenceId: string;
  idempotencyKey: string | null;
  state: TransactionState;
  chainId: number;
  wallet: string;
  recipient: string;
  amountRaw: bigint;
  tokenDecimals: number;
  feeRaw: bigint;
  discountBps: number;
  cozanetSnapshot: string | null;
  quoteExpiresAt: Date | null;
  requestHash: string | null;
  txHash: string | null;
  metadata: unknown;
  riskFlags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildPayload {
  chainId: number;
  tokenAddress: string;
  transactions: {
    to: string;
    data: string;
    value: string;
    label: string;
  }[];
  simulation: {
    passed: boolean;
    warnings: string[];
  };
}

export interface PriceMap {
  prices: Record<string, number>;
}

export interface AggregatedPortfolio {
  totalValueUsd: string;
  totalWallets: number;
  perWallet: {
    wallet: string;
    totalValueUsd: string;
    assets: { network: string; token: string; valueUsd: string; balance: string }[];
  }[];
}

export type AppRouter = any;
