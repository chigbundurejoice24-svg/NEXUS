/**
 * fetch-prices.ts — Hardened Price Engine
 * 
 * Cozanet (CZN): multi-source on-chain priority chain
 *   1. PancakeSwap reserve-based spot price (no slippage, most accurate)
 *   2. PancakeSwap getAmountsOut quote (0.001 WBNB input, minimal slippage)
 *   3. DexScreener API fallback
 *   4. Last known good price cache
 * 
 * WBNB/USD: Chainlink BSC oracle → CoinGecko fallback
 * All other tokens: CoinGecko with in-memory cache (1 min TTL)
 */
import { createPublicClient, http, getContract, parseUnits, formatUnits } from 'viem';
import { bsc } from 'viem/chains';

// ── BSC contract addresses ─────────────────────────────────────────────────
const COZANET_ADDRESS  = '0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA' as `0x${string}`;
const WBNB_ADDRESS     = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`;
const PANCAKE_FACTORY  = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as `0x${string}`;
const PANCAKE_ROUTER   = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as `0x${string}`;
const CHAINLINK_BNB_USD = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE' as `0x${string}`;

const PANCAKE_PAIR_ABI = [
  { inputs: [], name: 'getReserves', outputs: [{ name: 'reserve0', type: 'uint112' }, { name: 'reserve1', type: 'uint112' }, { name: 'blockTimestampLast', type: 'uint32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token0', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

const FACTORY_ABI = [
  { inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], name: 'getPair', outputs: [{ name: 'pair', type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

const ERC20_DECIMALS_ABI = [
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

const CHAINLINK_ABI = [
  { inputs: [], name: 'latestRoundData', outputs: [{ name: 'roundId', type: 'uint80' }, { name: 'answer', type: 'int256' }, { name: 'startedAt', type: 'uint256' }, { name: 'updatedAt', type: 'uint256' }, { name: 'answeredInRound', type: 'uint80' }], stateMutability: 'view', type: 'function' },
] as const;

const ROUTER_ABI = [
  { inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }], name: 'getAmountsOut', outputs: [{ name: 'amounts', type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
] as const;

// ── CoinGecko token map ────────────────────────────────────────────────────
const COINGECKO_ID_MAP: Record<string, string> = {
  'ethereum:ETH':  'ethereum',   'ethereum:USDT': 'tether',    'ethereum:USDC': 'usd-coin',
  'ethereum:BTC':  'bitcoin',    'ethereum:BNB':  'binancecoin',
  'bsc:BNB':       'binancecoin','bsc:USDT':      'tether',    'bsc:USDC':      'usd-coin',
  'bsc:ETH':       'ethereum',   'bsc:BTC':       'bitcoin',
  'polygon:MATIC': 'matic-network','polygon:USDT': 'tether',   'polygon:USDC':  'usd-coin',
  'polygon:ETH':   'ethereum',   'polygon:BTC':   'bitcoin',
  'arbitrum:ETH':  'ethereum',   'arbitrum:USDT': 'tether',    'arbitrum:USDC': 'usd-coin',
  'arbitrum:BTC':  'bitcoin',    'arbitrum:BNB':  'binancecoin',
  'bitcoin:BTC':   'bitcoin',
};

// ── In-memory caches ───────────────────────────────────────────────────────
interface CacheEntry { prices: Record<string, number>; timestamp: number; }
const cgCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 60_000; // 1 min

let _cozanetDecimals: number | null = null;
let _lastGoodCznPrice: number | null = null;
let _lastGoodWbnbPrice: number | null = null;

// ── BSC client (lazy) ──────────────────────────────────────────────────────
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
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds.join(',')}&vs_currencies=usd`;
    const res = await fetch(url);
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

// ── WBNB/USD price (Chainlink first, CoinGecko fallback) ──────────────────
async function fetchWbnbPrice(): Promise<number> {
  // 1. Chainlink on-chain oracle
  try {
    const client = getBscClient();
    const { answer } = await client.readContract({
      address: CHAINLINK_BNB_USD, abi: CHAINLINK_ABI, functionName: 'latestRoundData',
    });
    const price = Number(answer) / 1e8;
    if (price > 50) { _lastGoodWbnbPrice = price; return price; }
  } catch { /* fall through */ }

  // 2. CoinGecko
  try {
    const prices = await fetchCoingeckoPrices(['binancecoin']);
    const price = prices['binancecoin'];
    if (price && price > 50) { _lastGoodWbnbPrice = price; return price; }
  } catch { /* fall through */ }

  // 3. Last known good
  if (_lastGoodWbnbPrice) return _lastGoodWbnbPrice;
  throw new Error('Cannot fetch WBNB/USD price');
}

// ── Cozanet decimals (cached) ──────────────────────────────────────────────
async function getCznDecimals(): Promise<number> {
  if (_cozanetDecimals !== null) return _cozanetDecimals;
  try {
    const client = getBscClient();
    _cozanetDecimals = await client.readContract({
      address: COZANET_ADDRESS, abi: ERC20_DECIMALS_ABI, functionName: 'decimals',
    });
    return _cozanetDecimals!;
  } catch {
    _cozanetDecimals = 18; // safe default
    return 18;
  }
}

