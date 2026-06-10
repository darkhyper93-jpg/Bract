import { TopicStatus } from '@bract/shared';
import type { SubjectWithTopics, Topic, TopicDifficulty } from '@bract/shared';

// Ensamblador de contexto del estudiante (el diferencial de Bract): a partir del árbol
// materias→temas→progreso arma un resumen ACOTADO (por tokens y costo) que consume el chat.
// NO vuelca toda la DB en el prompt: lista hasta MAX_TOPICS_LISTED temas pendientes por materia.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TOPICS_LISTED = 15;

export interface StudentContextTopic {
  id: string;
  name: string;
  status: TopicStatus;
  difficulty: TopicDifficulty;
}

export interface StudentContextSubject {
  id: string;
  name: string;
  examDate: string | null;
  daysUntilExam: number | null;
  topics: StudentContextTopic[];
}

export interface StudentContext {
  subjects: StudentContextSubject[];
  pendingTopicCount: number;
  completedTopicCount: number;
  nextExam: { subjectName: string; examDate: string; daysUntilExam: number } | null;
}

function dayDiff(now: Date, target: Date): number {
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/** Arma el contexto condensado del estudiante desde el árbol materias→temas. */
export function assembleStudentContext(
  subjects: SubjectWithTopics[],
  now: Date = new Date(),
): StudentContext {
  let pendingTopicCount = 0;
  let completedTopicCount = 0;
  let nextExam: StudentContext['nextExam'] = null;

  const ctxSubjects: StudentContextSubject[] = subjects.map((s) => {
    let daysUntilExam: number | null = null;
    if (s.examDate) {
      const d = new Date(s.examDate);
      if (!Number.isNaN(d.getTime())) {
        daysUntilExam = dayDiff(now, d);
        if (daysUntilExam >= 0 && (nextExam === null || daysUntilExam < nextExam.daysUntilExam)) {
          nextExam = { subjectName: s.name, examDate: s.examDate, daysUntilExam };
        }
      }
    }

    const topics: StudentContextTopic[] = s.topics.map((t: Topic) => {
      if (t.status === TopicStatus.COMPLETED) completedTopicCount += 1;
      else pendingTopicCount += 1;
      return { id: t.id, name: t.name, status: t.status, difficulty: t.difficulty };
    });

    return { id: s.id, name: s.name, examDate: s.examDate, daysUntilExam, topics };
  });

  return { subjects: ctxSubjects, pendingTopicCount, completedTopicCount, nextExam };
}

/** Renderiza el contexto como texto ACOTADO para inyectar en el system prompt del chat. */
export function renderContextForPrompt(ctx: StudentContext): string {
  const lines: string[] = [
    'Resumen del estudiante (usalo para personalizar tus respuestas):',
  ];

  if (ctx.subjects.length === 0) {
    lines.push('- Todavía no cargó materias ni temas.');
  }

  for (const s of ctx.subjects) {
    lines.push(
      s.examDate && s.daysUntilExam !== null
        ? `- ${s.name} (examen ${s.examDate}, en ${s.daysUntilExam} día(s))`
        : `- ${s.name} (sin fecha de examen)`,
    );

    const pending = s.topics.filter((t) => t.status !== TopicStatus.COMPLETED);
    const completed = s.topics.filter((t) => t.status === TopicStatus.COMPLETED);
    if (pending.length > 0) {
      const names = pending.slice(0, MAX_TOPICS_LISTED).map((t) => t.name);
      const extra = pending.length - names.length;
      lines.push(`    Pendientes: ${names.join(', ')}${extra > 0 ? ` (+${extra} más)` : ''}`);
    }
    lines.push(`    Completados: ${completed.length}`);
  }

  if (ctx.nextExam) {
    lines.push(`Próximo examen: ${ctx.nextExam.subjectName} en ${ctx.nextExam.daysUntilExam} día(s).`);
  }
  lines.push(`Totales: ${ctx.pendingTopicCount} pendientes, ${ctx.completedTopicCount} completados.`);

  return lines.join('\n');
}
