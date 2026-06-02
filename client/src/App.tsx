import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import Wallets from '@/pages/Wallets'
import SendMoney from '@/pages/SendMoney'
import ReceiveMoney from '@/pages/ReceiveMoney'
import FundWallet from '@/pages/FundWallet'
import Transactions from '@/pages/Transactions'
import Exchange from '@/pages/Exchange'
import Rates from '@/pages/Rates'
import AegisAI from '@/pages/AegisAI'
import Rewards from '@/pages/Rewards'
import Settings from '@/pages/Settings'
import Profile from '@/pages/Profile'
import DeveloperAPI from '@/pages/DeveloperAPI'
import AdminConsole from '@/pages/AdminConsole'
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

      {/* Protected app routes */}
      <Route element={
        <RequireAuth>
          <AppLayout />
        </RequireAuth>
      }>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/wallets"      element={<Wallets />} />
        <Route path="/send"         element={<SendMoney />} />
        <Route path="/receive"      element={<ReceiveMoney />} />
        <Route path="/fund"         element={<FundWallet />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/exchange"     element={<Exchange />} />
        <Route path="/rates"        element={<Rates />} />
        <Route path="/ai"           element={<AegisAI />} />
        <Route path="/rewards"      element={<Rewards />} />
        <Route path="/settings"     element={<Settings />} />
        <Route path="/profile"      element={<Profile />} />
        <Route path="/api"          element={<DeveloperAPI />} />
        <Route path="/admin"        element={<AdminConsole />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
