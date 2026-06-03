/**
 * transaction-builder.ts
 *
 * Builds and simulates the on-chain ERC-20 transfer payload.
 * Non-custodial — constructs calldata for the user to sign.
 *
 * Flow:
 *   QUOTED → build(txId, offRampDepositAddress?) → SIMULATED
 *   → requestSignature() → PENDING_SIGNATURE
 *   → submit(txId, txHash) → SUBMITTED
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
  1:     { chain: mainnet,  rpcUrl: "https://eth.llamarpc.com" },
  56:    { chain: bsc,      rpcUrl: "https://bsc-dataseed.binance.org" },
  137:   { chain: polygon,  rpcUrl: "https://polygon-rpc.com" },
  42161: { chain: arbitrum, rpcUrl: "https://arb1.arbitrum.io/rpc" },
};

// ── USDT contract addresses ────────────────────────────────────────
const USDT_ADDRESSES: Record<number, `0x${string}`> = {
  1:     "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  56:    "0x55d398326f99059fF775485246999027B3197955",
  137:   "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
};

// ── Aegis fee collector — receives protocol fees ───────────────────
// Real Cozanet treasury address. Update before mainnet.
const FEE_COLLECTOR: `0x${string}` =
  (process.env.FEE_COLLECTOR_ADDRESS as `0x${string}`) ??
  "0xb605000000000000000000000000000000000000"; // placeholder — set via env var

// ── Minimal ERC-20 ABI ─────────────────────────────────────────────
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

export interface TxPayloadItem {
  to:    `0x${string}`;
  data:  `0x${string}`;
  value: string; // always "0" for ERC-20 transfers
  label: string; // human-readable description for signing UI
}

export interface BuildPayload {
  chainId:      number;
  tokenAddress: `0x${string}`;
  transactions: TxPayloadItem[];
  simulation: {
    passed:   boolean;
    warnings: string[];
  };
}

export class TransactionBuilder {
  /**
   * Build the unsigned transaction payload.
   *
   * @param transactionId  - DB id of the transaction (must be in QUOTED state)
   * @param offRampDepositAddress - Optional Transak/YC deposit address.
   *   If provided, the main USDT transfer is routed here instead of tx.recipient.
   *   This is the core mechanism that makes the off-ramp work.
   */
  static async build(
    transactionId: number,
    offRampDepositAddress?: string
  ): Promise<BuildPayload> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (!tx) throw new Error(`Transaction ${transactionId} not found`);
    if (tx.state !== "QUOTED") {
      throw new Error(
        `Transaction must be in QUOTED state — current: ${tx.state}`
      );
    }

    // Quote expiry guard
    if (tx.quoteExpiresAt && new Date() > tx.quoteExpiresAt) {
      await TransactionStateMachine.transition(transactionId, "FAILED");
      throw new Error("Quote has expired — please create a new transaction.");
    }

    const chainCfg = CHAIN_CONFIG[tx.chainId];
    if (!chainCfg) throw new Error(`Unsupported chain ID: ${tx.chainId}`);

    const tokenAddress = USDT_ADDRESSES[tx.chainId];
    if (!tokenAddress) throw new Error(`No USDT address for chain ${tx.chainId}`);

    // ── Determine main recipient ──────────────────────────────────
    // If offRampDepositAddress is provided, USDT goes to the off-ramp provider.
    // Otherwise it goes to the on-chain recipient stored in the tx record.
    const isValidHex = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
    const mainRecipient: `0x${string}` = (
      offRampDepositAddress && isValidHex(offRampDepositAddress)
        ? offRampDepositAddress
        : tx.recipient
    ) as `0x${string}`;

    // ── Build calldata ────────────────────────────────────────────
    const mainData = encodeFunctionData({
      abi:          ERC20_ABI,
      functionName: "transfer",
      args:         [mainRecipient, tx.amountRaw],
    });

    const txPayloads: TxPayloadItem[] = [
      {
        to:    tokenAddress,
        data:  mainData,
        value: "0",
        label: `Send ${tx.amountRaw.toString()} USDT → ${mainRecipient.slice(0, 6)}…${mainRecipient.slice(-4)}`,
      },
    ];

    // Only add fee tx if fee > 0 AND FEE_COLLECTOR is a real address
    if (tx.feeRaw > 0n && FEE_COLLECTOR !== "0x0000000000000000000000000000000000000000") {
      const feeData = encodeFunctionData({
        abi:          ERC20_ABI,
        functionName: "transfer",
        args:         [FEE_COLLECTOR, tx.feeRaw],
      });
      txPayloads.push({
        to:    tokenAddress,
        data:  feeData,
        value: "0",
        label: `Protocol fee (${tx.feeRaw.toString()} USDT) → Cozanet treasury`,
      });
    }

    // ── On-chain simulation ───────────────────────────────────────
    const warnings: string[] = [];
    let simulationPassed = true;

    try {
      const client = createPublicClient({
        chain:     chainCfg.chain,
        transport: http(chainCfg.rpcUrl),
      });

      await client.simulateContract({
        address:      tokenAddress,
        abi:          ERC20_ABI,
        functionName: "transfer",
        args:         [mainRecipient, tx.amountRaw],
        account:      tx.wallet as `0x${string}`,
      });
    } catch (err: any) {
      warnings.push(`Simulation: ${err?.shortMessage ?? err?.message ?? "RPC error"}`);
      simulationPassed = false;
    }

    // ── Advance to SIMULATED ──────────────────────────────────────
    await TransactionStateMachine.transition(transactionId, "SIMULATED");

    return {
      chainId:      tx.chainId,
      tokenAddress,
      transactions: txPayloads,
      simulation: {
        passed:   simulationPassed,
        warnings,
      },
    };
  }

  /** Advance SIMULATED → PENDING_SIGNATURE */
  static async requestSignature(transactionId: number): Promise<void> {
    await TransactionStateMachine.transition(transactionId, "PENDING_SIGNATURE");
  }

  /** Store tx hash and advance PENDING_SIGNATURE → SUBMITTED */
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
      throw new Error(
        `Transaction must be PENDING_SIGNATURE — current: ${tx.state}`
      );
    }

    await db
      .update(transactions)
      .set({ txHash, updatedAt: new Date() })
      .where(eq(transactions.id, transactionId));

    await TransactionStateMachine.transition(transactionId, "SUBMITTED");
  }
}
