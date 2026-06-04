/**
 * cozanet.ts — tRPC router
 *
 * Exposes Cozanet token status + DEX swap (buy) flow:
 *   getPrice  → public CZN/USD price
 *   getStatus → authenticated user discount tier, balance, fee preview
 *   buyQuote  → live USDT→CZN quote via PancakeSwap quoter (BSC, no API key)
 *   buy       → build unsigned tx batch: approve + swap + fee
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getConsolidatedWalletList } from "../lib/accounts/wallet-list";
import { buildPortfolio } from "../lib/wallets/portfolio-aggregator";
import {
  getCozanetBalance,
  getDiscountResult,
  calculateFeeRaw,
} from "../lib/cozanet/discount-calculator";
import { fetchTokenPrices } from "../lib/prices/fetch-prices";
import { TIER_DISPLAY, BASE_FEE_PERCENT, CZN_TOKEN } from "../lib/cozanet/discount-config";
import { encodeFunctionData, createPublicClient, http } from "viem";
import { bsc } from "viem/chains";

// ── Constants ──────────────────────────────────────────────────────
const BSC_USDT      = "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;
const CZN_ADDRESS   = "0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA" as `0x${string}`;
// PancakeSwap V2 Router on BSC (no API key needed, direct on-chain call)
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E" as `0x${string}`;
// PancakeSwap V2 quoter ABI (getAmountsOut)
const PANCAKE_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path",     type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn",     type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path",         type: "address[]" },
      { name: "to",           type: "address" },
      { name: "deadline",     type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount",    type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const BSC_RPC = process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org";

// ── Public: live CZN price ─────────────────────────────────────────
export const cozanetRouter = router({
  getPrice: publicProcedure.query(async () => {
    try {
      const prices = await fetchTokenPrices([CZN_TOKEN.coingeckoId]);
      const priceUsd = prices[CZN_TOKEN.coingeckoId] ?? 0;
      return { priceUsd, symbol: CZN_TOKEN.symbol };
    } catch {
      return { priceUsd: 0, symbol: CZN_TOKEN.symbol };
    }
  }),

  // ── Authenticated: full status with user discount tier ───────────
  getStatus: protectedProcedure
    .input(z.object({ exampleAmountUsdt: z.number().positive().optional() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user!.id;
      const walletList = await getConsolidatedWalletList(userId);
      const portfolio  = walletList.length > 0 ? await buildPortfolio(walletList) : { aggregatedAssets: [] };

      let priceUsd = 0;
      try {
        const prices = await fetchTokenPrices([CZN_TOKEN.coingeckoId]);
        priceUsd = prices[CZN_TOKEN.coingeckoId] ?? 0;
      } catch { /* non-fatal */ }

      const cznBalance = getCozanetBalance(portfolio as any);
      const discount   = getDiscountResult(cznBalance);

      let exampleFeeUsdt: string | null = null;
      if (input.exampleAmountUsdt) {
        const fee = (input.exampleAmountUsdt * discount.effectiveFeeBps) / 10000;
        exampleFeeUsdt = fee.toFixed(4);
      }

      return {
        priceUsd,
        pointsBalance:       cznBalance.toFixed(2),
        discountPercent:     discount.discountPercent,
        discountBps:         discount.discountBps,
        baseFeePercent:      BASE_FEE_PERCENT,
        effectiveFeePercent: discount.effectiveFeePercent,
        exampleFeeUsdt,
        tiers:               TIER_DISPLAY,
      };
    }),

  // ── Get a live DEX quote: USDT → CZN via PancakeSwap V2 on BSC ──
  buyQuote: protectedProcedure
    .input(z.object({
      usdtAmountRaw: z.string(), // USDT in smallest unit (18 decimals on BSC)
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const amountIn = BigInt(input.usdtAmountRaw);
      if (amountIn <= 0n) throw new TRPCError({ code: "BAD_REQUEST", message: "Amount must be > 0" });

      // 1. On-chain quote via PancakeSwap V2 getAmountsOut
      const client = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });

      let cozanetOutRaw: bigint;
      try {
        const amounts = await client.readContract({
          address:      PANCAKE_ROUTER,
          abi:          PANCAKE_ABI,
          functionName: "getAmountsOut",
          args:         [amountIn, [BSC_USDT, CZN_ADDRESS]],
        }) as bigint[];
        cozanetOutRaw = amounts[1];
      } catch (err: any) {
        throw new TRPCError({
          code:    "INTERNAL_SERVER_ERROR",
          message: `DEX quote failed: ${err?.shortMessage ?? err?.message ?? "RPC error"}`,
        });
      }

      // 2. Aegis fee with Cozanet discount
      const walletList = await getConsolidatedWalletList(ctx.user.id);
      const portfolio  = walletList.length > 0 ? await buildPortfolio(walletList) : { aggregatedAssets: [] };
      const cznBalance = getCozanetBalance(portfolio as any);
      const discount   = getDiscountResult(cznBalance);
      const feeRaw     = calculateFeeRaw(amountIn, cznBalance);

      // 3. Slippage: 1% minimum out
      const amountOutMin = (cozanetOutRaw * 99n) / 100n;

      return {
        usdtAmountRaw:   amountIn.toString(),
        cozanetOutRaw:   cozanetOutRaw.toString(),
        amountOutMin:    amountOutMin.toString(),
        feeRaw:          feeRaw.toString(),
        discountPercent: discount.discountPercent,
        effectiveFeePercent: discount.effectiveFeePercent,
        priceImpactWarning: cozanetOutRaw === 0n,
      };
    }),

  // ── Build unsigned tx batch: approve + swap + fee ─────────────────
  buy: protectedProcedure
    .input(z.object({
      usdtAmountRaw: z.string(),
      cozanetOutRaw: z.string(),
      amountOutMin:  z.string(),
      feeRaw:        z.string(),
      walletAddress: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const FEE_COLLECTOR = (process.env.FEE_COLLECTOR_ADDRESS
        ?? "0xb605333466d0122686511888bbb627a73f67f7e4") as `0x${string}`;

      const amountIn    = BigInt(input.usdtAmountRaw);
      const feeRaw      = BigInt(input.feeRaw);
      const totalNeeded = amountIn + feeRaw;
      const deadline    = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min

      // Tx 1: Approve USDT for PancakeSwap router (amount + fee)
      const approveTx = {
        to:    BSC_USDT,
        data:  encodeFunctionData({
          abi:          ERC20_ABI,
          functionName: "approve",
          args:         [PANCAKE_ROUTER, totalNeeded],
        }),
        value: "0",
        label: `Approve ${(Number(totalNeeded) / 1e18).toFixed(2)} USDT`,
      };

      // Tx 2: PancakeSwap swap — USDT → CZN
      const swapTx = {
        to:   PANCAKE_ROUTER,
        data: encodeFunctionData({
          abi:          PANCAKE_ABI,
          functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
          args:         [
            amountIn,
            BigInt(input.amountOutMin),
            [BSC_USDT, CZN_ADDRESS],
            input.walletAddress as `0x${string}`,
            deadline,
          ],
        }),
        value: "0",
        label: `Swap USDT → CZN on PancakeSwap`,
      };

      // Tx 3: Fee transfer to Aegis treasury (only if fee > 0)
      const txBatch = [approveTx, swapTx];
      if (feeRaw > 0n) {
        txBatch.push({
          to:   BSC_USDT,
          data: encodeFunctionData({
            abi:          ERC20_ABI,
            functionName: "transfer",
            args:         [FEE_COLLECTOR, feeRaw],
          }),
          value: "0",
          label: `Aegis fee (${(Number(feeRaw) / 1e18).toFixed(4)} USDT)`,
        });
      }

      return {
        transactions:  txBatch,
        chainId:       56,
        gasSponsored:  true,
      };
    }),
});
