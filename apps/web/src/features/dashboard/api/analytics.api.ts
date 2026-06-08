import apiClient from '../../../lib/axios';
import type { ApiResponse, AnalyticsOverview, UserGrowthPoint, ActivityPoint } from '@bract/shared';

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const { data } = await apiClient.get<ApiResponse<AnalyticsOverview>>('/analytics/overview');
  return data.data;
}

export async function getUserGrowth(params: { days: number }): Promise<UserGrowthPoint[]> {
  const { data } = await apiClient.get<ApiResponse<UserGrowthPoint[]>>('/analytics/users', { params });
  return data.data;
}

export async function getActivity(params: { days: number }): Promise<ActivityPoint[]> {
  const { data } = await apiClient.get<ApiResponse<ActivityPoint[]>>('/analytics/activity', { params });
  return data.data;
}
