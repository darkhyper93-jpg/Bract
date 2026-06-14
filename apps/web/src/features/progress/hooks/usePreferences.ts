import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdatePreferencesInput } from '@bract/shared';
import { progressApi } from '../api/progress.api';

// Preferencias de estudio (I-2). La query cachea 5min; la mutation actualiza el cache e invalida el progreso
// (las prefs cambian la fórmula de debilidad y el plan → hay que refetchear).
export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => progressApi.getPreferences(),
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) => progressApi.updatePreferences(input),
    onSuccess: (data) => {
      qc.setQueryData(['preferences'], data);
      void qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}
