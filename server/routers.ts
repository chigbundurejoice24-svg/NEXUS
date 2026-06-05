/**
 * server/routers.ts — CANONICAL app router
 *
 * esbuild resolves `require("../server/routers")` to THIS FILE (file wins over dir).
 * All routers must be registered here. Keep in sync with server/routers/index.ts.
 */
import { systemRouter }       from "./_core/systemRouter";
import { router }             from "./_core/trpc";
import { authRouter }         from "./routers/auth";
import { portfolioRouter }    from "./routers/portfolio";
import { walletsRouter }      from "./routers/wallets";
import { accountsRouter }     from "./routers/accounts";
import { transactionsRouter } from "./routers/transactions";
import { cozanetRouter }      from "./routers/cozanet";
import { rampsRouter }        from "./routers/ramps";
import { adminRouter }        from "./routers/admin";
import { aiRouter }           from "./routers/ai";
import { supportRouter }      from "./routers/support";
import { notifyRouter }       from "./routers/notify";

export const appRouter = router({
  system:       systemRouter,
  auth:         authRouter,
  portfolio:    portfolioRouter,
  wallets:      walletsRouter,
  accounts:     accountsRouter,
  transactions: transactionsRouter,
  cozanet:      cozanetRouter,
  ramps:        rampsRouter,
  admin:        adminRouter,
  ai:           aiRouter,
  support:      supportRouter,
  notify:       notifyRouter,
});

export type AppRouter = typeof appRouter;
