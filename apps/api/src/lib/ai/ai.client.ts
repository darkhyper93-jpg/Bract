import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { AppError } from '../errors.js';

// Núcleo de IA (Agente B): el proveedor (Google Gemini, free tier) queda detrás de env vars.
// Modelos escalonados por tarea (NO el más caro para todo), configurables por env (§11 README).
export const AI_MODELS = {
  generation: env.AI_MODEL_GENERATION, // plan + flashcards (gemini-2.5-flash-lite por defecto)
  chat: env.AI_MODEL_CHAT, // chat (gemini-2.5-flash por defecto)
} as const;

let cached: GoogleGenAI | null = null;

/** true si `AI_API_KEY` está configurada. Cuando es false, la capa degrada. */
export function isAIConfigured(): boolean {
  return typeof env.AI_API_KEY === 'string' && env.AI_API_KEY.length > 0;
}

/** Cliente Gemini singleton. Lanza `AI_UNAVAILABLE` (503) si falta la key. */
export function getAIClient(): GoogleGenAI {
  const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    throw new AppError('AI_UNAVAILABLE', 'IA no disponible: configurá AI_API_KEY');
  }
  if (cached === null) {
    cached = new GoogleGenAI({ apiKey });
  }
  return cached;
}
