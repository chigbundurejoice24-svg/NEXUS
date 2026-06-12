/**
 * App.tsx — NEXUS (No Auth Mode)
 * Auth completely bypassed. All pages open directly.
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppLayout from '@/components/layout/AppLayout'
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

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Legal pages (standalone) */}
        <Route path="/legal" element={<LegalPage />} />

        {/* All app routes — no auth required */}
        <Route element={<AppLayout />}>
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
          <Route path="/admin" element={<AdminConsole />} />
        </Route>

        {/* Catch-all → dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
