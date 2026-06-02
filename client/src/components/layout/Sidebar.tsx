import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Wallet, Send, Download, PlusCircle,
  Receipt, ArrowLeftRight, TrendingUp, Sparkles, Gift,
  Settings, Code, ShieldCheck, ChevronLeft, Sun, Moon, Loader2,
} from "lucide-react";
import { navItems } from "@/data/mockData";
import { useCozanetStatus } from "@/hooks/useCozanetStatus";
import { useCurrentUser } from "@/hooks/useAuth";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Wallet, Send, Download, PlusCircle,
  Receipt, ArrowLeftRight, TrendingUp, Sparkles, Gift,
  Settings, Code, ShieldCheck,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  darkMode: boolean;
  onDarkModeToggle: () => void;
  mobile?: boolean;
}

export default function Sidebar({
  collapsed, onToggle, darkMode, onDarkModeToggle, mobile,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const {
    priceUsd, pointsBalance, discountPercent, isLoading: cznLoading,
  } = useCozanetStatus();

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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              <span className="font-semibold text-[15px] tracking-tight text-aegis-primary-dark dark:text-white whitespace-nowrap">
                AEGIS
              </span>
              <span className="text-[10px] text-aegis-tertiary-dark -mt-0.5 whitespace-nowrap">
                by Cozanet
              </span>
            </motion.div>
          )}
        </div>

        {/* Collapse button (desktop only) */}
        {!mobile && (
          <button
            onClick={onToggle}
            className="absolute right-0 translate-x-1/2 w-6 h-6 bg-white dark:bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
          >
            <ChevronLeft
              size={14}
              className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Cozanet Token Card — live data */}
      {!collapsed && (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-white dark:bg-card border border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">CZ</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-aegis-primary-dark dark:text-white truncate">
                Cozanet Token (CZN)
              </p>
              {cznLoading ? (
                <Loader2 size={10} className="animate-spin text-aegis-tertiary-dark mt-0.5" />
              ) : (
                <p className="text-xs text-aegis-secondary-dark">
                  ${priceUsd > 0 ? priceUsd.toFixed(4) : "—"}
                </p>
              )}
            </div>
            {/* Discount badge — only when logged in and holding CZN */}
            {user && discountPercent > 0 && (
              <span className="text-[10px] font-medium text-aegis-success-green bg-aegis-success-green/10 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                {discountPercent}% off
              </span>
            )}
          </div>

          {/* Points row — only when authenticated */}
          {user && !cznLoading && (
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-aegis-tertiary-dark">Your Points</span>
              <span className="text-[11px] font-semibold text-aegis-primary-dark dark:text-white">
                {parseFloat(pointsBalance).toLocaleString()} CZN
              </span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.href);
                if (mobile) onToggle();
              }}
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
              {Icon && (
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} className="flex-shrink-0" />
              )}
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-aegis-bg-elevated text-aegis-tertiary-dark font-medium">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account Level */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-medium text-aegis-tertiary-dark uppercase tracking-wider">
              Account Level
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
              {user ? "Premium" : "Guest"}
            </span>
            <div className="w-5 h-5 rounded-full gradient-brand flex items-center justify-center">
              <Sparkles size={10} className="text-white" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-aegis-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full gradient-brand rounded-full transition-all"
                style={{ width: "78%" }}
              />
            </div>
            <span className="text-[10px] text-aegis-tertiary-dark">780/1000 XP</span>
          </div>
        </div>
      )}

      {/* Dark Mode Toggle */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={onDarkModeToggle}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-aegis-secondary-dark hover:text-aegis-primary-dark hover:bg-aegis-bg-elevated/50
            dark:hover:text-white transition-all duration-200
          `}
        >
          {darkMode ? (
            <Sun size={20} strokeWidth={1.5} />
          ) : (
            <Moon size={20} strokeWidth={1.5} />
          )}
          {!collapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </button>
      </div>
    </motion.aside>
  );
}
