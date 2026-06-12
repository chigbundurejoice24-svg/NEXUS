/**
 * useAuth.ts — passkey authentication hooks (NEXUS)
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc, setToken, clearToken, getToken, isDevBypass } from "../lib/trpc";

// ── Dev mock user (used when dev bypass is active) ───────────────────────────
const DEV_USER = {
  id: 0,
  name: "Dev Preview",
  email: "dev@nexus.app",
  emailVerified: true,
  kycStatus: "VERIFIED",
  isAdmin: true,
  walletAddress: null as string | null,
};

// ── Current user ─────────────────────────────────────────────────────────────
export function useCurrentUser() {
  const devMode = isDevBypass();
  const hasToken = !!getToken() && !devMode;

  const { data, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchOnMount: true,
    enabled: hasToken,
  });

  if (devMode) {
    return {
      user: DEV_USER,
      isLoading: false,
      isAuthenticated: true,
      isAdmin: true,
      walletAddress: DEV_USER.walletAddress,
      error: null,
    };
  }

  const raw = (data as any) ?? null;
  return {
    user: raw,
    isLoading: hasToken ? isLoading : false,
    isAuthenticated: !!data,
    isAdmin: !!raw?.isAdmin,
    walletAddress: (raw?.walletAddress as string | null) ?? null,
    error,
  };
}

// ── Login with existing passkey ───────────────────────────────────────────────
export function usePasskeyLogin() {
  const loginMutation = trpc.auth.login.useMutation();
  const qc = useQueryClient();
  const login = useCallback(async () => {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        userVerification: "preferred",
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;
    if (!assertion) throw new Error("No credential selected");
    const credentialId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
    const result = await loginMutation.mutateAsync({ credentialId });
    setToken(result.token);
    await qc.invalidateQueries();
    return result.user;
  }, [loginMutation, qc]);
  return { login, isPending: loginMutation.isPending, error: loginMutation.error };
}

// ── Register a new passkey ────────────────────────────────────────────────────
export function usePasskeyRegister() {
  const registerMutation = trpc.auth.register.useMutation();
  const qc = useQueryClient();
  const register = useCallback(async (displayName = "Nexus User") => {
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "NEXUS", id: window.location.hostname },
        user: { id: userId, name: displayName, displayName },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;
    if (!credential) throw new Error("Passkey creation cancelled");
    const response = credential.response as AuthenticatorAttestationResponse;
    const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    const publicKey = btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey?.() || new ArrayBuffer(0))));
    const result = await registerMutation.mutateAsync({ credentialId, publicKey, displayName });
    setToken(result.token);
    await qc.invalidateQueries();
    return result.user;
  }, [registerMutation, qc]);
  return { register, isPending: registerMutation.isPending, error: registerMutation.error };
}

// ── Logout ────────────────────────────────────────────────────────────────────
export function useLogout() {
  const qc = useQueryClient();
  return useCallback(() => {
    clearToken();
    qc.clear();
    window.location.href = "/auth";
  }, [qc]);
}
