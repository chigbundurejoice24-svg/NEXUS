/**
 * useAuth.ts
 * Returns the currently authenticated user from tRPC auth.me.
 * Returns null gracefully when backend is not reachable.
 */
import { trpc } from "../lib/trpc";

export function useCurrentUser() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
