/**
 * smart-account-signer.ts
 *
 * Client-side helper that signs and broadcasts a built transaction payload.
 * Supports two wallet types:
 *   - EMBEDDED: ZeroDev passkey smart account (WebAuthn / biometrics)
 *   - EXTERNAL: MetaMask or any EIP-1193 browser wallet via window.ethereum
 *
 * After broadcasting, calls the tRPC submit endpoint to record the tx hash.
 * The state machine then moves: PENDING_SIGNATURE → SUBMITTED.
 *
 * NOTE: This module is browser-only. Never import it on the server.
 */

import { createWalletClient, custom, type WalletClient, type Chain } from "viem";
import { mainnet, bsc, polygon, arbitrum } from "viem/chains";

// ── Chain lookup ───────────────────────────────────────────────────
const CHAINS: Record<number, Chain> = {
  1:     mainnet,
  56:    bsc,
  137:   polygon,
  42161: arbitrum,
};

// ── Transaction payload (matches server BuildPayload) ─────────────
export interface TxItem {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;  // "0" for ERC-20 transfers
  label: string;
}

export interface SignAndBroadcastParams {
  transactionId: number;
  chainId: number;
  transactions: TxItem[];
  walletType: "EMBEDDED" | "EXTERNAL";
  /** 
   * For EXTERNAL wallets: pass the wallet client obtained from useWalletClient().
   * The hook result must be passed in — never call wagmi hooks inside async fns.
   */
  externalWalletClient?: WalletClient | null;
}

/**
 * Sign and broadcast the built transaction payload.
 * Returns the final tx hash that was submitted.
 */
export async function signAndBroadcast(
  params: SignAndBroadcastParams,
  /** tRPC utils for calling the submit mutation — pass from component */
  submitFn: (transactionId: number, txHash: string) => Promise<void>,
): Promise<string> {
  const { transactionId, chainId, transactions: txItems, walletType } = params;

  if (walletType === "EMBEDDED") {
    return _signEmbedded(transactionId, chainId, txItems, submitFn);
  } else {
    return _signExternal(transactionId, chainId, txItems, params.externalWalletClient, submitFn);
  }
}

// ── EMBEDDED wallet (ZeroDev passkey smart account) ───────────────
async function _signEmbedded(
  transactionId: number,
  chainId: number,
  txItems: TxItem[],
  submitFn: (id: number, hash: string) => Promise<void>,
): Promise<string> {
  // Dynamically import ZeroDev to keep it tree-shaken when not used
  const { getSmartAccountClient, deploySmartAccountIfNeeded } =
    await import("../../../server/lib/accounts/smart-account");

  const credentialId = localStorage.getItem("aegis_credential_id");
  if (!credentialId) {
    throw new Error("No embedded wallet found. Please create a passkey wallet first.");
  }

  const smartAccount = await (getSmartAccountClient as any)(credentialId);
  await (deploySmartAccountIfNeeded as any)(smartAccount);

  // Send as a batch (ERC-4337 UserOperation)
  const txHash: string = await smartAccount.sendTransactions({
    transactions: txItems.map((t) => ({
      to:    t.to,
      data:  t.data,
      value: BigInt(t.value || "0"),
    })),
  });

  await submitFn(transactionId, txHash);
  return txHash;
}

// ── EXTERNAL wallet (MetaMask / EIP-1193) ─────────────────────────
async function _signExternal(
  transactionId: number,
  chainId: number,
  txItems: TxItem[],
  walletClient: WalletClient | null | undefined,
  submitFn: (id: number, hash: string) => Promise<void>,
): Promise<string> {
  // Fallback: build a walletClient from window.ethereum if none passed
  let client = walletClient;
  if (!client) {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error("No wallet connected. Please install MetaMask or connect a wallet.");
    }
    const chain = CHAINS[chainId];
    if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

    client = createWalletClient({
      chain,
      transport: custom(ethereum),
    });
  }

  // Send transactions sequentially (no multicall assumed for external wallets)
  let lastHash = "";
  for (const tx of txItems) {
    const hash = await client.sendTransaction({
      to:    tx.to,
      data:  tx.data,
      value: BigInt(tx.value || "0"),
      chain: CHAINS[chainId],
      account: client.account ?? undefined,
    } as any);
    lastHash = hash;
  }

  if (!lastHash) throw new Error("No transactions were sent");

  await submitFn(transactionId, lastHash);
  return lastHash;
}
