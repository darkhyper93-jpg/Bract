// Núcleo de IA (Agente B) — export público que consumen C (planner), D (flashcards), E (chat).
export { AI_MODELS, isAIConfigured } from './ai.client.js';
export { assembleStudentContext, renderContextForPrompt } from './ai.context.js';
export type {
  StudentContext,
  StudentContextSubject,
  StudentContextTopic,
} from './ai.context.js';
export {
  chatReply,
  generateFlashcards,
  generateStudyPlan,
  streamChatReply,
} from './ai.service.js';
export type {
  ChatTurnInput,
  GeneratedFlashcard,
  GenerateFlashcardsInput,
  GeneratePlanInput,
  PlanDay,
  PlanItem,
} from './ai.service.js';
