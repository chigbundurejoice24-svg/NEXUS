/**
 * fetch-prices.ts — Hardened Price Engine
 *
 * Uses raw JSON-RPC calls instead of viem readContract to avoid TS typing issues.
 * Cozanet (CZN): PancakeSwap reserves → DexScreener → cache
 * WBNB/USD: Chainlink oracle → CoinGecko
 * All other tokens: CoinGecko with 1-min cache
 */

// ── BSC addresses ─────────────────────────────────────────────────────────
const COZANET  = '0xe470e53147e199e6a6c02a50473ff8e84bd2d2ca';
const WBNB     = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
const FACTORY  = '0xca143ce32fe78f1f7019d7d551a6402fc5350c73';
const ROUTER   = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
const CHAINLINK_BNB_USD = '0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee';
const BSC_RPC  = 'https://bsc-dataseed.binance.org';

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

// ── Cache ─────────────────────────────────────────────────────────────────
interface CacheEntry { prices: Record<string, number>; ts: number; }
const cgCache: Record<string, CacheEntry> = {};
const TTL = 60_000;
let _lastCzn: number | null = null;
let _lastWbnb: number | null = null;
let _cznDecimals: number | null = null;

// ── Raw BSC JSON-RPC call ─────────────────────────────────────────────────
async function bscCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(BSC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

// ── eth_call helper ───────────────────────────────────────────────────────
async function ethCall(to: string, data: string): Promise<string> {
  return bscCall('eth_call', [{ to, data }, 'latest']);
}

// Encode function selector (first 4 bytes of keccak256) — precomputed
const SEL = {
  getPair:       '0xe6a43905', // getPair(address,address)
  getReserves:   '0x0902f1ac', // getReserves()
  token0:        '0x0dfe1681', // token0()
  decimals:      '0x313ce567', // decimals()
  latestRound:   '0xfeaf968c', // latestRoundData()
  getAmountsOut: '0xd06ca61f', // getAmountsOut(uint256,address[])
};

function encodeAddr(addr: string): string {
  return addr.replace('0x','').toLowerCase().padStart(64,'0');
}

function encodeUint(n: bigint | number, bits = 256): string {
  return BigInt(n).toString(16).padStart(bits/4,'0');
}

function decodeUint(hex: string, offset = 0): bigint {
  return BigInt('0x' + hex.slice(2 + offset*64, 2 + (offset+1)*64));
}

function decodeAddr(hex: string, offset = 0): string {
  return '0x' + hex.slice(2 + offset*64 + 24, 2 + (offset+1)*64);
}

// ── CoinGecko ─────────────────────────────────────────────────────────────
async function fetchCoingeckoPrices(ids: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const key = unique.sort().join(',');
  const now = Date.now();
  if (cgCache[key] && now - cgCache[key]!.ts < TTL) return cgCache[key]!.prices;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${unique.join(',')}&vs_currencies=usd`);
    if (!res.ok) return cgCache[key]?.prices ?? {};
    const data: Record<string, { usd?: number }> = await res.json();
    const prices: Record<string, number> = {};
    for (const id of unique) prices[id] = data[id]?.usd ?? 0;
    cgCache[key] = { prices, ts: now };
    return prices;
  } catch {
    return cgCache[key]?.prices ?? {};
  }
}

// ── WBNB price ────────────────────────────────────────────────────────────
async function fetchWbnbPrice(): Promise<number> {
  // 1. Chainlink latestRoundData()
  try {
    const raw = await ethCall(CHAINLINK_BNB_USD, SEL.latestRound);
    // returns (uint80, int256, uint256, uint256, uint80) — answer is slot 1
    const answer = decodeUint(raw, 1);
    const price = Number(answer) / 1e8;
    if (price > 50) { _lastWbnb = price; return price; }
  } catch { /* fall through */ }

  // 2. CoinGecko
  try {
    const p = (await fetchCoingeckoPrices(['binancecoin']))['binancecoin'];
    if (p && p > 50) { _lastWbnb = p; return p; }
  } catch { /* fall through */ }

  if (_lastWbnb) return _lastWbnb;
  throw new Error('Cannot fetch WBNB price');
}

// ── CZN decimals ─────────────────────────────────────────────────────────
async function getCznDecimals(): Promise<number> {
  if (_cznDecimals !== null) return _cznDecimals;
  try {
    const raw = await ethCall(COZANET, SEL.decimals);
    _cznDecimals = Number(decodeUint(raw));
  } catch {
    _cznDecimals = 18;
  }
  return _cznDecimals;
}

function validateCzn(p: number): number {
  if (_lastCzn && (p > _lastCzn * 5 || p < _lastCzn * 0.2)) {
    console.warn(`[CZN] ${p} rejected, using ${_lastCzn}`);
    return _lastCzn;
  }
  if (p > 0) _lastCzn = p;
  return p;
}

// ── Source 1: PancakeSwap reserves ───────────────────────────────────────
async function fetchCznReserves(): Promise<number | null> {
  try {
    // getPair(COZANET, WBNB)
    const pairRaw = await ethCall(FACTORY, SEL.getPair + encodeAddr(COZANET) + encodeAddr(WBNB));
    const pair = decodeAddr(pairRaw);
    if (!pair || pair === '0x' + '0'.repeat(40)) return null;

    const [t0raw, resRaw, dec, wbnbPrice] = await Promise.all([
      ethCall(pair, SEL.token0),
      ethCall(pair, SEL.getReserves),
      getCznDecimals(),
      fetchWbnbPrice(),
    ]);

    const token0 = decodeAddr(t0raw).toLowerCase();
    const res0 = decodeUint(resRaw, 0);
    const res1 = decodeUint(resRaw, 1);

    const isCznT0 = token0 === COZANET;
    const cznRes  = isCznT0 ? res0 : res1;
    const wbnbRes = isCznT0 ? res1 : res0;

    const cznAmt  = Number(cznRes)  / 10 ** dec;
    const wbnbAmt = Number(wbnbRes) / 1e18;
    if (cznAmt <= 0 || wbnbAmt <= 0) return null;

    return wbnbPrice / (cznAmt / wbnbAmt);
  } catch (e) {
    console.warn('[CZN] Reserves failed:', (e as Error).message?.slice(0, 80));
    return null;
  }
}

// ── Source 2: DexScreener ─────────────────────────────────────────────────
async function fetchCznDexScreener(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${COZANET}`);
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data?.pairs?.[0]?.priceUsd ?? '0');
    return price > 0 ? price : null;
  } catch { return null; }
}

