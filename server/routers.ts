import { systemRouter }      from "./_core/systemRouter";
import { router }            from "./_core/trpc";
import { authRouter }        from "./routers/auth";
import { portfolioRouter }   from "./routers/portfolio";
import { walletsRouter }     from "./routers/wallets";
import { accountsRouter }    from "./routers/accounts";
import { transactionsRouter } from "./routers/transactions";
import { cozanetRouter }     from "./routers/cozanet";
import { rampsRouter }       from "./routers/ramps";
import { adminRouter }       from "./routers/admin";

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
});

export type AppRouter = typeof appRouter;
