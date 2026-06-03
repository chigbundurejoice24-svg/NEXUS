/**
 * confirmation-poller.ts
 *
 * Background job: scans SUBMITTED transactions, checks the chain,
 * advances state → CONFIRMED → calls OffRampService.initiatePayout → SETTLED.
 *
 * Triggered via GET /api/cron/confirmations (Vercel Cron, every minute).
 * Protected by CRON_SECRET header.
 */

import { getDb } from "../../db";
import { transactions } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { createPublicClient, http } from "viem";
import { mainnet, bsc, polygon, arbitrum } from "viem/chains";
import { TransactionStateMachine } from "./transaction-state-machine";
import { OffRampService } from "../ramps/offramp-service";

const CHAIN_CONFIG: Record<number, { chain: any; rpcUrl: string }> = {
  1:     { chain: mainnet,  rpcUrl: "https://eth.llamarpc.com" },
  56:    { chain: bsc,      rpcUrl: "https://bsc-dataseed.binance.org" },
  137:   { chain: polygon,  rpcUrl: "https://polygon-rpc.com" },
  42161: { chain: arbitrum, rpcUrl: "https://arb1.arbitrum.io/rpc" },
};

export async function pollConfirmations(): Promise<{
  checked: number;
  confirmed: number;
  settled: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { checked: 0, confirmed: 0, settled: 0, failed: 0 };

  // Fetch all SUBMITTED transactions (no age filter — check all)
  const submitted = await db
    .select()
    .from(transactions)
    .where(eq(transactions.state, "SUBMITTED"))
    .limit(50);

  let confirmed = 0, settled = 0, failed = 0;

  for (const tx of submitted) {
    if (!tx.txHash || !tx.chainId) continue;
    const config = CHAIN_CONFIG[tx.chainId];
    if (!config) continue;

    try {
      const client = createPublicClient({
        chain:     config.chain,
        transport: http(config.rpcUrl),
      });

      const receipt = await client.getTransactionReceipt({
        hash: tx.txHash as `0x${string}`,
      });

      if (receipt.status === "success") {
        // ── Advance to CONFIRMED ─────────────────────────────
        await TransactionStateMachine.transition(tx.id, "CONFIRMED");
        confirmed++;

        // ── Extract off-ramp metadata ─────────────────────────
        const meta = tx.metadata as Record<string, any> | null;
        const quoteId = meta?.quoteId as string | undefined;
        const bankDetails = meta?.bankDetails as {
          bankCode?: string;
          accountNumber?: string;
          accountName?: string;
          currency?: string;
        } | undefined;

        if (quoteId) {
          // ── Initiate bank payout via Transak ─────────────────
          const payoutResult = await OffRampService.initiatePayout({
            quoteId,
            transactionId: tx.id,
            bankCode:      bankDetails?.bankCode,
            accountNumber: bankDetails?.accountNumber,
            accountName:   bankDetails?.accountName,
            currency:      bankDetails?.currency ?? "NGN",
          });

          if (payoutResult.success) {
            console.log(
              `[Poller] Payout initiated for tx ${tx.id}. Ref: ${payoutResult.reference}`
            );
          } else {
            console.warn(`[Poller] Payout failed for tx ${tx.id} — still advancing to SETTLED`);
          }
        } else {
          // Crypto-to-crypto (no off-ramp needed) — settle immediately
          console.log(`[Poller] No quoteId for tx ${tx.id} — direct settle`);
        }

        // ── Advance to SETTLED regardless of payout success ───
        // Payout failure is logged; tx still settles on-chain.
        // Manual retry can be done from the admin console.
        await TransactionStateMachine.transition(tx.id, "SETTLED");
        settled++;
      } else if (receipt.status === "reverted") {
        await TransactionStateMachine.transition(tx.id, "FAILED");
        failed++;
        console.warn(`[Poller] Tx ${tx.id} reverted on-chain. Hash: ${tx.txHash}`);
      }
      // If receipt not found yet → transaction still pending, retry next poll
    } catch (err: any) {
      // RPC error or tx not yet mined — retry next run silently
      const msg = err?.message ?? "";
      if (!msg.includes("not found") && !msg.includes("could not be found")) {
        console.warn(`[Poller] Error checking tx ${tx.id}:`, msg.slice(0, 120));
      }
    }
  }

  return { checked: submitted.length, confirmed, settled, failed };
}