// ── Main CZN price ────────────────────────────────────────────────────────
export async function fetchCozanetPrice(): Promise<number> {
  const p1 = await fetchCznReserves();
  if (p1 !== null) return validateCzn(p1);
  const p2 = await fetchCznDexScreener();
  if (p2 !== null) return validateCzn(p2);
  if (_lastCzn) return _lastCzn;
  throw new Error('No CZN price source available');
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function fetchTokenPrices(assetKeys: string[]): Promise<Record<string, number>> {
  const cznKey = assetKeys.find(k => k === 'cozanet' || k.toUpperCase().includes('CZN'));
  const others = assetKeys.filter(k => k !== cznKey);
  const map: Record<string, number> = {};

  if (cznKey) {
    try { map[cznKey] = await fetchCozanetPrice(); }
    catch { map[cznKey] = _lastCzn ?? 0; }
  }

  const ids = others.map(k => COINGECKO_ID_MAP[k]).filter(Boolean) as string[];
  if (ids.length) {
    const cg = await fetchCoingeckoPrices(ids);
    for (const k of others) {
      const id = COINGECKO_ID_MAP[k];
      map[k] = id ? (cg[id] ?? 0) : 0;
    }
  }
  return map;
}

export async function getTokenPrice(assetKey: string): Promise<number> {
  return (await fetchTokenPrices([assetKey]))[assetKey] ?? 0;
}

export function clearPriceCache(): void {
  for (const k in cgCache) delete cgCache[k];
  _cznDecimals = null;
}
