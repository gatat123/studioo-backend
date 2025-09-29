import { getAuthHeaders } from '@/lib/api/helpers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  projectId?: string;
  projectName?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  link?: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  email: boolean;
  types: Record<string, boolean>;
}

// Get all notifications
export async function getNotifications(): Promise<NotificationResponse[]> {
  const response = await fetch(`${API_URL}/notifications`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  return response.json();
}

// Get unread notifications count
export async function getUnreadCount(): Promise<number> {
  const response = await fetch(`${API_URL}/notifications/unread-count`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch unread count');
  }

  const data = await response.json();
  return data.count;
}

// Mark notification as read
export async function markAsRead(notificationId: string): Promise<void> {
  const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to mark notification as read');
  }
}

// Mark all notifications as read
export async function markAllAsRead(): Promise<void> {
  const response = await fetch(`${API_URL}/notifications/read-all`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to mark all notifications as read');
  }
}

// Delete notification
export async function deleteNotification(notificationId: string): Promise<void> {
  const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete notification');
  }
}

// Clear all notifications
export async function clearAllNotifications(): Promise<void> {
  const response = await fetch(`${API_URL}/notifications`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to clear notifications');
  }
}

// Get notification settings
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await fetch(`${API_URL}/notifications/settings`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch notification settings');
  }

  return response.json();
}

// Update notification settings
export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const response = await fetch(`${API_URL}/notifications/settings`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error('Failed to update notification settings');
  }

  return response.json();
}

// Test notification
export async function sendTestNotification(): Promise<void> {
  const response = await fetch(`${API_URL}/notifications/test`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to send test notification');
  }
}