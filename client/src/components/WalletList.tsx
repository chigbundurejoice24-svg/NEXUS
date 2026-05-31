import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function WalletList() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const listWalletsQuery = trpc.wallets.listWallets.useQuery();
  const removeWalletMutation = trpc.wallets.removeWallet.useMutation();
  const updateLabelMutation = trpc.wallets.updateLabel.useMutation();

  const handleRemoveWallet = async (walletId: number) => {
    if (!confirm("Are you sure you want to remove this wallet?")) return;

    try {
      const result = await removeWalletMutation.mutateAsync({ walletId });
      if (result.success) {
        toast.success("Wallet removed");
        listWalletsQuery.refetch();
      } else {
        toast.error("Failed to remove wallet");
      }
    } catch (error) {
      toast.error("Error removing wallet");
    }
  };

  const handleUpdateLabel = async (walletId: number) => {
    if (!editingLabel.trim()) {
      toast.error("Label cannot be empty");
      return;
    }

    try {
      const result = await updateLabelMutation.mutateAsync({
        walletId,
        label: editingLabel,
      });
      if (result.success) {
        toast.success("Label updated");
        setEditingId(null);
        listWalletsQuery.refetch();
      } else {
        toast.error("Failed to update label");
      }
    } catch (error) {
      toast.error("Error updating label");
    }
  };

  if (listWalletsQuery.isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Wallets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const wallets = listWalletsQuery.data?.wallets || [];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Wallets</CardTitle>
        <CardDescription>
          {wallets.length} wallet{wallets.length !== 1 ? "s" : ""} added
        </CardDescription>
      </CardHeader>
      <CardContent>
        {wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No wallets added yet
          </p>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  {editingId === wallet.id ? (
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      placeholder="Wallet label"
                      className="mb-2"
                    />
                  ) : (
                    <>
                      <p className="font-medium text-sm">
                        {wallet.label || "Unnamed Wallet"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {wallet.address}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-2">
                  {editingId === wallet.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateLabel(wallet.id)}
                        disabled={updateLabelMutation.isPending}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(wallet.id);
                          setEditingLabel(wallet.label || "");
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveWallet(wallet.id)}
                        disabled={removeWalletMutation.isPending}
                      >
                        {removeWalletMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
