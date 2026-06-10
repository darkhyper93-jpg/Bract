import type { StudyPlanItemWithTopic, StudyPlanWithItems } from '@bract/shared';

// Helpers de presentación del Planificador (Agente C). El AGRUPADO POR DÍA es del cliente (§8.6):
// el backend devuelve los items planos; acá los colapsamos a días ordenados para la vista.

export interface PlanDayGroup {
  date: string; // yyyy-mm-dd (clave del día, en UTC para ser estable entre zonas)
  items: StudyPlanItemWithTopic[];
  totalMinutes: number;
}

// Clave de día estable: tomamos la porción yyyy-mm-dd del ISO (el backend persiste medianoche UTC).
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function groupPlanByDay(plan: StudyPlanWithItems | null | undefined): PlanDayGroup[] {
  if (!plan) return [];
  const map = new Map<string, PlanDayGroup>();

  for (const item of plan.items) {
    const key = dayKey(item.date);
    const group = map.get(key);
    if (group) {
      group.items.push(item);
      group.totalMinutes += item.estimatedMinutes;
    } else {
      map.set(key, { date: key, items: [item], totalMinutes: item.estimatedMinutes });
    }
  }

  const groups = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  // Dentro de cada día, ordenar por `order` (null al final) para respetar la secuencia de bloques.
  for (const group of groups) {
    group.items.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  }
  return groups;
}

// minutos → "1h 30m" / "45m" / "2h" (presentación; la unidad guardada es minutos, §3.4).
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Etiqueta legible de un día (yyyy-mm-dd) usando el locale activo. Parseado en UTC para no correr el día.
export function formatDayLabel(dayKeyStr: string, locale: string): string {
  const date = new Date(`${dayKeyStr}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}
