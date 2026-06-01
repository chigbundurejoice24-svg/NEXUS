/**
 * useAuth.ts
 * Returns the currently authenticated user from the tRPC auth.me procedure.
 */
import { trpc } from "../lib/trpc";

export function useCurrentUser() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();
  return { user: user ?? null, isLoading, isAuthenticated: !!user, error };
}
