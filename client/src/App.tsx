import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useCurrentUser } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import Auth from '@/pages/Auth'
import DevLogin from '@/pages/DevLogin'
import Dashboard from '@/pages/Dashboard'
import Wallets from '@/pages/Wallets'
import Transactions from '@/pages/Transactions'
import Exchange from '@/pages/Exchange'
import Money from '@/pages/Money'
import Rates from '@/pages/Rates'
import AegisAI from '@/pages/AegisAI'
import Rewards from '@/pages/Rewards'
import Settings from '@/pages/Settings'
import Profile from '@/pages/Profile'
import DeveloperAPI from '@/pages/DeveloperAPI'
import AdminConsole from '@/pages/AdminConsole'
import LegalPage from '@/pages/LegalPage'
import Help from '@/pages/Help'
import Notifications from '@/pages/Notifications'
import BuyCozanet from '@/pages/BuyCozanet'
import { getToken } from '@/lib/trpc'
import { Loader2, Lock } from 'lucide-react'

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useCurrentUser();
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={22} className="animate-spin text-muted-foreground" />
    </div>
  );
  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <Lock size={28} className="text-red-400" />
      </div>
      <p className="font-semibold dark:text-white">Access Restricted</p>
      <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
      <a href="/" className="text-xs text-primary hover:underline">← Go home</a>
    </div>
  );
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/dev" element={<DevLogin />} />

        {/* Protected app routes */}
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/wallets" element={<Wallets />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/money" element={<Money />} />
          <Route path="/send" element={<Money />} />
          <Route path="/receive" element={<Money />} />
          <Route path="/fund" element={<Money />} />
          <Route path="/rates" element={<Rates />} />
          <Route path="/ai" element={<AegisAI />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/api" element={<DeveloperAPI />} />
          <Route path="/help" element={<Help />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/buy-cozanet" element={<BuyCozanet />} />
          <Route path="/admin" element={<RequireAdmin><AdminConsole /></RequireAdmin>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
