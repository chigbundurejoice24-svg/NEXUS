import { Routes, Route, Navigate } from 'react-router-dom'
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  return (
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
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/exchange"     element={<Navigate to="/money?tab=swap" replace />} />
        <Route path="/rates"        element={<Rates />} />
        <Route path="/ai"           element={<AegisAI />} />
        <Route path="/rewards"      element={<Rewards />} />
        <Route path="/settings"     element={<Settings />} />
        <Route path="/profile"      element={<Profile />} />
        <Route path="/api"          element={<DeveloperAPI />} />
        <Route path="/admin"        element={<AdminConsole />} />
        <Route path="/help"         element={<Help />} />
        <Route path="/buy-cozanet"  element={<BuyCozanet />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
