import type { SubjectWithTopics } from '@bract/shared';

// Próximo examen derivado EN CLIENTE del menor `Subject.examDate` futuro (§8.10) — sin endpoint nuevo.
// Comparación por día en UTC (los examDate y "hoy" se normalizan a medianoche UTC, igual que plan.utils).
export interface NextExam {
  subjectName: string;
  examDate: string; // ISO original
  daysUntil: number; // 0 = hoy, 1 = mañana, …
}

function dayUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function getNextExam(
  subjects: SubjectWithTopics[],
  now: Date = new Date(),
): NextExam | null {
  const today = dayUtc(now);
  let best: { exam: number; subject: SubjectWithTopics } | null = null;

  for (const subject of subjects) {
    if (!subject.examDate) continue;
    const exam = dayUtc(new Date(subject.examDate));
    if (exam < today) continue; // examen pasado → no es "próximo"
    if (!best || exam < best.exam) best = { exam, subject };
  }

  if (!best) return null;
  return {
    subjectName: best.subject.name,
    examDate: best.subject.examDate as string,
    daysUntil: Math.round((best.exam - today) / 86_400_000),
  };
}
