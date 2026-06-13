import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateAfterTreeChange } from '../../../lib/invalidateStudyContext';
import { importApi } from '../api/import.api';

// Mutaciones de Importación de temas (Agente K). `extract` no toca cache (es un preview). `commit`
// crea/modifica materias y temas → invalida el árbol del planner + la rama flashcards (grafo central
// de Agente F en `invalidateStudyContext`): así el planner y las flashcards reflejan los temas nuevos.
export function useImport() {
  const queryClient = useQueryClient();

  const extract = useMutation({
    mutationFn: importApi.extract,
  });

  // Variante desde archivo: también es un preview, no toca cache (igual que `extract`).
  const extractFile = useMutation({
    mutationFn: importApi.extractFile,
  });

  const commit = useMutation({
    mutationFn: importApi.commit,
    onSuccess: () => invalidateAfterTreeChange(queryClient),
  });

  return { extract, extractFile, commit };
}
