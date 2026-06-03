import { useCurrentUser } from '@/hooks/useAuth';
import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import MobileNav from './MobileNav'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/wallets': 'Wallets',
  '/send': 'Send Money',
  '/receive': 'Receive Money',
  '/fund': 'Fund Wallet',
  '/transactions': 'Transactions',
  '/exchange': 'Exchange',
  '/rates': 'Live Rates',
  '/ai': 'Aegis AI',
  '/rewards': 'Rewards',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/api': 'Developer API',
}

export default function AppLayout() {
  const { user } = useCurrentUser();
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const pageTitle = pageTitles[location.pathname] || 'AEGIS'

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true)
      } else {
        setSidebarCollapsed(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          darkMode={darkMode}
          onDarkModeToggle={() => setDarkMode(!darkMode)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              darkMode={darkMode}
              onDarkModeToggle={() => setDarkMode(!darkMode)}
              mobile
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopHeader
          title={pageTitle}
          onMenuToggle={() => setMobileMenuOpen(true)}
        />

        
      {/* Email verification banner */}
      {user && (user as any).emailVerified === false && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
            <span>⚠️</span>
            <span>Verify your email to unlock $10,000/day limits and account recovery.</span>
          </div>
          <a href="/settings" className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 underline flex-shrink-0">Verify now →</a>
        </div>
      )}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </div>
  )
}
