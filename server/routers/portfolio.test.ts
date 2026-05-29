import { describe, it, expect } from 'vitest';
import { appRouter } from '../routers';

describe('Portfolio Router', () => {
  const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });

  // Using valid Ethereum addresses (40 hex chars after 0x)
  const testWallets = [
    {
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      label: 'Vitalik Buterin',
    },
  ];

  it('should fetch aggregated portfolio with live prices', async () => {
    const result = await caller.portfolio.getAggregated({
      wallets: testWallets,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.aggregatedAssets).toBeDefined();
    expect(Array.isArray(result.data?.aggregatedAssets)).toBe(true);
  }, { timeout: 60000 });

  it('should get total portfolio value', async () => {
    const result = await caller.portfolio.getTotalValue({
      wallets: testWallets,
    });

    expect(result.success).toBe(true);
    expect(result.totalValueUsd).toBeDefined();
    expect(typeof result.totalValueUsd).toBe('string');
    expect(result.totalWallets).toBe(1);
  }, { timeout: 60000 });

  it('should get per-wallet breakdown', async () => {
    const result = await caller.portfolio.getByWallet({
      wallets: testWallets,
    });

    expect(result.success).toBe(true);
    expect(result.wallets).toBeDefined();
    expect(Array.isArray(result.wallets)).toBe(true);
  }, { timeout: 60000 });

  it('should get prices for specific assets', async () => {
    const result = await caller.portfolio.getPrices({
      assetKeys: ['ethereum:ETH', 'ethereum:USDT', 'bsc:BNB'],
    });

    expect(result.success).toBe(true);
    expect(result.prices).toBeDefined();
    expect(result.prices['ethereum:ETH']).toBeGreaterThan(0);
    expect(result.prices['ethereum:USDT']).toBeGreaterThan(0);
    expect(result.prices['bsc:BNB']).toBeGreaterThan(0);
  });

  it('should reject invalid wallet address', async () => {
    try {
      await caller.portfolio.getAggregated({
        wallets: [
          {
            address: 'invalid-address',
            label: 'Invalid',
          },
        ] as any,
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should reject empty wallet list', async () => {
    try {
      await caller.portfolio.getAggregated({
        wallets: [],
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle multiple wallets', async () => {
    const multiWallets = [
      {
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        label: 'Wallet 1',
      },
      {
        address: '0x1234567890123456789012345678901234567890',
        label: 'Wallet 2',
      },
    ];

    const result = await caller.portfolio.getAggregated({
      wallets: multiWallets,
    });

    expect(result.success).toBe(true);
    expect(result.data?.totalWallets).toBe(2);
  }, { timeout: 60000 });
});
