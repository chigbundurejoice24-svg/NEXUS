/**
 * wallet-list.ts
 * Returns a deduplicated, consolidated wallet list across personal + business wallets.
 * Falls back to the user's embedded walletAddress if no linked_wallets rows exist yet.
 */

import { getUserWalletAddresses, getBusinessWalletAddresses } from "./account-service";
import { getDb } from "../../db";
import { users } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface ConsolidatedWallet {
  address: `0x${string}`;
  chainId: number;
  label?: string;
}

export async function getConsolidatedWalletList(
  userId: number,
  businessIds?: number[]
): Promise<ConsolidatedWallet[]> {
  // Fetch personal wallets from linked_wallets table
  const personal = await getUserWalletAddresses(userId);

  // Fetch all business wallets in one go (Promise.all → flat)
  const bizWallets: { address: string; chainId: number; label?: string | null }[] = [];
  if (businessIds && businessIds.length > 0) {
    const batches = await Promise.all(businessIds.map((id) => getBusinessWalletAddresses(id)));
    batches.flat().forEach((w) => bizWallets.push(w));
  }

  // Fallback: if no linked_wallets rows exist yet, use the embedded walletAddress
  // stored directly on the users row (set during registration)
  let fallback: { address: string; chainId: number; label?: string | null }[] = [];
  if (personal.length === 0 && bizWallets.length === 0) {
    try {
      const db = await getDb();
      if (db) {
        const [row] = await db
          .select({ walletAddress: users.walletAddress })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (row?.walletAddress) {
          fallback = [{
            address: row.walletAddress,
            chainId: 56, // BSC — the default embedded chain
            label: "My Aegis Wallet",
          }];
        }
      }
    } catch { /* non-fatal */ }
  }

  // Deduplicate by lowercase address + chainId
  const seen = new Map<string, ConsolidatedWallet>();
  for (const w of [...personal, ...bizWallets, ...fallback]) {
    const key = `${w.address.toLowerCase()}:${w.chainId}`;
    if (!seen.has(key)) {
      seen.set(key, {
        address: w.address.toLowerCase() as `0x${string}`,
        chainId: w.chainId,
        label: w.label ?? undefined,
      });
    }
  }

  return [...seen.values()];
}
