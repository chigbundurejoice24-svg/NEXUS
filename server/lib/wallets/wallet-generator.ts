/**
 * wallet-generator.ts
 *
 * Derives a deterministic embedded wallet address from the user's passkey
 * credentialId using keccak256. No private key is generated or stored —
 * the wallet is a receive-only address for on-ramp deposits in Phase 1.
 * In Phase 2 (Turnkey / Account Abstraction), a real smart wallet is created.
 */
import { keccak256, toBytes, toHex } from "viem";

/**
 * Derive a deterministic EVM address from a passkey credentialId.
 * The credentialId is already a base64 string unique to the user's device.
 */
export function deriveWalletAddress(credentialId: string): `0x${string}` {
  const hash = keccak256(toBytes(credentialId));
  // EVM address = last 20 bytes of keccak hash
  const address = ("0x" + hash.slice(-40)) as `0x${string}`;
  return address;
}

/**
 * BSC chain ID — default chain for Aegis embedded wallets (Phase 1).
 * USDT on BSC (BEP20) is the primary asset for remittance.
 */
export const EMBEDDED_WALLET_CHAIN_ID = 56; // BSC
