/**
 * trpc.ts — tRPC React client for NEXUS
 * Attaches JWT from localStorage to every request.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";

export const trpc = createTRPCReact<any>();

export const AUTH_TOKEN_KEY = "nexus_jwt";
export const DEV_BYPASS_KEY = "nexus_dev_mode";

export function getToken(): string | null {
  try {
    // Dev bypass: if dev mode is set, return a placeholder that satisfies the guard
    if (localStorage.getItem(DEV_BYPASS_KEY) === "true") return "dev_bypass_token";
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }
  catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token); }
  catch {}
}
export function clearToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(DEV_BYPASS_KEY);
  }
  catch {}
}
export function enableDevBypass(): void {
  try { localStorage.setItem(DEV_BYPASS_KEY, "true"); }
  catch {}
}
export function isDevBypass(): boolean {
  try { return localStorage.getItem(DEV_BYPASS_KEY) === "true"; }
  catch { return false; }
}

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: SuperJSON,
        headers() {
          const token = localStorage.getItem(AUTH_TOKEN_KEY);
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
