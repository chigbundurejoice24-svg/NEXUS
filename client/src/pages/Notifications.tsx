/**
 * Notifications.tsx — User notification centre
 * Shows personal + broadcast notifications, marks all read on open
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCheck, Loader2, Megaphone, AlertCircle, Zap, LifeBuoy, Gift } from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  SYSTEM:      Zap,
  BROADCAST:   Megaphone,
  TRANSACTION: AlertCircle,
  SUPPORT:     LifeBuoy,
  PROMO:       Gift,
};

export default function Notifications() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.notify.list.useQuery({ limit: 50 });
  const markAllRead = trpc.notify.markAllRead.useMutation({
    onSuccess: () => utils.notify.unreadCount.invalidate(),
  });

  // Mark all read when page opens
  useEffect(() => {
    markAllRead.mutate();
  }, []);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-aegis-primary-dark dark:text-white flex items-center gap-2">
          <Bell size={20} className="text-[#5B3CF5]" /> Notifications
        </h1>
        {data && data.length > 0 && (
          <span className="text-xs text-aegis-tertiary-dark flex items-center gap-1">
            <CheckCheck size={12} /> All marked read
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-aegis-tertiary-dark" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
          <Bell size={36} className="mx-auto text-aegis-tertiary-dark opacity-40" />
          <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">
            You're all caught up
          </p>
          <p className="text-xs text-aegis-tertiary-dark">
            Important updates about your account and transactions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(n => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            return (
              <div
                key={n.id}
                onClick={() => n.actionUrl && navigate(n.actionUrl)}
                className={`bg-card border rounded-xl p-4 flex gap-3 transition-colors ${
                  n.actionUrl ? "cursor-pointer hover:border-[#5B3CF5]/50" : ""
                } ${n.isRead ? "border-border opacity-70" : "border-[#5B3CF5]/40"}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  n.type === "BROADCAST" ? "bg-[#F5A623]/20" :
                  n.type === "SUPPORT"   ? "bg-blue-500/20"  :
                  n.type === "PROMO"     ? "bg-green-500/20" : "bg-[#5B3CF5]/20"
                }`}>
                  <Icon size={16} className={
                    n.type === "BROADCAST" ? "text-[#F5A623]" :
                    n.type === "SUPPORT"   ? "text-blue-400"  :
                    n.type === "PROMO"     ? "text-green-400" : "text-[#5B3CF5]"
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-[#5B3CF5] rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-aegis-secondary-dark mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-aegis-tertiary-dark mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
