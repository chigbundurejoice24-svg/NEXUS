/**
 * auth.ts
 * Thin auth guard — validates that a tRPC context has an authenticated user.
 * Extend with JWT validation or session lookup as needed.
 *
 * NOTE: In tRPC we use `protectedProcedure` from server/_core/trpc.ts.
 * This helper is for use in non-tRPC service calls (e.g. REST endpoints, scripts).
 */

import { TRPCError } from "@trpc/server";

/**
 * Asserts that a userId is present. Throws a tRPC UNAUTHORIZED error if not.
 * Usage: const userId = requireAuth(ctx.user?.id)
 */
export function requireAuth(userId: number | undefined): number {
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action",
    });
  }
  return userId;
}
