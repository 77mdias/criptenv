import { create } from "zustand";
import type { Notification } from "@/lib/api/client";
import {
  listNotifications,
  getUnreadCount,
  markAsRead as apiMarkAsRead,
  markAllAsRead as apiMarkAllAsRead,
} from "@/lib/api/notifications";

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  hasLoaded: boolean;

  // Actions
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,
  hasLoaded: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const data = await listNotifications(false, 50, 0);
      set({
        notifications: data.notifications,
        unreadCount: data.unread_count,
        hasLoaded: true,
      });
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await getUnreadCount();
      set({ unreadCount: data.unread_count });
      if (get().isOpen) {
        await get().fetchNotifications();
      }
    } catch (e) {
      console.error("Failed to fetch unread count", e);
    }
  },

  markAsRead: async (id: string) => {
    try {
      await apiMarkAsRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  },

  markAllAsRead: async () => {
    try {
      await apiMarkAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (e) {
      console.error("Failed to mark all notifications as read", e);
    }
  },

  toggleOpen: () => {
    const next = !get().isOpen;
    set({ isOpen: next });
    if (next) {
      get().fetchNotifications();
    }
  },

  setOpen: (open: boolean) => {
    set({ isOpen: open });
    if (open) {
      get().fetchNotifications();
    }
  },
}));