// ── Price sanity validator ─────────────────────────────────────────────────
function validateCznPrice(newPrice: number): number {
  if (_lastGoodCznPrice && (newPrice > _lastGoodCznPrice * 5 || newPrice < _lastGoodCznPrice * 0.2)) {
    console.warn(`[CZN] Price ${newPrice} rejected (extreme), using last good ${_lastGoodCznPrice}`);
    return _lastGoodCznPrice;
  }
  if (newPrice > 0) _lastGoodCznPrice = newPrice;
  return newPrice;
}

// ── Source 1: PancakeSwap reserve-based spot price ─────────────────────────
async function fetchCznFromReserves(): Promise<number | null> {
  try {
    const client = getBscClient();
    const pairAddress = await client.readContract({
      address: PANCAKE_FACTORY, abi: FACTORY_ABI, functionName: 'getPair',
      args: [COZANET_ADDRESS, WBNB_ADDRESS],
    });
    if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') return null;

    const [token0, reserves] = await Promise.all([
      client.readContract({ address: pairAddress, abi: PANCAKE_PAIR_ABI, functionName: 'token0' }),
      client.readContract({ address: pairAddress, abi: PANCAKE_PAIR_ABI, functionName: 'getReserves' }),
    ]);

    const dec = await getCznDecimals();
    const isCznToken0 = token0.toLowerCase() === COZANET_ADDRESS.toLowerCase();
    const cznReserve  = isCznToken0 ? reserves[0] : reserves[1];
    const wbnbReserve = isCznToken0 ? reserves[1] : reserves[0];

    const cznAmount  = parseFloat(formatUnits(cznReserve, dec));
    const wbnbAmount = parseFloat(formatUnits(wbnbReserve, 18));
    if (cznAmount <= 0 || wbnbAmount <= 0) return null;

    const cznPerWbnb = cznAmount / wbnbAmount;
    const wbnbPrice  = await fetchWbnbPrice();
    return wbnbPrice / cznPerWbnb;
  } catch (e) {
    console.warn('[CZN] Reserve price failed:', (e as Error).message);
    return null;
  }
}

// ── Source 2: PancakeSwap getAmountsOut quote (0.001 WBNB) ────────────────
async function fetchCznFromQuote(): Promise<number | null> {
  try {
    const client = getBscClient();
    const dec = await getCznDecimals();
    const tinyInput = parseUnits('0.001', 18);
    const amounts = await client.readContract({
      address: PANCAKE_ROUTER, abi: ROUTER_ABI, functionName: 'getAmountsOut',
      args: [tinyInput, [WBNB_ADDRESS, COZANET_ADDRESS]],
    });
    const cznOut = parseFloat(formatUnits(amounts[1], dec));
    if (cznOut <= 0) return null;
    const wbnbPrice = await fetchWbnbPrice();
    return (wbnbPrice * 0.001) / cznOut;
  } catch (e) {
    console.warn('[CZN] Quote price failed:', (e as Error).message);
    return null;
  }
}

// ── Source 3: DexScreener ──────────────────────────────────────────────────
async function fetchCznFromDexScreener(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${COZANET_ADDRESS}`);
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data?.pairs?.[0]?.priceUsd ?? '0');
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

// ── Main Cozanet price fetcher ─────────────────────────────────────────────
export async function fetchCozanetPrice(): Promise<number> {
  let price: number | null;

  price = await fetchCznFromReserves();
  if (price !== null) return validateCznPrice(price);

  price = await fetchCznFromQuote();
  if (price !== null) return validateCznPrice(price);

  price = await fetchCznFromDexScreener();
  if (price !== null) return validateCznPrice(price);

  if (_lastGoodCznPrice) return _lastGoodCznPrice;
  throw new Error('No valid CZN price source available');
}

// ── Generic token prices (CoinGecko) ──────────────────────────────────────
export async function fetchTokenPrices(assetKeys: string[]): Promise<Record<string, number>> {
  // Separate CZN from the rest
  const cznKey = assetKeys.find(k => k.includes('CZN') || k === 'cozanet');
  const otherKeys = assetKeys.filter(k => k !== cznKey);

  const priceMap: Record<string, number> = {};

  // Fetch CZN on-chain
  if (cznKey) {
    try {
      priceMap[cznKey] = await fetchCozanetPrice();
    } catch {
      priceMap[cznKey] = _lastGoodCznPrice ?? 0;
    }
  }

  // Fetch others via CoinGecko
  const neededIds = otherKeys.map(k => COINGECKO_ID_MAP[k]).filter(Boolean);
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
  const prices = await fetchTokenPrices([assetKey]);
  return prices[assetKey] ?? 0;
}

export function clearPriceCache(): void {
  for (const key in cgCache) delete cgCache[key];
  _cozanetDecimals = null;
  _bscClient = null;
}
