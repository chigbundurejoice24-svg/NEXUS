/**
 * confirmation-poller.ts
 * Background job: scans SUBMITTED transactions, checks blockchain, advances state.
 * Triggered by /api/cron/confirmations (Vercel Cron).
 */
import { getDb } from "../../db";
import { transactions } from "../../../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { createPublicClient, http } from "viem";
import { mainnet, bsc, polygon, arbitrum } from "viem/chains";
import { TransactionStateMachine } from "./transaction-state-machine";

const CHAIN_CONFIG: Record<number, { chain: any; rpcUrl: string }> = {
  1:     { chain: mainnet,  rpcUrl: "https://eth.llamarpc.com" },
  56:    { chain: bsc,      rpcUrl: "https://bsc-dataseed.binance.org" },
  137:   { chain: polygon,  rpcUrl: "https://polygon-rpc.com" },
  42161: { chain: arbitrum, rpcUrl: "https://arb1.arbitrum.io/rpc" },
};

export async function pollConfirmations(): Promise<{ checked: number; confirmed: number; failed: number }> {
  const db = await getDb();
  if (!db) return { checked: 0, confirmed: 0, failed: 0 };

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const submitted = await db.select().from(transactions)
    .where(and(eq(transactions.state, "SUBMITTED"), lt(transactions.updatedAt, tenMinutesAgo)))
    .limit(50);

  let confirmed = 0, failed = 0;

  for (const tx of submitted) {
    if (!tx.txHash || !tx.chainId) continue;
    const config = CHAIN_CONFIG[tx.chainId];
    if (!config) continue;

    try {
      const client = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
      const receipt = await client.getTransactionReceipt({ hash: tx.txHash as `0x${string}` });
      if (receipt.status === "success") {
        await TransactionStateMachine.transition(tx.id, "CONFIRMED");
        await TransactionStateMachine.transition(tx.id, "SETTLED");
        confirmed++;
      } else if (receipt.status === "reverted") {
        await TransactionStateMachine.transition(tx.id, "FAILED");
        failed++;
      }
    } catch {
      // RPC down or tx not yet mined — retry next run
    }
  }

  return { checked: submitted.length, confirmed, failed };
}
