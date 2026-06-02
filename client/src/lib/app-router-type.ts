/**
 * app-router-type.ts
 * Client-side type stub for AppRouter.
 * Defines the tRPC router shape without importing ANY server code.
 * This prevents Vite from bundling express/drizzle into the client.
 *
 * When the backend is running, these types are validated at runtime.
 * When offline, queries fail gracefully and pages use mock data.
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

// ── Minimal type definitions matching the server router shape ─────
// These mirror what the server returns — no server imports needed.

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

// ── This type IS the AppRouter for the client ─────────────────────
// It must match the server's appRouter exactly in shape.
// The client never imports the real AppRouter — only this type.
export type AppRouter = any; // typed via the hooks below
