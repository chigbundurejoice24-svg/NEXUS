import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchTokenPrices, getTokenPrice, clearPriceCache } from './fetch-prices';

describe('Price Engine', () => {
  beforeEach(() => {
    clearPriceCache();
  });

  afterEach(() => {
    clearPriceCache();
  });

  it('should fetch prices for single token', async () => {
    const prices = await fetchTokenPrices(['ethereum:ETH']);
    expect(prices['ethereum:ETH']).toBeGreaterThan(0);
  });

  it('should fetch prices for multiple tokens', async () => {
    const prices = await fetchTokenPrices(['ethereum:ETH', 'ethereum:USDT', 'bsc:BNB']);
    expect(prices['ethereum:ETH']).toBeGreaterThan(0);
    expect(prices['ethereum:USDT']).toBeGreaterThan(0);
    expect(prices['bsc:BNB']).toBeGreaterThan(0);
  });

  it('should handle unknown tokens gracefully', async () => {
    const prices = await fetchTokenPrices(['ethereum:ETH', 'unknown:TOKEN']);
    expect(prices['ethereum:ETH']).toBeGreaterThan(0);
    expect(prices['unknown:TOKEN']).toBe(0);
  });

  it('should return cached prices on second call', async () => {
    const prices1 = await fetchTokenPrices(['ethereum:ETH']);
    const prices2 = await fetchTokenPrices(['ethereum:ETH']);
    
    expect(prices1['ethereum:ETH']).toBe(prices2['ethereum:ETH']);
  });

  it('should get single token price', async () => {
    const price = await getTokenPrice('ethereum:ETH');
    expect(price).toBeGreaterThan(0);
  });

  it('should handle empty asset keys', async () => {
    const prices = await fetchTokenPrices([]);
    expect(Object.keys(prices).length).toBe(0);
  });

  it('should handle all supported assets', async () => {
    const assets = [
      'ethereum:ETH',
      'ethereum:USDT',
      'ethereum:USDC',
      'ethereum:BTC',
      'bsc:BNB',
      'bsc:USDT',
      'polygon:MATIC',
      'arbitrum:ETH',
    ];
    
    const prices = await fetchTokenPrices(assets);
    
    // Should have prices for all supported assets
    for (const asset of assets) {
      expect(prices[asset]).toBeGreaterThan(0);
    }
  });
});
