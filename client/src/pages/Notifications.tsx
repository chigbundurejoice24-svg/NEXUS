/**
 * Notifications.tsx — Real notifications from tRPC
 * Mark as read, clear all, type icons, empty state
 */
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, Loader2, Megaphone, Shield, Gift, AlertTriangle, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_CFG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  BROADCAST: { icon: Megaphone,      color: "text-blue-500",   bg: "bg-blue-500/10"   },
  SYSTEM:    { icon: Shield,         color: "text-purple-500", bg: "bg-purple-500/10" },
  PROMO:     { icon: Gift,           color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ALERT:     { icon: AlertTriangle,  color: "text-red-500",    bg: "bg-red-500/10"    },
  INFO:      { icon: Info,           color: "text-aegis-accent-purple", bg: "bg-[#5B3CF5]/10" },
};

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Notifications() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.notify.list.useQuery({ limit: 50, offset: 0 }, { refetchInterval: 30_000 });
  const markRead  = trpc.notify.markRead.useMutation({ onSuccess: () => utils.notify.list.invalidate() });
  const markAll   = trpc.notify.markAllRead.useMutation({ onSuccess: () => utils.notify.list.invalidate() });

  const notifications: any[] = (data as any) ?? [];
  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-aegis-secondary-dark">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
          {unread > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#5B3CF5] text-white font-medium">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1.5 text-xs text-aegis-accent-purple hover:opacity-80 disabled:opacity-40">
            {markAll.isPending ? <Loader2 size={12} className="animate-spin"/> : <CheckCheck size={12}/>}
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-20 rounded-xl"/>)}</div>
      ) : notifications.length === 0 ? (
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
          className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-aegis-bg-elevated flex items-center justify-center mx-auto mb-4">
            <Bell size={28} className="text-aegis-tertiary-dark"/>
          </div>
          <p className="text-sm font-semibold dark:text-white">No notifications yet</p>
          <p className="text-xs text-aegis-tertiary-dark mt-1">Transaction alerts and updates will appear here</p>
        </motion.div>
      ) : (
        <AnimatePresence>
          {notifications.map((n: any, i: number) => {
            const cfg = TYPE_CFG[n.type] ?? TYPE_CFG.INFO;
            const Icon = cfg.icon;
            return (
              <motion.div key={n.id}
                initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-20}}
                transition={{delay: i * 0.03}}
                className={`bg-card border rounded-xl p-4 flex items-start gap-3 transition-colors ${!n.isRead ? "border-[#5B3CF5]/30 bg-[#5B3CF5]/5" : "border-border"}`}>
                <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon size={16} className={cfg.color}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium dark:text-white ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                    <span className="text-[10px] text-aegis-tertiary-dark whitespace-nowrap flex-shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-aegis-secondary-dark mt-0.5 leading-relaxed">{n.body}</p>
                </div>
                {!n.isRead && (
                  <button onClick={() => markRead.mutate({ notificationId: n.id })}
                    className="p-1.5 rounded-lg hover:bg-aegis-bg-elevated transition-colors flex-shrink-0 mt-0.5">
                    <Check size={13} className="text-aegis-accent-purple"/>
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
