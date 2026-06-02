/**
 * useAuth.ts
 * Returns the current authenticated user.
 */
import { trpc } from "../lib/trpc";
import type { TrpcUser } from "../lib/app-router-type";

export function useCurrentUser() {
  const { data, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const user = (data as TrpcUser | null | undefined) ?? null;
  return { user, isLoading, isAuthenticated: !!user, error };
}
