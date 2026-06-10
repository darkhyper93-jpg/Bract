import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { AppError } from '../errors.js';

// Núcleo de IA (Agente B): el proveedor (Anthropic Claude) queda detrás de env vars.
// Modelos escalonados por tarea (NO Opus para todo), configurables por env (§11 README).
export const AI_MODELS = {
  generation: env.AI_MODEL_GENERATION, // plan + flashcards (Haiku por defecto)
  chat: env.AI_MODEL_CHAT, // chat (Sonnet por defecto; opus opcional)
} as const;

let cached: Anthropic | null = null;

/** true si `AI_API_KEY` está configurada. Cuando es false, la capa degrada. */
export function isAIConfigured(): boolean {
  return typeof env.AI_API_KEY === 'string' && env.AI_API_KEY.length > 0;
}

/** Cliente Anthropic singleton. Lanza `AI_UNAVAILABLE` (503) si falta la key. */
export function getAIClient(): Anthropic {
  const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  if (cached === null) {
    cached = new Anthropic({ apiKey });
  }
  return cached;
}

// `effort` y `adaptive thinking` devuelven 400 en Haiku 4.5; solo se mandan en modelos que
// los soportan. Por eso generación (Haiku) nunca manda effort y chat lo manda con guard.
const EFFORT_CAPABLE = ['opus-4-5', 'opus-4-6', 'opus-4-7', 'opus-4-8', 'sonnet-4-6', 'fable-5'];

/** true si el modelo soporta el parámetro `effort` (no Haiku). */
export function isEffortCapable(model: string): boolean {
  return EFFORT_CAPABLE.some((m) => model.includes(m));
}
