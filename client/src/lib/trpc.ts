/**
 * trpc.ts — tRPC React client
 *
 * Automatically attaches the JWT from localStorage to every request.
 * The server reads it in context.ts via the Authorization header.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();

export const AUTH_TOKEN_KEY = "aegis_jwt";

export function getToken(): string | null {
  try { return localStorage.getItem(AUTH_TOKEN_KEY); }
  catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token); }
  catch {}
}
export function clearToken(): void {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); }
  catch {}
}

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: SuperJSON,
        headers() {
          const token = getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
