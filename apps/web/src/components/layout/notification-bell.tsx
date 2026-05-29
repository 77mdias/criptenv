"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Mail, UserPlus, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationsStore } from "@/stores/notifications";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, React.ReactNode> = {
  invite: <UserPlus className="h-4 w-4 text-(--accent)" />,
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
  const router = useRouter();
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

  const handleNotificationClick = useCallback(
    (notification: (typeof notifications)[0]) => {
      if (!notification.read_at) {
        markAsRead(notification.id);
      }
      if (notification.action_url) {
        router.push(notification.action_url);
      }
    },
    [markAsRead, router]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notificações"
        aria-expanded={isOpen}
        className="relative h-8 w-8 sm:h-10 sm:w-10"
        onClick={toggleOpen}
      >
        <Bell className="h-4 w-4 text-(--text-tertiary)" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--danger) px-1 text-[10px] font-bold leading-none text-white ring-2 ring-(--background)">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-(--border) bg-(--surface-elevated) shadow-[var(--shadow-xl)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-(--border) bg-(--surface-elevated) px-4 py-3">
            <h3 className="text-sm font-semibold text-(--text-primary)">
              Notificações
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-(--text-tertiary) transition-colors hover:text-(--text-primary)"
              >
                <Check className="h-3 w-3" />
                Marcar todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-(--text-tertiary)">
                Carregando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-(--border) bg-(--background-muted)">
                  <Bell className="h-5 w-5 text-(--text-muted)" />
                </div>
                <p className="text-sm font-medium text-(--text-secondary)">
                  Nenhuma notificação ainda
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const isUnread = !notification.read_at;
                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 border-b border-(--border) px-4 py-3.5 text-left transition-colors last:border-b-0",
                      isUnread
                        ? "bg-(--background-muted) hover:bg-(--background-subtle)"
                        : "hover:bg-(--background-muted)"
                    )}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-(--border) bg-(--surface)">
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
                      <span className="mt-2 h-2 w-2 rounded-full bg-(--accent) shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
