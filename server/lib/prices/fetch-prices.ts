/**
 * fetch-prices.ts — Hardened Price Engine
 * Compatible with viem v2 (readContract returns tuple, not named object)
 */
import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { bsc } from 'viem/chains';

// ── BSC addresses ─────────────────────────────────────────────────────────
const COZANET_ADDRESS  = '0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA' as `0x${string}`;
const WBNB_ADDRESS     = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`;
const PANCAKE_FACTORY  = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as `0x${string}`;
const PANCAKE_ROUTER   = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as `0x${string}`;
const CHAINLINK_BNB_USD = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE' as `0x${string}`;

// ── CoinGecko map ─────────────────────────────────────────────────────────
const COINGECKO_ID_MAP: Record<string, string> = {
  'ethereum:ETH':'ethereum','ethereum:USDT':'tether','ethereum:USDC':'usd-coin',
  'ethereum:BTC':'bitcoin','ethereum:BNB':'binancecoin',
  'bsc:BNB':'binancecoin','bsc:USDT':'tether','bsc:USDC':'usd-coin',
  'bsc:ETH':'ethereum','bsc:BTC':'bitcoin',
  'polygon:MATIC':'matic-network','polygon:USDT':'tether','polygon:USDC':'usd-coin',
  'polygon:ETH':'ethereum','polygon:BTC':'bitcoin',
  'arbitrum:ETH':'ethereum','arbitrum:USDT':'tether','arbitrum:USDC':'usd-coin',
  'arbitrum:BTC':'bitcoin','arbitrum:BNB':'binancecoin',
  'bitcoin:BTC':'bitcoin',
};

// ── In-memory cache ───────────────────────────────────────────────────────
interface CacheEntry { prices: Record<string, number>; timestamp: number; }
const cgCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 60_000;

let _cozanetDecimals: number | null = null;
let _lastGoodCznPrice: number | null = null;
let _lastGoodWbnbPrice: number | null = null;
let _bscClient: ReturnType<typeof createPublicClient> | null = null;

function getBscClient() {
  if (!_bscClient) {
    _bscClient = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.binance.org') });
  }
  return _bscClient;
}

// ── CoinGecko ─────────────────────────────────────────────────────────────
async function fetchCoingeckoPrices(ids: string[]): Promise<Record<string, number>> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return {};
  const cacheKey = uniqueIds.sort().join(',');
  const now = Date.now();
  if (cgCache[cacheKey] && now - cgCache[cacheKey]!.timestamp < CACHE_TTL_MS) {
    return cgCache[cacheKey]!.prices;
  }
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd`);
    if (!res.ok) return cgCache[cacheKey]?.prices ?? {};
    const data: Record<string, { usd?: number }> = await res.json();
    const prices: Record<string, number> = {};
    for (const id of uniqueIds) prices[id] = data[id]?.usd ?? 0;
    cgCache[cacheKey] = { prices, timestamp: now };
    return prices;
  } catch {
    return cgCache[cacheKey]?.prices ?? {};
  }
}

// ── WBNB price via Chainlink → CoinGecko ─────────────────────────────────
async function fetchWbnbPrice(): Promise<number> {
  try {
    const client = getBscClient();
    // latestRoundData returns [roundId, answer, startedAt, updatedAt, answeredInRound]
    const result = await client.readContract({
      address: CHAINLINK_BNB_USD,
      abi: [{
        inputs: [], name: 'latestRoundData',
        outputs: [
          { name: 'roundId',       type: 'uint80'  },
          { name: 'answer',        type: 'int256'  },
          { name: 'startedAt',     type: 'uint256' },
          { name: 'updatedAt',     type: 'uint256' },
          { name: 'answeredInRound', type: 'uint80' },
        ],
        stateMutability: 'view', type: 'function',
      }] as const,
      functionName: 'latestRoundData',
    }) as readonly [bigint, bigint, bigint, bigint, bigint];
    const price = Number(result[1]) / 1e8;
    if (price > 50) { _lastGoodWbnbPrice = price; return price; }
  } catch { /* fall through */ }

  try {
    const prices = await fetchCoingeckoPrices(['binancecoin']);
    const price = prices['binancecoin'];
    if (price && price > 50) { _lastGoodWbnbPrice = price; return price; }
  } catch { /* fall through */ }

  if (_lastGoodWbnbPrice) return _lastGoodWbnbPrice;
  throw new Error('Cannot fetch WBNB/USD price');
}

