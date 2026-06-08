import { useQuery } from '@tanstack/react-query';
import { getAnalyticsOverview, getUserGrowth, getActivity } from '../api/analytics.api';

const STALE_TIME = 5 * 60 * 1000;

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: getAnalyticsOverview,
    staleTime: STALE_TIME,
  });
}

export function useUserGrowth(days: number) {
  return useQuery({
    queryKey: ['analytics', 'users', { days }],
    queryFn: () => getUserGrowth({ days }),
    staleTime: STALE_TIME,
  });
}

export function useActivity(days: number) {
  return useQuery({
    queryKey: ['analytics', 'activity', { days }],
    queryFn: () => getActivity({ days }),
    staleTime: STALE_TIME,
  });
}
