/**
 * Notifications.tsx — User notification centre
 * Clean notifications list — no admin hints visible to users
 * Real tRPC data, auto-refreshes every 30s, mark read per-item or all at once
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, CheckCheck, Loader2,
  Megaphone, Shield, Gift, AlertTriangle, Info, Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const TYPE_CFG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  BROADCAST:   { icon: Megaphone,     color: "text-blue-400",   bg: "bg-blue-500/10"    },
  SYSTEM:      { icon: Shield,        color: "text-purple-400", bg: "bg-purple-500/10"  },
  PROMO:       { icon: Gift,          color: "text-yellow-400", bg: "bg-yellow-500/10"  },
  TRANSACTION: { icon: Zap,           color: "text-green-400",  bg: "bg-green-500/10"   },
  SUPPORT:     { icon: Info,          color: "text-[#5B3CF5]",  bg: "bg-[#5B3CF5]/10"   },
  ALERT:       { icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/10"     },
};

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Notifications() {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.notify.list.useQuery(
    { limit: 50 },
    { refetchInterval: 30_000 }
  );

  const markRead = trpc.notify.markRead.useMutation({
    onSuccess: () => {
      utils.notify.list.invalidate();
      utils.notify.unreadCount.invalidate();
    },
  });
  const markAll = trpc.notify.markAllRead.useMutation({
    onSuccess: () => {
      utils.notify.list.invalidate();
      utils.notify.unreadCount.invalidate();
    },
  });

  const notifications: any[] = Array.isArray(data) ? data : [];
  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 lg:pb-0">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-aegis-secondary-dark">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
          {unread > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#5B3CF5] text-white font-medium">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark hover:text-aegis-secondary-dark disabled:opacity-50 transition-colors"
          >
            {markAll.isPending
              ? <Loader2 size={12} className="animate-spin"/>
              : <CheckCheck size={12}/>
            }
            Mark all read
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={22} className="animate-spin text-aegis-tertiary-dark"/>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && notifications.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-aegis-bg-elevated flex items-center justify-center">
            <Bell size={24} className="text-aegis-tertiary-dark opacity-50"/>
          </div>
          <p className="text-sm font-medium dark:text-white">No notifications yet</p>
          <p className="text-xs text-aegis-tertiary-dark max-w-xs">
            System updates and messages will appear here
          </p>
        </div>
      )}

      {/* Notification list */}
      {!isLoading && notifications.length > 0 && (
        <AnimatePresence initial={false}>
          <div className="space-y-2">
            {notifications.map((n, i) => {
              const typeKey = (n.type ?? "SYSTEM").toUpperCase();
              const cfg = TYPE_CFG[typeKey] ?? TYPE_CFG.SYSTEM;
              const Icon = cfg.icon;

              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`relative bg-card border rounded-xl p-4 flex gap-3 transition-all
                    ${!n.isRead
                      ? "border-[#5B3CF5]/30 bg-[#5B3CF5]/5"
                      : "border-border opacity-75"
                    }`}
                >
                  {/* Type icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <Icon size={16} className={cfg.color}/>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold dark:text-white leading-snug">{n.title}</p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#5B3CF5] flex-shrink-0 mt-1.5"/>
                      )}
                    </div>
                    <p className="text-xs text-aegis-secondary-dark mt-0.5 leading-relaxed line-clamp-3">
                      {n.body}
                    </p>
                    <p className="text-[11px] text-aegis-tertiary-dark mt-1.5">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>

                  {/* Mark individual as read */}
                  {!n.isRead && (
                    <button
                      onClick={() => markRead.mutate({ ids: [n.id] })}
                      disabled={markRead.isPending}
                      className="absolute top-3 right-3 p-1 rounded-lg hover:bg-aegis-bg-elevated text-aegis-tertiary-dark hover:text-green-400 transition-colors"
                      title="Mark as read"
                    >
                      <Check size={13}/>
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
