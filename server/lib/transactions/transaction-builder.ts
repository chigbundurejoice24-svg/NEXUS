/**
 * transaction-builder.ts
 *
 * Builds and simulates the on-chain transfer payload for a QUOTED transaction.
 * Never holds or moves funds — only constructs calldata for the user to sign.
 *
 * Flow:
 *   QUOTED → build() → SIMULATED → (user signs) → submit() → SUBMITTED
 */

import { eq } from "drizzle-orm";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Abi,
} from "viem";
import { mainnet, bsc, polygon, arbitrum } from "viem/chains";
import { getDb } from "../../db";
import { transactions } from "../../../drizzle/schema";
import { TransactionStateMachine } from "./transaction-state-machine";

// ── Chain config ───────────────────────────────────────────────────
const CHAIN_CONFIG: Record<number, { chain: typeof mainnet; rpcUrl: string }> = {
  1:     { chain: mainnet, rpcUrl: "https://eth.llamarpc.com" },
  56:    { chain: bsc,     rpcUrl: "https://bsc-dataseed.binance.org" },
  137:   { chain: polygon, rpcUrl: "https://polygon-rpc.com" },
  42161: { chain: arbitrum, rpcUrl: "https://arb1.arbitrum.io/rpc" },
};

// ── USDT contract addresses (6 decimals on ETH/Polygon/Arbitrum, 18 on BSC) ──
const USDT_ADDRESSES: Record<number, `0x${string}`> = {
  1:     "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  56:    "0x55d398326f99059fF775485246999027B3197955",
  137:   "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
};

// ── Aegis treasury — receives the protocol fee ─────────────────────
// TODO: Replace with real Cozanet treasury address before mainnet launch
const FEE_COLLECTOR: `0x${string}` = "0x000000000000000000000000000000000000dEaD";

// ── Minimal ERC-20 transfer ABI ────────────────────────────────────
const ERC20_ABI: Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount",    type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

// ── Return type — what the frontend receives ───────────────────────
export interface BuildPayload {
  chainId: number;
  tokenAddress: `0x${string}`;
  transactions: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;       // "0" always for ERC-20 transfers
    label: string;       // human-readable description for the signing UI
  }[];
  simulation: {
    passed: boolean;
    warnings: string[];
  };
}

export class TransactionBuilder {
  /**
   * Build the unsigned transaction payload for a QUOTED transaction.
   * Advances state to SIMULATED on success.
   */
  static async build(transactionId: number): Promise<BuildPayload> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (!tx) throw new Error(`Transaction ${transactionId} not found`);
    if (tx.state !== "QUOTED") {
      throw new Error(`Transaction must be in QUOTED state — current state: ${tx.state}`);
    }

    // Quote expiry guard
    if (tx.quoteExpiresAt && new Date() > tx.quoteExpiresAt) {
      await TransactionStateMachine.transition(transactionId, "FAILED");
      throw new Error("Quote has expired. Please create a new transaction.");
    }

    const chainCfg = CHAIN_CONFIG[tx.chainId];
    if (!chainCfg) throw new Error(`Unsupported chain ID: ${tx.chainId}`);

    const tokenAddress = USDT_ADDRESSES[tx.chainId];
    if (!tokenAddress) throw new Error(`No USDT address for chain ${tx.chainId}`);

    // ── Build calldata for main transfer ──────────────────────────
    const mainData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [tx.recipient as `0x${string}`, tx.amountRaw],
    });

    // ── Build calldata for fee transfer ───────────────────────────
    const feeData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [FEE_COLLECTOR, tx.feeRaw],
    });

    const txPayloads = [
      {
        to: tokenAddress,
        data: mainData,
        value: "0",
        label: `Send ${tx.amountRaw.toString()} USDT to ${tx.recipient.slice(0,6)}…${tx.recipient.slice(-4)}`,
      },
      {
        to: tokenAddress,
        data: feeData,
        value: "0",
        label: `Protocol fee (${tx.feeRaw.toString()} USDT) to Aegis treasury`,
      },
    ];

    // ── On-chain simulation ──────────────────────────────────────
    const warnings: string[] = [];
    let simulationPassed = true;

    try {
      const publicClient = createPublicClient({
        chain: chainCfg.chain,
        transport: http(chainCfg.rpcUrl),
      });

      // Simulate main transfer
      await publicClient.simulateContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [tx.recipient as `0x${string}`, tx.amountRaw],
        account: tx.wallet as `0x${string}`,
      });

      // Simulate fee transfer — only if fee > 0
      if (tx.feeRaw > 0n) {
        await publicClient.simulateContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [FEE_COLLECTOR, tx.feeRaw],
          account: tx.wallet as `0x${string}`,
        });
      }
    } catch (err: any) {
      // Simulation failure → warn but don't hard-fail
      // (RPC may be temporarily unavailable; let the user decide)
      warnings.push(`Simulation warning: ${err?.message ?? "RPC error"}`);
      simulationPassed = false;
    }

    // ── Advance state to SIMULATED ─────────────────────────────────
    await TransactionStateMachine.transition(transactionId, "SIMULATED");

    return {
      chainId: tx.chainId,
      tokenAddress,
      transactions: txPayloads,
      simulation: {
        passed: simulationPassed,
        warnings,
      },
    };
  }

  /**
   * Move a SIMULATED transaction to PENDING_SIGNATURE.
   * Call this right before showing the signing UI to the user.
   */
  static async requestSignature(transactionId: number): Promise<void> {
    await TransactionStateMachine.transition(transactionId, "PENDING_SIGNATURE");
  }

  /**
   * Called after the user has signed and the transaction is broadcast.
   * Advances state to SUBMITTED and persists the on-chain tx hash.
   */
  static async submit(transactionId: number, txHash: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [tx] = await db
      .select({ id: transactions.id, state: transactions.state })
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (!tx) throw new Error(`Transaction ${transactionId} not found`);
    if (tx.state !== "PENDING_SIGNATURE") {
      throw new Error(`Transaction must be PENDING_SIGNATURE — current: ${tx.state}`);
    }

    // Store the hash first, then advance state via state machine
    await db
      .update(transactions)
      .set({ txHash, updatedAt: new Date() })
      .where(eq(transactions.id, transactionId));

    await TransactionStateMachine.transition(transactionId, "SUBMITTED");
  }
}
