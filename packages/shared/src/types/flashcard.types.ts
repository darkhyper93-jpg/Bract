// Producto — Estudio con IA · Flashcards + SRS (SM-2 simplificado) — README §3.3 / Apéndice B.

export enum FlashcardSource {
  AI = 'AI',
  MANUAL = 'MANUAL',
}

export interface Flashcard {
  id: string;
  topicId: string;
  userId: string;
  question: string;
  answer: string;
  source: FlashcardSource;
  // Estado SRS
  ease: number;
  intervalDays: number;
  reps: number; // repasos exitosos consecutivos (1º→1d, 2º→6d, ...)
  dueDate: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Carta + contexto de su tema/materia. Usado SOLO por GET /flashcards/due: la sesión de
// estudio cruza varios temas y muestra "Repasando: <tema> · <materia>". Coordinación D↔A
// (extensión aditiva del contrato del Agente A) — ver error.md.
export interface FlashcardWithTopic extends Flashcard {
  topic: {
    id: string;
    name: string;
    subjectName: string;
  };
}
