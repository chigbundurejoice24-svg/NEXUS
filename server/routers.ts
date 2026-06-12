/**
 * server/routers.ts — NEXUS app router
 * All routers registered here.
 */
import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { portfolioRouter } from "./routers/portfolio";
import { walletsRouter } from "./routers/wallets";
import { accountsRouter } from "./routers/accounts";
import { transactionsRouter } from "./routers/transactions";
import { cozanetRouter } from "./routers/cozanet";
import { rampsRouter } from "./routers/ramps";
import { adminRouter } from "./routers/admin";
import { aiRouter } from "./routers/ai";
import { supportRouter } from "./routers/support";
import { notifyRouter } from "./routers/notify";
import { referralsRouter } from "./routers/referrals";
import { preferencesRouter } from "./routers/preferences";
import { exchangeRouter } from "./routers/exchange";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  portfolio: portfolioRouter,
  wallets: walletsRouter,
  accounts: accountsRouter,
  transactions: transactionsRouter,
  cozanet: cozanetRouter,
  ramps: rampsRouter,
  admin: adminRouter,
  ai: aiRouter,
  support: supportRouter,
  notify: notifyRouter,
  referrals: referralsRouter,
  preferences: preferencesRouter,
  exchange: exchangeRouter,
});

export type AppRouter = typeof appRouter;
