/**
 * wallet-list.ts
 * Returns a deduplicated, consolidated wallet list across personal + business wallets.
 * Uses batch queries to minimise DB round-trips.
 */

import { getUserWalletAddresses, getBusinessWalletAddresses } from "./account-service";

export interface ConsolidatedWallet {
  address: `0x${string}`;
  chainId: number;
  label?: string;
}

export async function getConsolidatedWalletList(
  userId: number,
  businessIds?: number[]
): Promise<ConsolidatedWallet[]> {
  // Fetch personal wallets
  const personal = await getUserWalletAddresses(userId);

  // Fetch all business wallets in one go (Promise.all → flat)
  const bizWallets: { address: string; chainId: number; label?: string | null }[] = [];
  if (businessIds && businessIds.length > 0) {
    const batches = await Promise.all(businessIds.map((id) => getBusinessWalletAddresses(id)));
    batches.flat().forEach((w) => bizWallets.push(w));
  }

  // Deduplicate by lowercase address + chainId
  const seen = new Map<string, ConsolidatedWallet>();
  for (const w of [...personal, ...bizWallets]) {
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
