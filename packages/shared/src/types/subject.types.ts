// Producto — Estudio con IA · Materias y Temas (contexto compartido) — README §3.3
// Fuente de verdad única: materias → temas → progreso (§3.4).

export enum TopicStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum TopicDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

// DECISIÓN: las entidades de respuesta usan `string` (ISO) en fechas — es el contrato JSON
// que cruza el cable y consume React Query (patrón de notification/admin). El mapeo Date→string
// vive en el service/controller de C/D/E. Ver plan A.2/A.3.

export interface Subject {
  id: string;
  userId: string;
  name: string;
  examDate: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  userId: string;
  name: string;
  description: string | null;
  status: TopicStatus;
  difficulty: TopicDifficulty;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Árbol materia→temas (planner / contexto del chat). El Agente C resuelve el include sin N+1.
export interface SubjectWithTopics extends Subject {
  topics: Topic[];
}
