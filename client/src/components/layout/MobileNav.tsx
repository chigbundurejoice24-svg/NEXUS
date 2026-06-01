import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Wallet, Send, PlusCircle, Receipt
} from 'lucide-react'

const mobileNavItems = [
  { icon: LayoutDashboard, label: 'Home', href: '/' },
  { icon: Wallet, label: 'Wallets', href: '/wallets' },
  { icon: Send, label: 'Send', href: '/send' },
  { icon: PlusCircle, label: 'Fund', href: '/fund' },
  { icon: Receipt, label: 'Activity', href: '/transactions' },
]

export default function MobileNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href

          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                isActive ? 'text-aegis-accent-purple' : 'text-aegis-tertiary-dark'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
