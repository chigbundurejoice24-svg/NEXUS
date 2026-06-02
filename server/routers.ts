import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { portfolioRouter } from "./routers/portfolio";
import { walletsRouter } from "./routers/wallets";
import { accountsRouter } from "./routers/accounts";
import { transactionsRouter } from "./routers/transactions";

export const appRouter = router({
  system:       systemRouter,
  auth:         authRouter,       // register / login / me / logout
  portfolio:    portfolioRouter,
  wallets:      walletsRouter,
  accounts:     accountsRouter,
  transactions: transactionsRouter,
});

export type AppRouter = typeof appRouter;
