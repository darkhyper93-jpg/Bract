import cors from 'cors';
import { env } from '../config/env.js';

// DECISIÓN: whitelist explícita de orígenes — README §10.3 prohíbe usar '*'
export const corsMiddleware = cors({
  origin: [env.FRONTEND_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
