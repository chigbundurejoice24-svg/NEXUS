import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useCurrentUser } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import Auth from '@/pages/Auth'
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

// ── Route guards ──────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/auth" replace />
  return <>{children}</>
}

// Double-layered admin guard:
//   Layer 1 — client: isAdmin flag from auth.me (server-verified email whitelist + DB role)
//   Layer 2 — server: every admin.* tRPC call enforces adminProcedure independently
// Even if someone manually navigates to /admin, every data fetch returns 401.
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useCurrentUser();
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={22} className="animate-spin text-aegis-tertiary-dark" />
    </div>
  );
  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <Lock size={28} className="text-red-400" />
      </div>
      <p className="font-semibold dark:text-white">Access Restricted</p>
      <p className="text-sm text-aegis-tertiary-dark">You don't have permission to view this page.</p>
      <a href="/" className="text-xs text-[#5B3CF5] hover:underline">← Go home</a>
    </div>
  );
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public auth page */}
        <Route path="/auth" element={<Auth />} />

        {/* Public legal page — no auth required */}
        <Route path="/legal" element={<LegalPage />} />

        {/* Protected app routes */}
        <Route element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/wallets"      element={<Wallets />} />
          <Route path="/money"        element={<Money />} />
          {/* Legacy redirects — old links still work */}
          <Route path="/send"         element={<Navigate to="/money?tab=send" replace />} />
          <Route path="/receive"      element={<Navigate to="/money?tab=receive" replace />} />
          <Route path="/fund"         element={<Navigate to="/money?tab=fund" replace />} />
          <Route path="/exchange"     element={<Navigate to="/money?tab=swap" replace />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/rates"        element={<Rates />} />
          <Route path="/ai"           element={<AegisAI />} />
          <Route path="/rewards"      element={<Rewards />} />
          <Route path="/settings"     element={<Settings />} />
          <Route path="/profile"      element={<Profile />} />
          <Route path="/api"          element={<DeveloperAPI />} />
          <Route path="/help"         element={<Help />} />
          <Route path="/buy-cozanet"  element={<BuyCozanet />} />
          <Route path="/notifications" element={<Notifications />} />

          {/* Admin — double-guarded: client isAdmin check + server adminProcedure on every call */}
          <Route path="/admin" element={
            <RequireAdmin>
              <AdminConsole />
            </RequireAdmin>
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
