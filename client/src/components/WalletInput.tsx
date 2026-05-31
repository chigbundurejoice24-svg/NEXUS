import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function WalletInput() {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const addWalletMutation = trpc.wallets.addWallet.useMutation();

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address.trim()) {
      toast.error("Please enter a wallet address");
      return;
    }

    // Basic validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast.error("Invalid Ethereum address format");
      return;
    }

    setIsLoading(true);
    try {
      const result = await addWalletMutation.mutateAsync({
        address: address.trim(),
        label: label.trim() || undefined,
      });

      if (result.success) {
        toast.success("Wallet added successfully!");
        setAddress("");
        setLabel("");
      } else {
        toast.error(result.error || "Failed to add wallet");
      }
    } catch (error) {
      console.error("Error adding wallet:", error);
      toast.error("Error adding wallet");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Wallet Address
        </CardTitle>
        <CardDescription>
          Enter your Ethereum wallet address to track balances and prices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddWallet} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              Wallet Address
            </label>
            <Input
              id="address"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isLoading}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Format: 0x followed by 40 hexadecimal characters
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="label" className="text-sm font-medium">
              Wallet Label (Optional)
            </label>
            <Input
              id="label"
              placeholder="e.g., Main Wallet, Trading"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Wallet
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
