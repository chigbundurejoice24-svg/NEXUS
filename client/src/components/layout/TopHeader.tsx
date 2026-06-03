/**
 * TopHeader.tsx
 *
 * SECURITY & UX fixes:
 * - NO hardcoded name or avatar from mockData
 * - Shows real user name from trpc.auth.me
 * - Profile picture ONLY shown if user uploaded it themselves
 * - Falls back to initials avatar (same pattern as Sidebar)
 */
import { Search, Bell, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";

interface TopHeaderProps {
  title: string;
  onMenuToggle: () => void;
}

function AvatarDisplay({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // Only render an <img> if the user explicitly set an avatarUrl themselves
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "Profile"}
        className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
      />
    );
  }

  // Default: clean initials avatar using brand gradient
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B3CF5] to-[#3B5BDB] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-bold leading-none">{initials}</span>
    </div>
  );
}

export default function TopHeader({ title, onMenuToggle }: TopHeaderProps) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const displayName  = user?.name ?? (user ? "Account" : "");
  const avatarUrl    = (user as any)?.avatarUrl ?? null;

  return (
    <header className="h-[72px] flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-aegis-bg-elevated transition-colors"
        >
          <Menu size={20} className="text-aegis-secondary-dark" />
        </button>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-aegis-primary-dark dark:text-white">
          {title}
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <button className="hidden sm:flex w-10 h-10 items-center justify-center rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <Search size={18} className="text-aegis-secondary-dark" />
        </button>

        {/* Notifications */}
        <button className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <Bell size={18} className="text-aegis-secondary-dark" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-aegis-success-green" />
        </button>

        {/* User Profile — real name + initials, no hardcoded photo */}
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full hover:bg-aegis-bg-elevated transition-colors"
        >
          <AvatarDisplay name={displayName} avatarUrl={avatarUrl} />
          {displayName && (
            <span className="hidden sm:block text-sm font-medium text-aegis-primary-dark dark:text-white max-w-[120px] truncate">
              {displayName}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
