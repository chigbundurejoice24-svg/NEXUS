/**
 * useAuth.ts — passkey authentication hooks
 *
 * useCurrentUser()   → returns the authenticated user (real tRPC call)
 * usePasskeyLogin()  → browser WebAuthn get → server JWT
 * usePasskeyRegister() → browser WebAuthn create → server JWT
 * useLogout()        → clears JWT + invalidates query cache
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc, setToken, clearToken, getToken } from "../lib/trpc";

// ── Current user ─────────────────────────────────────────────────────────────
export function useCurrentUser() {
  const hasToken = !!getToken();
  const { data, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
    enabled: hasToken, // skip the network call entirely when not logged in
  });
  return {
    user: (data as any) ?? null,
    isLoading: hasToken ? isLoading : false,
    isAuthenticated: !!data,
    error,
  };
}

// ── Login with existing passkey ───────────────────────────────────────────────
export function usePasskeyLogin() {
  const loginMutation = trpc.auth.login.useMutation();
  const qc = useQueryClient();

  const login = useCallback(async () => {
    // 1. Ask the browser to present a stored passkey
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        userVerification: "preferred",
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;

    if (!assertion) throw new Error("No credential selected");

    const credentialId = btoa(String.fromCharCode(
      ...new Uint8Array(assertion.rawId)
    ));

    // 2. Exchange credentialId for JWT
    const result = await loginMutation.mutateAsync({ credentialId });
    setToken(result.token);

    // 3. Refresh auth state everywhere
    await qc.invalidateQueries();
    return result.user;
  }, [loginMutation, qc]);

  return { login, isPending: loginMutation.isPending, error: loginMutation.error };
}

// ── Register a new passkey ────────────────────────────────────────────────────
export function usePasskeyRegister() {
  const registerMutation = trpc.auth.register.useMutation();
  const qc = useQueryClient();

  const register = useCallback(async (displayName = "Aegis User") => {
    const userId = crypto.getRandomValues(new Uint8Array(16));

    // 1. Create a new passkey in the browser
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Aegis", id: window.location.hostname },
        user: { id: userId, name: displayName, displayName },
        pubKeyCredParams: [
          { alg: -7,   type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
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
    const publicKey   = btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey?.() || new ArrayBuffer(0))));

    // 2. Register on the server → get JWT
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
    window.location.href = "/";
  }, [qc]);
}
