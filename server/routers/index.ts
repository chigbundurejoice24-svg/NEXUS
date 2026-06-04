/**
 * server/routers/index.ts — App router barrel
 * Last updated: fixes notify + admin broadcast
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
import { aiRouter }           from "./ai";
import { supportRouter }       from "./support";
import { notifyRouter }        from "./notify";

export const appRouter = router({
  auth:         authRouter,
  accounts:     accountsRouter,
  wallets:      walletsRouter,
  ramps:        rampsRouter,
  transactions: transactionsRouter,
  cozanet:      cozanetRouter,
  admin:        adminRouter,
  portfolio:    portfolioRouter,
  ai:           aiRouter,
  support:      supportRouter,
  notify:       notifyRouter,
});

export type AppRouter = typeof appRouter;

