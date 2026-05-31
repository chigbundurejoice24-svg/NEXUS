import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingUp, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfolioData {
  aggregatedAssets: Array<{
    network: string;
    token: string;
    totalBalance: string;
    priceUsd: number;
    valueUsd: string;
  }>;
  totalValueUsd: string;
  totalWallets: number;
}

export default function PortfolioWidget() {
  const [walletAddresses, setWalletAddresses] = useState<Array<{ address: string; label?: string }>>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's wallets
  const listWalletsQuery = trpc.wallets.listWallets.useQuery();

  // Fetch portfolio data
  const getPortfolioQuery = trpc.portfolio.getAggregated.useQuery(
    { wallets: walletAddresses },
    {
      enabled: walletAddresses.length > 0,
      refetchInterval: 60000, // Refetch every minute
    }
  );

  // Update wallet addresses when list changes
  useEffect(() => {
    if (listWalletsQuery.data?.success && listWalletsQuery.data.wallets) {
      const addresses = listWalletsQuery.data.wallets.map((w) => ({
        address: w.address as `0x${string}`,
        label: w.label || undefined,
      }));
      setWalletAddresses(addresses);
    }
  }, [listWalletsQuery.data]);

  // Update portfolio data when query completes
  useEffect(() => {
    if (getPortfolioQuery.data?.success && getPortfolioQuery.data.data) {
      setPortfolioData(getPortfolioQuery.data.data);
      setError(null);
    } else if (getPortfolioQuery.data?.error) {
      setError(getPortfolioQuery.data.error);
    }
  }, [getPortfolioQuery.data]);

  if (listWalletsQuery.isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!walletAddresses.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Portfolio
          </CardTitle>
          <CardDescription>No wallets added yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add a wallet address above to start tracking your portfolio.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Portfolio
        </CardTitle>
        <CardDescription>
          {walletAddresses.length} wallet{walletAddresses.length !== 1 ? "s" : ""} connected
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {getPortfolioQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : portfolioData ? (
          <div className="space-y-4">
            {/* Total Value */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <p className="text-sm text-muted-foreground mb-1">Total Portfolio Value</p>
              <p className="text-3xl font-bold text-blue-900">
                ${portfolioData.totalValueUsd}
              </p>
            </div>

            {/* Assets List */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Assets</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {portfolioData.aggregatedAssets.length > 0 ? (
                  portfolioData.aggregatedAssets.map((asset, idx) => (
                    <div
                      key={`${asset.network}-${asset.token}-${idx}`}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {asset.token}
                            <span className="text-xs text-muted-foreground ml-2">
                              ({asset.network})
                            </span>
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Balance: {asset.totalBalance}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">${asset.valueUsd}</p>
                        <p className="text-xs text-muted-foreground">
                          ${asset.priceUsd.toFixed(2)}/unit
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No assets found in your wallets
                  </p>
                )}
              </div>
            </div>

            {/* Last Updated */}
            <p className="text-xs text-muted-foreground text-center">
              {getPortfolioQuery.isFetching && (
                <span className="flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Updating...
                </span>
              )}
              {!getPortfolioQuery.isFetching && "Last updated just now"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Unable to load portfolio data
          </p>
        )}
      </CardContent>
    </Card>
  );
}
