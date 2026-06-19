import type { AnswerReveal, PublicQuizQuestion, QuizScope } from '@bract/shared';

// Una pregunta ya respondida en el runner: la pregunta pública + lo que respondiste + la reveal del
// server. Se acumula en el runner y alimenta la pantalla de resultados (repaso local, sin refetch).
// MCQ usa `selectedIndex`; OPEN usa `studentAnswer` (texto libre). El otro queda null según el tipo.
export interface AnsweredQuestion {
  question: PublicQuizQuestion;
  selectedIndex: number | null;
  studentAnswer: string | null;
  reveal: AnswerReveal;
}

// Resumen con el que el runner cierra un intento → alimenta la pantalla de resultados (sin refetch).
// Lleva scope + topicCount + scopeName (nombre propio) para componer la etiqueta bilingüe en resultados.
export interface QuizRunResult {
  scope: QuizScope;
  scopeName: string;
  topicCount: number;
  totalCount: number;
  answers: AnsweredQuestion[];
}
