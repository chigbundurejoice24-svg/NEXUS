import DashboardLayout from "@/components/DashboardLayout";
import WalletInput from "@/components/WalletInput";
import WalletList from "@/components/WalletList";
import PortfolioWidget from "@/components/PortfolioWidget";

/**
 * Home page - Dashboard for AEGIS crypto wallet
 * Displays wallet management and portfolio tracking
 */
export default function Home() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">AEGIS Wallet Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your crypto wallets and track your portfolio in real-time
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Wallet Management */}
          <div className="lg:col-span-1 space-y-6">
            <WalletInput />
            <WalletList />
          </div>

          {/* Right Column - Portfolio */}
          <div className="lg:col-span-2">
            <PortfolioWidget />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
