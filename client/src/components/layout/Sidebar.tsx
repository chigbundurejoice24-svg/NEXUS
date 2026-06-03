import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Wallet, Send, Download, PlusCircle,
  Receipt, ArrowLeftRight, TrendingUp, Sparkles, Gift,
  Settings, Code, Sun, Moon, Loader2,
} from "lucide-react";
import { useCozanetStatus } from "@/hooks/useCozanetStatus";
import { useCurrentUser } from "@/hooks/useAuth";

// ── All nav items EXCEPT admin (admin is injected conditionally) ──
const BASE_NAV = [
  { id: "dashboard",    label: "Dashboard",     icon: LayoutDashboard, href: "/" },
  { id: "wallets",      label: "Wallets",        icon: Wallet,          href: "/wallets" },
  { id: "send",         label: "Send Money",     icon: Send,            href: "/send" },
  { id: "receive",      label: "Receive Money",  icon: Download,        href: "/receive" },
  { id: "fund",         label: "Fund Wallet",    icon: PlusCircle,      href: "/fund" },
  { id: "transactions", label: "Transactions",   icon: Receipt,         href: "/transactions" },
  { id: "exchange",     label: "Exchange",       icon: ArrowLeftRight,  href: "/exchange" },
  { id: "rates",        label: "Rates",          icon: TrendingUp,      href: "/rates" },
  { id: "ai",           label: "Aegis AI",       icon: Sparkles,        href: "/ai" },
  { id: "rewards",      label: "Rewards",        icon: Gift,            href: "/rewards" },
  { id: "settings",     label: "Settings",       icon: Settings,        href: "/settings" },
  { id: "api",          label: "Developer API",  icon: Code,            href: "/api",   badge: "Coming Soon" },
];

// Admin-only item — imported dynamically so it never appears in source bundles
// served to non-admin users (tree-shaken at runtime via conditional render)
const ADMIN_NAV = { id: "admin", label: "Admin Console", icon: Code, href: "/admin" };

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  darkMode: boolean;
  onDarkModeToggle: () => void;
  mobile?: boolean;
}

// ── User avatar initials ──────────────────────────────────────────
function AvatarInitials({ name }: { name?: string | null }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
      <span className="text-white text-[10px] font-bold">{initials}</span>
    </div>
  );
}

export default function Sidebar({
  collapsed, onToggle, darkMode, onDarkModeToggle, mobile,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { priceUsd, pointsBalance, discountPercent, isLoading: cznLoading } = useCozanetStatus();

  // Build nav — admin item appended ONLY when server confirms isAdmin
  const navItems = user?.isAdmin
    ? [...BASE_NAV, ADMIN_NAV]
    : BASE_NAV;

  // Display name from real user data — never from mockData
  const displayName = user?.name ?? "Anonymous";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed && !mobile ? 72 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="h-full bg-aegis-bg-sidebar border-r border-border flex flex-col relative"
    >
      {/* Logo */}
      <div className="h-[72px] flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <img src="/logo.png" alt="AEGIS" className="w-9 h-9 flex-shrink-0" />
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
              <span className="font-semibold text-[15px] tracking-tight text-aegis-primary-dark dark:text-white whitespace-nowrap">AEGIS</span>
              <span className="text-[10px] text-aegis-tertiary-dark -mt-0.5 whitespace-nowrap">by Cozanet</span>
            </motion.div>
          )}
        </div>
        {!mobile && (
          <button
            onClick={onToggle}
            className="absolute right-0 translate-x-1/2 w-6 h-6 bg-white dark:bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
          >
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </motion.div>
          </button>
        )}
      </div>

      {/* CZN Token card + user identity */}
      {!collapsed && (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-white dark:bg-card border border-border">
          <div className="flex items-center gap-2">
            <AvatarInitials name={displayName} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-aegis-primary-dark dark:text-white truncate">{displayName}</p>
              <p className="text-[10px] text-aegis-tertiary-dark truncate">
                Cozanet Token (CZN) &nbsp;·&nbsp;
                {cznLoading
                  ? "loading…"
                  : priceUsd > 0 ? `$${priceUsd.toFixed(4)}` : "—"}
              </p>
            </div>
            {user && discountPercent > 0 && (
              <span className="text-[10px] font-medium text-aegis-success-green bg-aegis-success-green/10 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                {discountPercent}% off
              </span>
            )}
          </div>
          {user && !cznLoading && (
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-aegis-tertiary-dark">Your Points</span>
              <span className="text-[11px] font-semibold text-aegis-primary-dark dark:text-white">
                {parseFloat(pointsBalance || "0").toLocaleString()} CZN
              </span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.id}
              onClick={() => { navigate(item.href); if (mobile) onToggle(); }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 relative group
                ${isActive
                  ? "bg-aegis-bg-elevated text-aegis-accent-purple"
                  : "text-aegis-secondary-dark hover:text-aegis-primary-dark hover:bg-aegis-bg-elevated/50 dark:hover:text-white"
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-aegis-accent-purple"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && (item as any).badge && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-aegis-bg-elevated text-aegis-tertiary-dark font-medium">
                  {(item as any).badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Dark Mode Toggle */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={onDarkModeToggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-aegis-secondary-dark hover:text-aegis-primary-dark hover:bg-aegis-bg-elevated/50 dark:hover:text-white transition-all duration-200"
        >
          {darkMode ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
          {!collapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </button>
      </div>
    </motion.aside>
  );
}
