// Producto — Evaluación / Quiz (Agente I) — IDEAS_POST_MVP §"Agente I", README §3.5.
// Quiz de opción múltiple por tema o materia con CORRECCIÓN POR PREGUNTA EN EL SERVIDOR y anti-trampa:
// generar crea el intento IN_PROGRESS y persiste correctIndex + explicaciones AUTORITATIVOS en el server;
// al cliente solo viajan preguntas PÚBLICAS (sin la respuesta ni la explicación). Responder de a una
// pregunta corrige contra el valor guardado, bloquea re-responder y recién ahí revela esa pregunta.
// Datos persistidos (topicId + isCorrect + índices) habilitan después I-2 (puntos débiles).

// Espejan los enums de Prisma. Zod los consume con z.nativeEnum → una sola lista de valores.
export enum QuizScope {
  TOPIC = 'TOPIC',
  SUBJECT = 'SUBJECT',
}

export enum QuizAttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// Opción COMPLETA (texto + explicación). Solo se expone tras responder (reveal) o al revisar el detalle.
export interface QuizOption {
  text: string;
  explanation: string;
}

// Opción PÚBLICA: solo el texto. Es lo que ve el cliente mientras responde (sin pistas de la correcta).
export interface PublicQuizOption {
  text: string;
}

// Pregunta PÚBLICA: sin correctIndex ni explicación (anti-trampa). El cliente responde con esto.
export interface PublicQuizQuestion {
  order: number;
  topicId: string | null;
  question: string;
  options: PublicQuizOption[];
}

// Respuesta de GENERAR (POST /quiz/attempts): el intento creado + las preguntas públicas a responder.
export interface GeneratedAttempt {
  attemptId: string;
  scope: QuizScope;
  subjectId: string | null;
  topicId: string | null;
  scopeName: string;
  totalCount: number;
  questions: PublicQuizQuestion[];
}

// Respuesta de RESPONDER (POST /quiz/attempts/:id/answers): la reveal de ESA pregunta (corregida en server).
export interface AnswerReveal {
  order: number;
  isCorrect: boolean;
  correctIndex: number;
  options: QuizOption[]; // con explicación (recién acá se exponen)
}

// ---- Entidades persistidas (mappers Date→ISO, enum casteado, en el service) ----

export interface QuizAttempt {
  id: string;
  userId: string;
  scope: QuizScope;
  status: QuizAttemptStatus;
  subjectId: string | null;
  topicId: string | null;
  scopeName: string;
  totalCount: number;
  correctCount: number; // puntaje (recalculado en el server con cada respuesta)
  completedAt: string | null;
  createdAt: string;
}

// Opción en el DETALLE de un intento: la explicación SOLO viaja si la pregunta ya fue contestada
// (anti-trampa: para los items sin responder de un intento IN_PROGRESS, `explanation` viene undefined).
export interface QuizAttemptItemOption {
  text: string;
  explanation?: string;
}

export interface QuizAttemptItem {
  id: string;
  attemptId: string;
  userId: string;
  topicId: string | null;
  order: number;
  question: string;
  // Snapshot persistido. Para un item SIN responder, las opciones llegan SOLO con `text`.
  options: QuizAttemptItemOption[];
  // null = pregunta SIN responder (no se revela la correcta hasta contestar — anti-trampa).
  correctIndex: number | null;
  selectedIndex: number | null; // null = sin responder
  isCorrect: boolean; // lo decide el server al comparar contra correctIndex
  createdAt: string;
}

// Detalle de un intento (GET /quiz/attempts/:id): el intento + sus items completos (con explicaciones).
export interface QuizAttemptWithItems extends QuizAttempt {
  items: QuizAttemptItem[];
}
