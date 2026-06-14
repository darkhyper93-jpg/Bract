import type { AnswerReveal, PublicQuizQuestion } from '@bract/shared';

// Una pregunta ya respondida en el runner: la pregunta pública + lo que elegiste + la reveal del server.
// Se acumula en el runner y alimenta la pantalla de resultados (repaso local, sin refetch).
export interface AnsweredQuestion {
  question: PublicQuizQuestion;
  selectedIndex: number;
  reveal: AnswerReveal;
}

// Resumen con el que el runner cierra un intento → alimenta la pantalla de resultados (sin refetch).
export interface QuizRunResult {
  scopeName: string;
  totalCount: number;
  answers: AnsweredQuestion[];
}
