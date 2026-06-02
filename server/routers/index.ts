/**
 * server/routers/index.ts — App router barrel
 * Combines all sub-routers into a single tRPC appRouter.
 */
import { router } from "../_core/trpc";
import { authRouter }         from "./auth";
import { accountsRouter }     from "./accounts";
import { walletsRouter }      from "./wallets";
import { rampsRouter }        from "./ramps";
import { transactionsRouter } from "./transactions";
import { cozanetRouter }      from "./cozanet";
import { adminRouter }        from "./admin";
import { portfolioRouter }    from "./portfolio";

export const appRouter = router({
  auth:         authRouter,
  accounts:     accountsRouter,
  wallets:      walletsRouter,
  ramps:        rampsRouter,
  transactions: transactionsRouter,
  cozanet:      cozanetRouter,
  admin:        adminRouter,
  portfolio:    portfolioRouter,
});

export type AppRouter = typeof appRouter;
