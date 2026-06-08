import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),

  // DECISIÓN: FRONTEND_URL no está en README §11 pero es necesario para CORS whitelist (README §10.3)
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Supabase
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Upstash Redis — REST API (@upstash/redis: blacklist JWT, rate limit, cache)
  // DECISIÓN: BULLMQ_REDIS_URL eliminado — workers son síncronos para MVP. Ver error.md.
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // JWT (RS256)
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Cloudflare R2
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1),
  CLOUDFLARE_R2_BUCKET: z.string().min(1),
  CLOUDFLARE_R2_PUBLIC_URL: z.string().url(),

  // Resend
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  process.stderr.write(
    `\n[FATAL] Invalid environment variables:\n${JSON.stringify(errors, null, 2)}\n\n`,
  );
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