// ── CZN decimals (cached) ─────────────────────────────────────────────────
async function getCznDecimals(): Promise<number> {
  if (_cozanetDecimals !== null) return _cozanetDecimals;
  try {
    const client = getBscClient();
    const dec = await client.readContract({
      address: COZANET_ADDRESS,
      abi: [{ inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' }] as const,
      functionName: 'decimals',
    }) as number;
    _cozanetDecimals = dec;
    return dec;
  } catch {
    _cozanetDecimals = 18;
    return 18;
  }
}

function validateCznPrice(p: number): number {
  if (_lastGoodCznPrice && (p > _lastGoodCznPrice * 5 || p < _lastGoodCznPrice * 0.2)) {
    console.warn(`[CZN] Price ${p} rejected, using last good ${_lastGoodCznPrice}`);
    return _lastGoodCznPrice;
  }
  if (p > 0) _lastGoodCznPrice = p;
  return p;
}

// ── Source 1: PancakeSwap reserve-based spot price ─────────────────────────
async function fetchCznFromReserves(): Promise<number | null> {
  try {
    const client = getBscClient();
    const pairAddress = await client.readContract({
      address: PANCAKE_FACTORY,
      abi: [{ inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], name: 'getPair', outputs: [{ name: 'pair', type: 'address' }], stateMutability: 'view', type: 'function' }] as const,
      functionName: 'getPair',
      args: [COZANET_ADDRESS, WBNB_ADDRESS],
    }) as `0x${string}`;

    if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') return null;

    const [token0, reserves] = await Promise.all([
      client.readContract({
        address: pairAddress,
        abi: [{ inputs: [], name: 'token0', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' }] as const,
        functionName: 'token0',
      }) as Promise<`0x${string}`>,
      client.readContract({
        address: pairAddress,
        abi: [{ inputs: [], name: 'getReserves', outputs: [{ name: 'reserve0', type: 'uint112' }, { name: 'reserve1', type: 'uint112' }, { name: 'blockTimestampLast', type: 'uint32' }], stateMutability: 'view', type: 'function' }] as const,
        functionName: 'getReserves',
      }) as Promise<readonly [bigint, bigint, number]>,
    ]);

    const dec = await getCznDecimals();
    const isCznToken0 = (token0 as string).toLowerCase() === COZANET_ADDRESS.toLowerCase();
    const cznReserve  = isCznToken0 ? (reserves as readonly [bigint,bigint,number])[0] : (reserves as readonly [bigint,bigint,number])[1];
    const wbnbReserve = isCznToken0 ? (reserves as readonly [bigint,bigint,number])[1] : (reserves as readonly [bigint,bigint,number])[0];

    const cznAmt  = parseFloat(formatUnits(cznReserve,  dec));
    const wbnbAmt = parseFloat(formatUnits(wbnbReserve, 18));
    if (cznAmt <= 0 || wbnbAmt <= 0) return null;

    const wbnbPrice = await fetchWbnbPrice();
    return wbnbPrice / (cznAmt / wbnbAmt);
  } catch (e) {
    console.warn('[CZN] Reserve price failed:', (e as Error).message?.slice(0,100));
    return null;
  }
}

// ── Source 2: PancakeSwap quote (0.001 WBNB) ─────────────────────────────
async function fetchCznFromQuote(): Promise<number | null> {
  try {
    const client = getBscClient();
    const dec = await getCznDecimals();
    const tinyInput = parseUnits('0.001', 18);
    const amounts = await client.readContract({
      address: PANCAKE_ROUTER,
      abi: [{ inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }], name: 'getAmountsOut', outputs: [{ name: 'amounts', type: 'uint256[]' }], stateMutability: 'view', type: 'function' }] as const,
      functionName: 'getAmountsOut',
      args: [tinyInput, [WBNB_ADDRESS, COZANET_ADDRESS]],
    }) as readonly bigint[];
    const cznOut = parseFloat(formatUnits(amounts[1]!, dec));
    if (cznOut <= 0) return null;
    const wbnbPrice = await fetchWbnbPrice();
    return (wbnbPrice * 0.001) / cznOut;
  } catch (e) {
    console.warn('[CZN] Quote price failed:', (e as Error).message?.slice(0,100));
    return null;
  }
}

// ── Source 3: DexScreener ─────────────────────────────────────────────────
async function fetchCznFromDexScreener(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${COZANET_ADDRESS}`);
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data?.pairs?.[0]?.priceUsd ?? '0');
    return price > 0 ? price : null;
  } catch { return null; }
}

// ── Main Cozanet price fetcher ─────────────────────────────────────────────
export async function fetchCozanetPrice(): Promise<number> {
  const p1 = await fetchCznFromReserves();
  if (p1 !== null) return validateCznPrice(p1);
  const p2 = await fetchCznFromQuote();
  if (p2 !== null) return validateCznPrice(p2);
  const p3 = await fetchCznFromDexScreener();
  if (p3 !== null) return validateCznPrice(p3);
  if (_lastGoodCznPrice) return _lastGoodCznPrice;
  throw new Error('No valid CZN price source available');
}

// ── Generic token prices ──────────────────────────────────────────────────
export async function fetchTokenPrices(assetKeys: string[]): Promise<Record<string, number>> {
  const cznKey = assetKeys.find(k => k === 'cozanet' || k.toUpperCase().includes('CZN'));
  const otherKeys = assetKeys.filter(k => k !== cznKey);
  const priceMap: Record<string, number> = {};

  if (cznKey) {
    try { priceMap[cznKey] = await fetchCozanetPrice(); }
    catch { priceMap[cznKey] = _lastGoodCznPrice ?? 0; }
  }

  const neededIds = otherKeys.map(k => COINGECKO_ID_MAP[k]).filter(Boolean) as string[];
  if (neededIds.length) {
    const cgPrices = await fetchCoingeckoPrices(neededIds);
    for (const key of otherKeys) {
      const cgId = COINGECKO_ID_MAP[key];
      priceMap[key] = cgId ? (cgPrices[cgId] ?? 0) : 0;
    }
  }
  return priceMap;
}

export async function getTokenPrice(assetKey: string): Promise<number> {
  return (await fetchTokenPrices([assetKey]))[assetKey] ?? 0;
}

export function clearPriceCache(): void {
  for (const key in cgCache) delete cgCache[key];
  _cozanetDecimals = null;
  _bscClient = null;
}
