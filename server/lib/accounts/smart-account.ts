/**
 * smart-account.ts
 *
 * CLIENT-SIDE ONLY — do not import this on the server.
 * Uses the ZeroDev SDK to create/deploy WebAuthn-backed smart accounts.
 *
 * ──────────────────────────────────────────────────────────────────
 * Front-end flow:
 *  1. User creates a passkey via @simplewebauthn/browser (registration)
 *  2. Browser sends { credentialId, publicKey } to the backend (no private key)
 *  3. Call getCounterfactualAddress(credentialId) to get the smart wallet address
 *  4. Display address to user — no deployment yet (no gas needed)
 *  5. On first transaction, call deploySmartAccountIfNeeded(client) to deploy
 * ──────────────────────────────────────────────────────────────────
 */

import { type SmartAccountClient, createSmartAccountClient } from "@zerodev/sdk";
import { toWebAuthnKey, toSmartAccount } from "@zerodev/sdk/passkey";
import { polygon } from "viem/chains";
import { http } from "viem";

// Provider abstraction — swap ZeroDev for another AA provider here
export interface WalletProvider {
  getAddress(): `0x${string}`;
  signUserOperation?(op: unknown): Promise<unknown>;
  deployIfNeeded(): Promise<void>;
}

const DEFAULT_CHAIN = polygon;
const BUNDLER_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ZERODEV_BUNDLER_URL) ||
  "https://rpc.zerodev.app";
const PAYMASTER_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ZERODEV_PAYMASTER_URL) ||
  "https://paymaster.zerodev.app";

/** Get a counterfactual smart account address without deploying */
export async function getCounterfactualAddress(credentialId: string): Promise<`0x${string}`> {
  const key = await toWebAuthnKey({ credentialId });
  const client = createSmartAccountClient({
    chain: DEFAULT_CHAIN,
    transport: http(BUNDLER_URL),
  });
  const account = await toSmartAccount({ client, signer: key });
  return (account as any).account.address as `0x${string}`;
}

/** Build a fully operational smart account client (with paymaster for gas sponsorship) */
export async function getSmartAccountClient(credentialId: string): Promise<SmartAccountClient> {
  const key = await toWebAuthnKey({ credentialId });
  const client = createSmartAccountClient({
    chain: DEFAULT_CHAIN,
    transport: http(BUNDLER_URL),
  });
  return toSmartAccount({ client, signer: key, paymaster: { url: PAYMASTER_URL } }) as Promise<SmartAccountClient>;
}

/** Deploy the smart account on-chain if it hasn't been deployed yet */
export async function deploySmartAccountIfNeeded(account: SmartAccountClient): Promise<void> {
  if (!(await (account as any).isDeployed())) {
    await (account as any).deploy();
    console.log("[SmartAccount] Deployed:", (account as any).account?.address);
  }
}
