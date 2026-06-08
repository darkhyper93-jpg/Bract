import apiClient from '../../../lib/axios';
import {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  User,
} from '@bract/shared';
import { AuthResponse, RefreshResponse } from '../types/auth.types';

export const authApi = {
  async login(body: LoginInput): Promise<AuthResponse> {
    const res = await apiClient.post<{ data: AuthResponse }>('/auth/login', body);
    return res.data.data;
  },

  async register(body: RegisterInput): Promise<AuthResponse> {
    const res = await apiClient.post<{ data: AuthResponse }>('/auth/register', body);
    return res.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async refresh(): Promise<RefreshResponse> {
    const res = await apiClient.post<{ data: RefreshResponse }>('/auth/refresh');
    return res.data.data;
  },

  async me(): Promise<User> {
    const res = await apiClient.get<{ data: User }>('/auth/me');
    return res.data.data;
  },

  async forgotPassword(body: { email: string }): Promise<void> {
    await apiClient.post('/auth/forgot-password', body);
  },

  async resetPassword(body: ResetPasswordInput): Promise<void> {
    await apiClient.post('/auth/reset-password', body);
  },

  async verifyEmail(token: string): Promise<void> {
    await apiClient.get(`/auth/verify-email`, { params: { token } });
  },
};
