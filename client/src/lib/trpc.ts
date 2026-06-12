/**
 * trpc.ts — tRPC client for NEXUS (no-auth mode)
 * getToken() always returns a guest token so API calls never 401.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";

export const trpc = createTRPCReact<any>();

export const AUTH_TOKEN_KEY  = "nexus_jwt";
export const DEV_BYPASS_KEY  = "nexus_dev_mode";
export const GUEST_TOKEN     = "nexus_guest_no_auth";

/** Always returns a token — no blank returns that trigger /auth redirects */
export function getToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) ?? GUEST_TOKEN;
  } catch {
    return GUEST_TOKEN;
  }
}
export function setToken(token: string): void {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token); } catch {}
}
export function clearToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(DEV_BYPASS_KEY);
  } catch {}
}
export function enableDevBypass(): void {
  try { localStorage.setItem(DEV_BYPASS_KEY, "true"); } catch {}
}
export function isDevBypass(): boolean {
  return true; // always in dev/preview mode
}

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: SuperJSON,
        headers() {
          try {
            const stored = localStorage.getItem(AUTH_TOKEN_KEY);
            return stored ? { Authorization: `Bearer ${stored}` } : {};
          } catch {
            return {};
          }
        },
      }),
    ],
  });
}
