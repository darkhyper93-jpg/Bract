import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

// ============================================================================
// Contexto compartido (Agente F) — grafo de invalidaciones cross-feature en UN SOLO lugar.
// Fuente de verdad única: materias/temas/progreso (`planner.subjects`, reusado por flashcards y por
// el chat server-side). Centralizar el grafo acá evita que el planner alcance keys de flashcards
// ad hoc y mantiene la dependencia documentada en un único punto. Ver README §8.6.
//
// El CHAT no se invalida nunca: ensambla su contexto en el backend en cada mensaje, así que el
// próximo mensaje ya ve el progreso real (no hay estado de contexto duplicado en el cliente).
// ============================================================================

// Cambio de ESTADO de un tema (completar / reabrir). En el backend dispara dos efectos: recálculo
// del plan activo y ajuste de la rotación SRS de las flashcards de ESE tema (activar/pausar).
// Invalida el árbol, el plan y las cartas del tema + la cola due.
export function invalidateAfterTopicStatusChange(qc: QueryClient, topicId: string): void {
  qc.invalidateQueries({ queryKey: queryKeys.planner.subjects() });
  qc.invalidateQueries({ queryKey: queryKeys.planner.plan() });
  qc.invalidateQueries({ queryKey: queryKeys.flashcards.byTopic(topicId) });
  qc.invalidateQueries({ queryKey: queryKeys.flashcards.due() });
}

// Acción de estudio que cuenta para el juego (Agente J): responder/corregir quiz, repasar una carta,
// completar un item del plan o un tema. El backend muta XP/misiones/jefe/racha POR EFECTO (anti-trampa,
// el cliente nunca se "da" XP); acá solo invalidamos el summary para que la Home refetchee y dispare los
// momentos animados (diff del estado previo vs el nuevo). Best-effort: si el summary aún no existe, la
// invalidación es inocua. Centralizado acá para no esparcir la key de gamificación por cada hook.
export function invalidateAfterStudyAction(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.gamification.summary() });
}

// Cambio ESTRUCTURAL del árbol (crear/editar/borrar materia o tema). Borrar cascadea a flashcards
// (Subject/Topic `onDelete: Cascade`), así que se invalida toda la rama flashcards para no dejar
// cartas fantasma en `due` ni en las vistas por tema. Editar refresca labels (tema/materia).
export function invalidateAfterTreeChange(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: queryKeys.planner.subjects() });
  qc.invalidateQueries({ queryKey: queryKeys.planner.plan() });
  qc.invalidateQueries({ queryKey: queryKeys.flashcards.all() });
}
