import { api, ApiResponse } from './client';
import { AuditLogEntry, UserSummary, UserRole } from '@spotcheck/shared';

export const auditApi = {
  getAuditLogs: (params?: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    facilityId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<AuditLogEntry[]>> => {
    return api.get('/audit', params);
  },
};

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationApi = {
  getNotifications: (params?: { unreadOnly?: boolean }): Promise<ApiResponse<AppNotification[]>> => {
    return api.get('/notifications', params);
  },

  markAsRead: (id: string): Promise<ApiResponse<void>> => {
    return api.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: (): Promise<ApiResponse<void>> => {
    return api.post('/notifications/read-all');
  },
};

export const userApi = {
  getUsers: (params?: { role?: string; isActive?: boolean }): Promise<ApiResponse<UserSummary[]>> => {
    return api.get('/users', params);
  },

  updateUserStatus: (id: string, isActive: boolean): Promise<ApiResponse<UserSummary>> => {
    return api.patch(`/users/${id}/status`, { isActive });
  },

  updateUserRole: (id: string, role: UserRole): Promise<ApiResponse<UserSummary>> => {
    return api.patch(`/users/${id}/role`, { role });
  },
};
