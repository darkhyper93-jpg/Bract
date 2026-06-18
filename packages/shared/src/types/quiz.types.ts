// Producto — Evaluación / Quiz (Agente I) — IDEAS_POST_MVP §"Agente I", README §3.5.
// Quiz de opción múltiple por tema o materia con CORRECCIÓN POR PREGUNTA EN EL SERVIDOR y anti-trampa:
// generar crea el intento IN_PROGRESS y persiste correctIndex + explicaciones AUTORITATIVOS en el server;
// al cliente solo viajan preguntas PÚBLICAS (sin la respuesta ni la explicación). Responder de a una
// pregunta corrige contra el valor guardado, bloquea re-responder y recién ahí revela esa pregunta.
// Datos persistidos (topicId + isCorrect + índices) habilitan después I-2 (puntos débiles).

// Espejan los enums de Prisma. Zod los consume con z.nativeEnum → una sola lista de valores.
// El cliente NO manda scope: envía { subjectId, topicIds[] } y el server lo DERIVA (1=TOPIC,
// todos los temas de la materia=SUBJECT, subconjunto=MULTI_TOPIC). Ver README §3.5.
export enum QuizScope {
  TOPIC = 'TOPIC',
  SUBJECT = 'SUBJECT',
  MULTI_TOPIC = 'MULTI_TOPIC',
}

export enum QuizAttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// Calibración de confianza (Calidad de aprendizaje, fase 1). Antes de revelar, el alumno declara qué tan
// seguro está; el cruce confianza vs acierto detecta la sobreconfianza (HIGH + incorrecta). Espeja el enum
// de Prisma → Zod lo consume con z.nativeEnum. Es OPCIONAL al responder (null = no declarada).
export enum ConfidenceLevel {
  GUESS = 'GUESS', // adiviné
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// Tipo de pregunta (Calidad de aprendizaje, fase abiertas). MCQ = opción múltiple (anti-trampa por
// correctIndex). OPEN = respuesta corta libre corregida por la IA (anti-trampa por expectedAnswer
// server-only). Espeja el enum de Prisma; default MCQ ⇒ retrocompatible con los items viejos.
export enum QuestionType {
  MCQ = 'MCQ',
  OPEN = 'OPEN',
}

// Nota de 3 estados de una respuesta abierta (la decide la IA, server-side, anclada al material).
// Se persiste para el feedback al alumno. Para I-2 se deriva un isCorrect binario: true SOLO si CORRECT
// (PARTIAL e INCORRECT cuentan como no-correcta → el tema sigue marcado como débil).
export enum OpenGrade {
  CORRECT = 'CORRECT',
  PARTIAL = 'PARTIAL',
  INCORRECT = 'INCORRECT',
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

// Pregunta PÚBLICA: sin correctIndex/expectedAnswer ni explicación (anti-trampa). El cliente responde
// con esto. En MCQ `options` trae las opciones (solo texto); en OPEN `options` viene vacío (`[]`) — el
// alumno escribe libre y el criterio NUNCA viaja antes de responder.
export interface PublicQuizQuestion {
  order: number;
  type: QuestionType;
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
  scopeName: string; // nombre propio (tema o materia); la etiqueta "N temas de X" la compone el front
  topicCount: number; // nº de temas elegidos (1=TOPIC, N=MULTI, todos=SUBJECT) → render bilingüe
  totalCount: number;
  questions: PublicQuizQuestion[];
}

// Respuesta de RESPONDER (POST /quiz/attempts/:id/answers): la reveal de ESA pregunta (corregida en
// server). Unión discriminada por `type`: recién acá viajan correctIndex+explicaciones (MCQ) o
// grade+feedback+expectedAnswer (OPEN). Antes de responder NADA de esto está en el cliente (anti-trampa).
export type AnswerReveal =
  | {
      type: QuestionType.MCQ;
      order: number;
      isCorrect: boolean;
      correctIndex: number;
      options: QuizOption[]; // con explicación (recién acá se exponen)
    }
  | {
      type: QuestionType.OPEN;
      order: number;
      isCorrect: boolean; // true SOLO si grade === CORRECT
      grade: OpenGrade; // nota de 3 estados (fuente de verdad de la IA)
      feedback: string; // devolución de la IA, anclada al material
      expectedAnswer: string; // criterio/respuesta esperada (recién acá se expone)
    };

// ---- Entidades persistidas (mappers Date→ISO, enum casteado, en el service) ----

export interface QuizAttempt {
  id: string;
  userId: string;
  scope: QuizScope;
  status: QuizAttemptStatus;
  subjectId: string | null;
  topicId: string | null;
  scopeName: string; // nombre propio (tema o materia); la etiqueta "N temas de X" la compone el front
  topicCount: number; // nº de temas elegidos → render bilingüe del historial sin traer items
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
  type: QuestionType; // MCQ | OPEN
  topicId: string | null;
  order: number;
  question: string;
  // Snapshot persistido. Para un item SIN responder, las opciones llegan SOLO con `text`. En OPEN va [].
  options: QuizAttemptItemOption[];
  // null = pregunta SIN responder (no se revela la correcta hasta contestar — anti-trampa). En OPEN siempre null.
  correctIndex: number | null;
  selectedIndex: number | null; // null = sin responder (MCQ). En OPEN siempre null.
  isCorrect: boolean; // MCQ: selectedIndex===correctIndex. OPEN: grade===CORRECT.
  // Confianza declarada por el alumno al responder (calibración). null = sin responder o no declarada.
  confidence: ConfidenceLevel | null;
  // ---- OPEN-only. En MCQ siempre null. En OPEN SIN responder, todos null (anti-trampa: expectedAnswer
  // y feedback recién aparecen al contestar, igual que la explicación en MCQ). ----
  studentAnswer: string | null; // texto libre del alumno
  grade: OpenGrade | null; // nota de 3 estados (feedback)
  feedback: string | null; // devolución de la IA
  expectedAnswer: string | null; // criterio/respuesta esperada (server-only; solo tras responder)
  createdAt: string;
}

// Detalle de un intento (GET /quiz/attempts/:id): el intento + sus items completos (con explicaciones).
export interface QuizAttemptWithItems extends QuizAttempt {
  items: QuizAttemptItem[];
}
