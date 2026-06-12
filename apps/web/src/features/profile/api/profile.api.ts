import apiClient from '../../../lib/axios';
import { User, UpdateProfileDto } from '@bract/shared';

interface ProfileResponse {
  success: true;
  // El backend envuelve el usuario en data.user (profile.controller)
  data: { user: User };
}

export const profileApi = {
  async getProfile(): Promise<User> {
    const res = await apiClient.get<ProfileResponse>('/profile');
    return res.data.data.user;
  },

  async updateProfile(dto: UpdateProfileDto): Promise<User> {
    const res = await apiClient.patch<ProfileResponse>('/profile', dto);
    return res.data.data.user;
  },

  async changePassword(dto: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.patch('/profile/password', dto);
  },

  async removeAvatar(): Promise<User> {
    const res = await apiClient.delete<ProfileResponse>('/profile/avatar');
    return res.data.data.user;
  },
};
