import { request } from "./client";
import type {
  NotificationListResponse,
  UnreadCountResponse,
  MarkReadResponse,
  MarkAllReadResponse,
} from "./client";

export async function listNotifications(
  unreadOnly = false,
  limit = 50,
  offset = 0
): Promise<NotificationListResponse> {
  return request<NotificationListResponse>("GET", "/api/v1/notifications", undefined, {
    unread_only: unreadOnly ? "true" : undefined,
    limit,
    offset,
  });
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  return request<UnreadCountResponse>("GET", "/api/v1/notifications/unread-count");
}

export async function markAsRead(notificationId: string): Promise<MarkReadResponse> {
  return request<MarkReadResponse>("PATCH", `/api/v1/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<MarkAllReadResponse> {
  return request<MarkAllReadResponse>("PATCH", "/api/v1/notifications/read-all");
}
