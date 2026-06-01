import { Routes, Route } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
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

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/wallets" element={<Wallets />} />
        <Route path="/send" element={<SendMoney />} />
        <Route path="/receive" element={<ReceiveMoney />} />
        <Route path="/fund" element={<FundWallet />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/exchange" element={<Exchange />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/ai" element={<AegisAI />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/api" element={<DeveloperAPI />} />
      </Route>
    </Routes>
  )
}
