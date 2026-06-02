/**
 * trpc.ts
 * tRPC React client wired to the Express backend at /api/trpc.
 * When deployed as a pure static site (Vercel without the Express server),
 * queries will fail gracefully and pages fall back to mock data.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" &&
          (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        headers: () => ({
          "Content-Type": "application/json",
        }),
      }),
    ],
  });
}
