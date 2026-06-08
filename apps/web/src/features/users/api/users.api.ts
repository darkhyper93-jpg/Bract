import apiClient from '../../../lib/axios';
import { GetUsersQuery, UserListItem, UserPublic, Role, UserStatus } from '@bract/shared';

interface PaginatedUsersResponse {
  success: true;
  data: UserListItem[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

interface UserDetailResponse {
  success: true;
  data: UserPublic;
}

export const usersApi = {
  async getUsers(params: Partial<GetUsersQuery>): Promise<PaginatedUsersResponse> {
    const res = await apiClient.get('/users', { params });
    return res.data;
  },

  async getUserById(id: string): Promise<UserDetailResponse> {
    const res = await apiClient.get(`/users/${id}`);
    return res.data;
  },

  async changeUserRole(id: string, role: Role): Promise<UserDetailResponse> {
    const res = await apiClient.patch(`/users/${id}/role`, { role });
    return res.data;
  },

  async changeUserStatus(id: string, status: UserStatus): Promise<UserDetailResponse> {
    const res = await apiClient.patch(`/users/${id}/status`, { status });
    return res.data;
  },

  async deleteUser(id: string): Promise<{ success: true }> {
    const res = await apiClient.delete(`/users/${id}`);
    return res.data;
  },
};
