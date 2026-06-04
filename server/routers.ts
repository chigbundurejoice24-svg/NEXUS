/**
 * server/routers.ts — App router (single source of truth)
 *
 * esbuild resolves require("../server/routers") to THIS file (file beats directory).
 * All routers must be registered here. Do NOT split across routers/index.ts.
 */
import { router } from "./_core/trpc";
import { authRouter }         from "./routers/auth";
import { accountsRouter }     from "./routers/accounts";
import { walletsRouter }      from "./routers/wallets";
import { rampsRouter }        from "./routers/ramps";
import { transactionsRouter } from "./routers/transactions";
import { cozanetRouter }      from "./routers/cozanet";
import { adminRouter }        from "./routers/admin";
import { portfolioRouter }    from "./routers/portfolio";
import { aiRouter }           from "./routers/ai";
import { supportRouter }      from "./routers/support";
import { notifyRouter }       from "./routers/notify";

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
