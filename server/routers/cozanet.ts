/**
 * cozanet.ts — tRPC router for CZN token operations
 *
 * Verified 2026-06-05:
 *   CZN = 0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA (BSC BEP-20)
 *   Decimals: 9 (NOT 18)
 *   No direct USDT/CZN pair — route: USDT → WBNB → CZN
 *   CZN/WBNB pair: 0xdf7576158840899eeab2081fd0ed46e3428a4c0d
 *
 * Gas model: Aegis sponsors gas (ZeroDev paymaster).
 *   Aegis fee is charged in USDT from the user's wallet (separate transfer tx).
 *   User needs 0 BNB — fee deducted in USDT only.
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
import {
  TIER_DISPLAY, BASE_FEE_PERCENT, CZN_TOKEN, SWAP_ROUTE
} from "../lib/cozanet/discount-config";
import { encodeFunctionData, createPublicClient, http } from "viem";
import { bsc } from "viem/chains";

// ── Verified constants ─────────────────────────────────────────────
const CZN_ADDRESS    = CZN_TOKEN.address;       // 0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA
const CZN_DECIMALS   = CZN_TOKEN.decimals;      // 9
const BSC_USDT       = SWAP_ROUTE.USDT;         // 0x55d398326f99059fF775485246999027B3197955
const WBNB           = SWAP_ROUTE.WBNB;         // 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
const SWAP_PATH      = SWAP_ROUTE.path;         // USDT → WBNB → CZN

// PancakeSwap V2 Router — unchanged, always live on BSC
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E" as `0x${string}`;

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
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const BSC_RPC = process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org";

export const cozanetRouter = router({

  // ── Public: live CZN price ──────────────────────────────────────
  getPrice: publicProcedure.query(async () => {
    try {
      const prices = await fetchTokenPrices([CZN_TOKEN.coingeckoId]);
      const priceUsd = prices[CZN_TOKEN.coingeckoId] ?? 0;
      return { priceUsd, symbol: CZN_TOKEN.symbol, decimals: CZN_DECIMALS };
    } catch {
      return { priceUsd: 0, symbol: CZN_TOKEN.symbol, decimals: CZN_DECIMALS };
    }
  }),

  // ── Authenticated: discount tier + balance ───────────────────────
  getStatus: protectedProcedure
    .input(z.object({ exampleAmountUsdt: z.number().positive().optional() }))
    .query(async ({ input, ctx }) => {
      const walletList = await getConsolidatedWalletList(ctx.user!.id);
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
        contractAddress:     CZN_ADDRESS,
        decimals:            CZN_DECIMALS,
        pancakeswapUrl:      CZN_TOKEN.pancakeswapUrl,
        bscscanUrl:          CZN_TOKEN.bscscanUrl,
      };
    }),

  // ── Live DEX quote: USDT → WBNB → CZN ───────────────────────────
  buyQuote: protectedProcedure
    .input(z.object({
      usdtAmountRaw: z.string(), // USDT in raw units (18 decimals on BSC)
    }))
    .query(async ({ input, ctx }) => {
      const amountIn = BigInt(input.usdtAmountRaw);
      if (amountIn <= 0n) throw new TRPCError({ code: "BAD_REQUEST", message: "Amount must be > 0" });

      // On-chain quote: USDT → WBNB → CZN (3-hop)
      const client = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });

      let cozanetOutRaw: bigint;
      let midAmounts: readonly bigint[];
      try {
        midAmounts = await (client.readContract as any)({
          address:      PANCAKE_ROUTER,
          abi:          PANCAKE_ABI,
          functionName: "getAmountsOut",
          args:         [amountIn, SWAP_PATH],
        }) as readonly bigint[];
        // amounts = [USDT_in, WBNB_mid, CZN_out]
        cozanetOutRaw = midAmounts[2];
      } catch (err: any) {
        throw new TRPCError({
          code:    "INTERNAL_SERVER_ERROR",
          message: `DEX quote failed: ${err?.shortMessage ?? err?.message ?? "RPC error"}`,
        });
      }

      if (!cozanetOutRaw || cozanetOutRaw === 0n) {
        throw new TRPCError({
          code:    "BAD_REQUEST",
          message: "No liquidity available for this pair. Try a smaller amount.",
        });
      }

      // Aegis fee (charged in USDT from wallet — gas is sponsored separately)
      const walletList = await getConsolidatedWalletList(ctx.user!.id);
      const portfolio  = walletList.length > 0 ? await buildPortfolio(walletList) : { aggregatedAssets: [] };
      const cznBalance = getCozanetBalance(portfolio as any);
      const discount   = getDiscountResult(cznBalance);
      const feeRaw     = calculateFeeRaw(amountIn, cznBalance);

      // 1% slippage protection
      const amountOutMin = (cozanetOutRaw * 99n) / 100n;

      // Human-readable price: USDT per CZN
      const usdtFloat     = Number(amountIn)       / 1e18;
      const cznFloat      = Number(cozanetOutRaw)  / 10**CZN_DECIMALS;
      const pricePerToken = cznFloat > 0 ? (usdtFloat / cznFloat).toFixed(8) : "0";

      return {
        usdtAmountRaw:       amountIn.toString(),
        cozanetOutRaw:       cozanetOutRaw.toString(),
        amountOutMin:        amountOutMin.toString(),
        feeRaw:              feeRaw.toString(),
        discountPercent:     discount.discountPercent,
        effectiveFeePercent: discount.effectiveFeePercent,
        pricePerToken,         // USDT per 1 CZN
        priceImpactWarning:  cozanetOutRaw < (amountIn / 100n), // rough check
        route:               "USDT → WBNB → CZN",
        cznDecimals:         CZN_DECIMALS,
      };
    }),

  // ── Build unsigned tx batch ──────────────────────────────────────
  // Tx 1: Approve USDT for PancakeSwap (swap amount + fee)
  // Tx 2: Swap USDT → WBNB → CZN
  // Tx 3: Transfer USDT fee to Aegis treasury (gas-free for user — fee in USDT)
  // Gas: sponsored via ZeroDev paymaster — user pays 0 BNB
  buy: protectedProcedure
    .input(z.object({
      usdtAmountRaw: z.string(),
      cozanetOutRaw: z.string(),
      amountOutMin:  z.string(),
      feeRaw:        z.string(),
      walletAddress: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const FEE_COLLECTOR = (process.env.FEE_COLLECTOR_ADDRESS
        ?? "0xb605333466d0122686511888bbb627a73f67f7e4") as `0x${string}`;

      const amountIn    = BigInt(input.usdtAmountRaw);
      const feeRaw      = BigInt(input.feeRaw);
      const totalNeeded = amountIn + feeRaw; // total USDT to approve
      const deadline    = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min

      // Tx 1: Approve USDT → PancakeSwap Router (swap + fee combined approval)
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

      // Tx 2: Swap USDT → WBNB → CZN (3-hop route, no direct pair)
      const swapTx = {
        to:   PANCAKE_ROUTER,
        data: encodeFunctionData({
          abi:          PANCAKE_ABI,
          functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
          args:         [
            amountIn,
            BigInt(input.amountOutMin),
            SWAP_PATH,  // [USDT, WBNB, CZN]
            input.walletAddress as `0x${string}`,
            deadline,
          ],
        }),
        value: "0",
        label: `Swap USDT → CZN via PancakeSwap (USDT → WBNB → CZN)`,
      };

      const txBatch = [approveTx, swapTx];

      // Tx 3: Aegis fee — deducted in USDT from wallet (gas-free for user)
      if (feeRaw > 0n) {
        txBatch.push({
          to:   BSC_USDT,
          data: encodeFunctionData({
            abi:          ERC20_ABI,
            functionName: "transfer",
            args:         [FEE_COLLECTOR, feeRaw],
          }),
          value: "0",
          label: `Aegis fee (${(Number(feeRaw) / 1e18).toFixed(4)} USDT) — deducted from wallet`,
        });
      }

      return {
        transactions: txBatch,
        chainId:      56,
        gasSponsored: true,  // ZeroDev paymaster covers BNB gas cost
        feeNote:      "Gas is sponsored by Aegis. Fee deducted in USDT from your wallet.",
      };
    }),
});
