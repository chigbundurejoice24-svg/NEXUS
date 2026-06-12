/**
 * useAuth.ts — Auth-free mode. Always returns a guest user.
 * No redirects, no token checks, no network calls for auth.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// ── Global guest user (used everywhere) ──────────────────────────────────────
export const GUEST_USER = {
  id: 1,
  name: "Rejoice",
  email: "user@nexus.app",
  emailVerified: true,
  kycStatus: "VERIFIED",
  isAdmin: true,
  walletAddress: null as string | null,
  aegisId: "NEX-00000001",
};

export function useCurrentUser() {
  return {
    user: GUEST_USER,
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    walletAddress: GUEST_USER.walletAddress,
    error: null,
  };
}

// Legacy hooks kept for pages that import them — they're no-ops now
export function usePasskeyLogin() {
  return { login: async () => GUEST_USER, isPending: false, error: null };
}
export function usePasskeyRegister() {
  return { register: async () => GUEST_USER, isPending: false, error: null };
}
export function useLogout() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.clear();
    window.location.href = "/";
  }, [qc]);
}
