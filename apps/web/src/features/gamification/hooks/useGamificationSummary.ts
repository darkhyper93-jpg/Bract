import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { gamificationApi } from '../api/gamification.api';

// staleTime 30s: el summary cambia por efecto de acciones de estudio (quiz/flashcards/plan). Tras una
// acción, el hook de mutación invalida esta key (invalidateAfterStudyAction) → refetch + diff para los
// momentos animados. No necesita refetch agresivo por sí solo.
const STALE_MS = 30_000;

export function useGamificationSummary() {
  return useQuery({
    queryKey: queryKeys.gamification.summary(),
    queryFn: () => gamificationApi.getSummary(),
    staleTime: STALE_MS,
  });
}
