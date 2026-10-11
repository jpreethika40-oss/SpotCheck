import { api, ApiResponse } from './client';
import { UserSummary } from '@spotcheck/shared';

export interface LoginResponse {
  user: UserSummary;
  token: string;
}

export const authApi = {
  login: (credentials: { email: string; password: string }): Promise<ApiResponse<LoginResponse>> => {
    return api.post('/auth/login', credentials);
  },

  logout: (): Promise<ApiResponse<void>> => {
    return api.post('/auth/logout');
  },

  getCurrentUser: (): Promise<ApiResponse<{ user: UserSummary }>> => {
    return api.get('/auth/me');
  },

  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<void>> => {
    return api.post('/auth/change-password', data);
  },
};
