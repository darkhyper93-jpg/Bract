import { useQuery } from '@tanstack/react-query';
import { progressApi } from '../api/progress.api';

// staleTime 60s: el progreso cambia al responder quizzes/repasar; no necesita refetch agresivo.
const STALE_MS = 60_000;

export function useProgressOverview() {
  return useQuery({
    queryKey: ['progress', 'overview'],
    queryFn: () => progressApi.getOverview(),
    staleTime: STALE_MS,
  });
}

export function useWeakTopics(limit = 10) {
  return useQuery({
    queryKey: ['progress', 'weak', limit],
    queryFn: () => progressApi.getWeakTopics(limit),
    staleTime: STALE_MS,
  });
}
