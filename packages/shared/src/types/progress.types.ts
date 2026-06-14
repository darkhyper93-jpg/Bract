// Producto — Progreso, puntos débiles y personalización (Agente I-2) — README §3.6.
// El progreso/debilidad es DERIVADO (on-the-fly): estos tipos describen la salida del motor,
// no entidades persistidas. El único modelo persistido nuevo es UserStudyPreferences.

// Espeja el enum de Prisma RemediationIntensity. Zod lo consume con z.nativeEnum.
export enum RemediationIntensity {
  OFF = 'OFF',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// Progreso de UN tema (derivado). `hasData=false` ⇒ sin quiz ni SRS → se omite del ranking (EmptyState).
export interface TopicProgress {
  topicId: string;
  name: string;
  accuracy: number | null; // correct/answered (solo ítems contestados); null si no hay quiz
  answered: number;
  weakness: number; // [0,1], 1 = más débil; 0 si !hasData
  lowConfidence: boolean; // answered < MIN_ANSWERS
  hasData: boolean;
}

// Progreso agregado por materia.
export interface SubjectProgress {
  subjectId: string;
  name: string;
  accuracy: number | null; // promedio de los temas con quiz; null si ninguno
  weakness: number | null; // promedio de los temas con datos; null si ninguno
  topics: TopicProgress[];
}

// Respuesta de GET /progress/overview.
export interface ProgressOverview {
  subjects: SubjectProgress[];
  totals: {
    topicsWithData: number;
    avgAccuracy: number | null;
    weakestTopicId: string | null;
  };
}

// Item de GET /progress/weak-topics (solo temas con datos, ordenados por weakness desc).
export interface WeakTopic {
  topicId: string;
  name: string;
  subjectId: string;
  subjectName: string;
  weakness: number;
  accuracy: number | null;
  lowConfidence: boolean;
}

// Preferencias de estudio (1:1 con User). `null` = usar default del motor.
export interface UserStudyPreferences {
  remediationIntensity: RemediationIntensity;
  prioritySubjectIds: string[];
  weightQuiz: number | null;
  weightSrs: number | null;
  dailyGoalMinutes: number | null;
}
