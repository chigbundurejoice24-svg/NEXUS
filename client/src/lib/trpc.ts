/**
 * trpc.ts
 * tRPC React client — fully client-side, zero server imports.
 *
 * We use `any` for AppRouter here to avoid Vite bundling server code.
 * Type safety is enforced at the hook level (useWallets, useRates, etc.)
 * by using explicit return types and response shapes.
 *
 * @trpc/react-query v11: transformer goes in httpBatchLink, not the client root.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import SuperJSON from "superjson";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: SuperJSON,
      }),
    ],
  });
}
