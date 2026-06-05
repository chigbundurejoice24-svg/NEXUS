import { useCurrentUser } from '@/hooks/useAuth';
import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopHeader from './TopHeader'
import MobileNav from './MobileNav'

const pageTitles: Record<string, string> = {
  '/':              'Dashboard',
  '/wallets':       'Wallets',
  '/money':         'Money',
  '/send':          'Money',
  '/receive':       'Money',
  '/fund':          'Money',
  '/exchange':      'Money',
  '/transactions':  'Transactions',
  '/rates':         'Live Rates',
  '/ai':            'Aegis AI',
  '/rewards':       'Rewards',
  '/settings':      'Settings',
  '/profile':       'Profile',
  '/api':           'Developer API',
  '/admin':         'Admin Console',
  '/help':          'Help & Support',
  '/buy-cozanet':   'Buy Cozanet',
  '/notifications': 'Notifications',
}

function getInitialDark(): boolean {
  const stored = localStorage.getItem("aegis_theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function AppLayout() {
  const { user } = useCurrentUser();
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen]     = useState(false)
  const [darkMode, setDarkMode]                 = useState(getInitialDark)

  const pageTitle = pageTitles[location.pathname] ?? 'AEGIS'

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("aegis_theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("aegis_theme")) {
        setDarkMode(e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const handleResize = () => setSidebarCollapsed(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          darkMode={darkMode} onDarkModeToggle={toggleDark} />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar collapsed={false} onToggle={() => setMobileMenuOpen(false)}
              darkMode={darkMode} onDarkModeToggle={toggleDark} mobile />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <TopHeader title={pageTitle} onMenuToggle={() => setMobileMenuOpen(true)} />

        {user && (user as any).emailVerified === false && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
              <span>⚠️</span>
              <span>Verify your email to unlock $10,000/day limits and account recovery.</span>
            </div>
            <a href="/settings" className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 underline flex-shrink-0">
              Verify now →
            </a>
          </div>
        )}

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>

        <MobileNav />
      </div>
    </div>
  )
}
