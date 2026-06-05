/**
 * TopHeader.tsx — Top navigation bar with live unread badge
 */
import { Bell, Menu } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { getToken } from "@/lib/trpc";

interface Props { title: string; onMenuToggle: () => void; }

export default function TopHeader({ title, onMenuToggle }: Props) {
  const navigate = useNavigate();
  const hasToken = !!getToken();

  // Live unread count — refetch every 30s
  const { data } = trpc.notify.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: hasToken, refetchInterval: 30_000, staleTime: 20_000 }
  );
  const unread = ((data as any) ?? []).filter((n: any) => !n.isRead).length;

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border bg-background flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
          <Menu size={18} className="text-aegis-tertiary-dark"/>
        </button>
        <h1 className="text-base font-semibold text-aegis-primary-dark dark:text-white">{title}</h1>
      </div>
      <button onClick={() => navigate("/notifications")}
        className="relative p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors">
        <Bell size={18} className="text-aegis-tertiary-dark"/>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] text-white font-bold leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </header>
  );
}
