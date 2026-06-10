# Napkin Runbook — Bract

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-06-05] Read README.md before any task**
   Do instead: always read README.md first — it is the single source of truth for architecture, models, endpoints, and phases.

2. **[2026-06-05] Check active development phase before implementing**
   Do instead: confirm which README phase is active; refuse to implement phase N+1 if phase N is incomplete.

3. **[2026-06-05] Feature not in README → ask before implementing**
   Do instead: respond with the standard template from CLAUDE.md asking to define data/endpoints/phase before touching code.

## Architecture Guardrails
1. **[2026-06-05] Controller / Service / Repository separation is strict**
   Do instead: Controller = HTTP only; Service = business logic (no req); Repository = Prisma only. Never mix layers.

2. **[2026-06-05] No cross-package relative imports**
   Do instead: always use `@bract/shared` package name, never `../../../packages/...`.

3. **[2026-06-05] API envelope required on every endpoint**
   Do instead: always return `{ success, data, meta? }` or `{ success, error }` — no bare responses.

## Code Quality Rules
1. **[2026-06-05] No `any` without justification comment**
   Do instead: add `// DECISIÓN: ...` comment explaining why `any` is unavoidable if used.

2. **[2026-06-05] No console.log anywhere**
   Do instead: use Winston logger in backend; silence in frontend prod.

3. **[2026-06-05] Every Prisma query with relations must avoid N+1**
   Do instead: use explicit `select` or `include` — never lazy-load in loops.

## Frontend Rules
1. **[2026-06-05] Every component needs all 4 states**
   Do instead: implement loading (skeleton) + empty (EmptyState) + error + success before marking component done.

2. **[2026-06-05] No hardcoded colors**
   Do instead: use only CSS tokens defined in the README design system section.

3. **[2026-06-10] i18next plurals need `_one`/`_other` suffixed keys (not a bare base key)**
   Do instead: define `key_one` + `key_other` and call `t('key', { count })`. A bare `key` + `key_other` fails for count===1 (looks for `key_one`).

4. **[2026-06-10] `Record<K, ComponentProps['variant']>` leaks `undefined` under exactOptionalPropertyTypes**
   Do instead: type lookup maps as `Record<K, NonNullable<Props['variant']>>`; and pass strict-boolean props as `loading={val ?? false}` (not `loading={maybeUndefined}`).

## Implementation Order
1. **[2026-06-05] Always follow the 8-step implementation order**
   Do instead: types → Zod schemas → Repository → Service → Controller+Routes → frontend api/ → hooks/ → components/.

## Deploy Architecture
1. **[2026-06-09] Render PaaS, NO migrate-in-build, schema via manual `db push` (corrige nota previa)**
   Do instead: push to main → GitHub Actions → Render auto-deploy. NO hay archivos de migración y el buildCommand NO corre `prisma migrate deploy`. Para modelos nuevos: editar `schema.prisma` → el usuario corre `npx prisma db push` a mano con la URL 5432. (error.md 2026-06-09 + PLAN_AGENTES §7.)

2. **[2026-06-09] Supabase DATABASE_URL = Session pooler puerto 5432 (NO 6543) (corrige nota previa)**
   Do instead: `postgresql://postgres.PROJECT:PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres` (sin `?pgbouncer=true`). El Transaction pooler (6543) NO soporta DDL porque el schema no define `directUrl` → rompe `db push`. La 5432 sirve para runtime y para `db push`.

3. **[2026-06-07] JWT keys need literal `\n` in Render env vars**
   Do instead: convert with `awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem` before pasting in Render dashboard. Multi-line values break the env var.

## TypeScript Config Gotchas
1. **[2026-06-07] `exactOptionalPropertyTypes: true` + `noImplicitOverride: true` + `noPropertyAccessFromIndexSignature: true` are ALL active**
   Do instead: use `override` on class method overrides; spread optional props conditionally `{...(val != null ? { prop: val } : {})}`; access Vite env vars with bracket notation `import.meta.env['VITE_X']`.

2. **[2026-06-07] No vite-env.d.ts existed — `import.meta.env` types were missing**
   Do instead: `apps/web/src/vite-env.d.ts` now exists with `/// <reference types="vite/client" />`. Keep it — needed for ErrorBoundary and all Vite env access.

3. **[2026-06-10] Casting shared enum → Prisma `data` field under `exactOptionalPropertyTypes`**
   Do instead: cast to the model's pure enum type `PrismaModel['field']` (e.g. `input.difficulty as PrismaTopic['status']`), NOT to `Prisma.XxxCreateInput['field']` / `Prisma.XxxUpdateInput['field']` — those include `| undefined` (and update-operations unions) and fail assignment. Date→ISO + `as` enum mapping in service mappers (notification.service pattern).
