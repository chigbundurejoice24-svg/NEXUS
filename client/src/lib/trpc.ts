/**
 * trpc.ts
 * tRPC React client — @trpc/react-query v11 compatible.
 * In v11, the transformer is passed to httpBatchLink, not the client root.
 *
 * When backend is offline (static Vercel deploy), queries fail gracefully
 * and pages fall back to their mock data.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";

// Import AppRouter type only — this is a type-only import
// so the server code is never bundled into the client
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        // v11: transformer lives here, on the link
        transformer: SuperJSON,
      }),
    ],
  });
}
