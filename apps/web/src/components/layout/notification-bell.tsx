"use client";

import { useEffect, useRef } from "react";
import { Bell, Check, Mail, UserPlus, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationsStore } from "@/stores/notifications";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, React.ReactNode> = {
  invite: <UserPlus className="h-4 w-4 text-indigo-500" />,
  alert: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  system: <Info className="h-4 w-4 text-blue-500" />,
  email: <Mail className="h-4 w-4 text-emerald-500" />,
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isOpen,
    isLoading,
    toggleOpen,
    markAsRead,
    markAllAsRead,
    fetchUnreadCount,
  } = useNotificationsStore();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        useNotificationsStore.getState().setOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        className="relative h-8 w-8 sm:h-10 sm:w-10"
        onClick={toggleOpen}
      >
        <Bell className="h-4 w-4 text-(--text-muted)" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1rem)] rounded-xl border border-(--border) bg-(--card) shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
            <h3 className="text-sm font-semibold text-(--text-primary)">
              Notificações
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                className="text-xs text-(--text-muted) hover:text-(--text-primary) transition-colors flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-(--text-muted)">
                Carregando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-(--text-muted)">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma notificação ainda
              </div>
            ) : (
              notifications.map((notification) => {
                const isUnread = !notification.read_at;
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-(--border) last:border-b-0",
                      isUnread
                        ? "bg-(--accent)/5 hover:bg-(--accent)/10"
                        : "hover:bg-(--muted)"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {typeIcons[notification.type] || typeIcons.system}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          isUnread
                            ? "font-medium text-(--text-primary)"
                            : "text-(--text-secondary)"
                        )}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-(--text-muted) mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[11px] text-(--text-muted) mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
