import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 s — prices refresh fast enough
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
