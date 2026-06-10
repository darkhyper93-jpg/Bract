// Setup de tests: env.ts valida el ambiente al importarse y hace process.exit(1) si falta algo.
// Acá poblamos valores dummy válidos (solo para tests) antes de que cualquier módulo cargue env.
// AI_API_KEY se deja sin setear a propósito: los tests controlan isAIConfigured vía mock.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
  JWT_PRIVATE_KEY: 'test-private-key',
  JWT_PUBLIC_KEY: 'test-public-key',
  CLOUDFLARE_ACCOUNT_ID: 'test-account',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'test-access-key',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'test-secret-key',
  CLOUDFLARE_R2_BUCKET: 'test-bucket',
  CLOUDFLARE_R2_PUBLIC_URL: 'https://files.test.dev',
  RESEND_API_KEY: 'test-resend-key',
  EMAIL_FROM: 'noreply@test.dev',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
