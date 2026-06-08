import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { authApi } from '../api/auth.api';
import { queryKeys } from '../../../lib/queryKeys';

export function useMe() {
  const { setUser, setLoading, logout } = useAuthStore();

  const query = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.isSuccess && query.data) {
      setUser(query.data);
      setLoading(false);
    }
  }, [query.isSuccess, query.data, setUser, setLoading]);

  useEffect(() => {
    if (query.isError) {
      logout();
    }
  }, [query.isError, logout]);

  return query;
}
