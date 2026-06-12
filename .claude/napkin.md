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

## Shell & Git Reliability
1. **[2026-06-11] Bash cwd PERSISTS across calls; `cd` into node_modules breaks later git reads**
   Do instead: after `cd`-ing into a subdir to inspect (e.g. `node_modules/...`), `cd` back to repo root before git ops. `git ls-files`/`ls-tree HEAD` are scoped to cwd prefix → return 0 inside a gitignored dir and look like a broken repo (while `git log`/`status`/`show <hash>` still work, since they're whole-repo). Prefer `git -C <abs-root>` or absolute paths; avoid bare `cd` in compound commands.
2. **[2026-06-11] `git add -A` sweeps in unrelated untracked files (e.g. user's IDEAS_POST_MVP.md)**
   Do instead: before committing, `git status --short` and stage explicit paths (`git add <files>`), not `-A`, when other untracked files may exist. If a stray file lands in a commit pre-push: `git rm --cached <f> && git commit --amend --no-edit` (keeps it on disk as untracked).

## Architecture Guardrails
1. **[2026-06-05] Controller / Service / Repository separation is strict**
   Do instead: Controller = HTTP only; Service = business logic (no req); Repository = Prisma only. Never mix layers.

2. **[2026-06-11] Cross-module effects: delegate to the owner service, never reach into its tables**
   Do instead: when module X must mutate module Y's data (e.g. planner completing a Topic must adjust flashcard SRS), call `yService.onSomething(...)` — X never touches Y's repo/tables. Keeps coupling clean + the boundary mockable in tests. Import direction must stay acyclic (planner→flashcard ok; flashcard must NOT import planner; chat→planner already exists). When you add such a delegated call inside a service method, EVERY existing test of that method that doesn't mock the new dependency will hit real Prisma and fail with "Can't reach database server" — add `vi.mock('../../<mod>/<svc>.service.js', ...)` to each.

3. **[2026-06-11] Cross-feature React Query invalidations live in ONE central helper, not scattered**
   Do instead: `apps/web/src/lib/invalidateStudyContext.ts` owns the cross-feature dependency graph (planner↔flashcards). Mutation hooks call `invalidateAfterTopicStatusChange`/`invalidateAfterTreeChange` instead of reaching into another feature's queryKeys ad hoc. The chat needs NO invalidation: it assembles its context server-side per message (single source of truth = `planner.subjects`, reused by flashcards' `useSubjects` and chat's `plannerService.listSubjects`).

4. **[2026-06-11] SRS pause/activate by topic status moves ONLY dueDate (never ease/interval/reps)**
   Do instead: pausing a topic's cards = set `dueDate` to far-future sentinel (`SRS_PAUSED_DUE_DATE`, year 9999 in `srs.ts`); activating = bring sentinel-dated cards back to `now` (detect via `dueDate >= SRS_PAUSED_THRESHOLD`, year 9000). Preserves learned SRS state; reversible; no `db push`. Rule: IN_PROGRESS/COMPLETED→active, PENDING→paused.

2. **[2026-06-05] No cross-package relative imports**
   Do instead: always use `@bract/shared` package name, never `../../../packages/...`.

3. **[2026-06-05] API envelope required on every endpoint**
   Do instead: always return `{ success, data, meta? }` or `{ success, error }` — no bare responses. EXCEPTION: streaming (SSE) endpoints (chat messages) — documented in error.md.

4. **[2026-06-11] Streaming over Express without breaking layers**
   Do instead: service is an `AsyncGenerator` of domain events (`{type:'meta'|'token'|'done'}`); controller is the ONLY layer touching `res` (serializes to SSE frames). Persist the AI reply in a `finally` (covers natural-complete AND client-disconnect-partial), emit `done` only after the persist. Check AI availability BEFORE the first frame so a missing key returns clean JSON 503 (after first byte the status is sealed → errors go as `event: error`). On `res.on('close')` call `gen.return()` to abort the provider (propagates through the for-await).

## Code Quality Rules
1. **[2026-06-05] No `any` without justification comment**
   Do instead: add `// DECISIÓN: ...` comment explaining why `any` is unavoidable if used.

2. **[2026-06-05] No console.log anywhere**
   Do instead: use Winston logger in backend; silence in frontend prod.

3. **[2026-06-05] Every Prisma query with relations must avoid N+1**
   Do instead: use explicit `select` or `include` — never lazy-load in loops.

4. **[2026-06-12] ESLint = v8 + `.eslintrc.cjs` at repo ROOT (NOT flat config), typescript-eslint v7, NO `parserOptions.project`**
   Do instead: flat config breaks the existing `eslint src --ext` scripts; ESLint 8 + eslintrc keeps them. typescript-eslint v7 (TS 5.4; v8 needs ≥5.5). Skip `parserOptions.project` — the ERROR rules (`no-console`, `@typescript-eslint/no-explicit-any`) need no type-info → fast, no tsconfig friction. ONE root config (`root:true`) + `overrides` by path (apps/web→browser+react-hooks, apps/api/packages→node). Install at root with `pnpm add -w -D` (nested scripts resolve the binary via ancestor `.bin`). Relax noise to warn/off; justified `any` → `eslint-disable-next-line` + `// DECISIÓN`. CI lint steps fail only because ESLint is missing → install + commit lockfile makes `--frozen-lockfile` green.

## Frontend Rules
1. **[2026-06-05] Every component needs all 4 states**
   Do instead: implement loading (skeleton) + empty (EmptyState) + error + success before marking component done.

2. **[2026-06-05] No hardcoded colors**
   Do instead: use only CSS tokens defined in the README design system section.

3. **[2026-06-10] i18next plurals need `_one`/`_other` suffixed keys (not a bare base key)**
   Do instead: define `key_one` + `key_other` and call `t('key', { count })`. A bare `key` + `key_other` fails for count===1 (looks for `key_one`).

4. **[2026-06-10] `Record<K, ComponentProps['variant']>` leaks `undefined` under exactOptionalPropertyTypes**
   Do instead: type lookup maps as `Record<K, NonNullable<Props['variant']>>`; and pass strict-boolean props as `loading={val ?? false}` (not `loading={maybeUndefined}`).

5. **[2026-06-10] `Button` variants are only primary/secondary/ghost/danger (NO success)**
   Do instead: for multi-action rows (e.g. SRS grade buttons) map to those 4 keys; don't invent `success`/`warning` Button variants — they don't exist. Badge has success/warning/info/neutral, Button does not.

6. **[2026-06-10] Study/review queues must be snapshotted in client state, not read from the live query**
   Do instead: copy the `due` list into local `useState` once, advance by index; reviewing mutates dueDate→future and a live refetch would drop items mid-session and shift indices. Re-snapshot on an explicit "study again".

7. **[2026-06-11] Consume SSE with `fetch`, not `EventSource`**
   Do instead: `EventSource` can't POST nor send `Authorization` (token is in-memory in authStore). Use `fetch` + `res.body.getReader()` + TextDecoder, split frames on `\n\n`. fetch bypasses axios interceptors → attach Bearer manually and do ONE refresh-retry on 401. Drive it from a hook with an `AbortController`; abort on unmount/session-change (also aborts the provider backend-side). Show user msg optimistically (local state) + accumulate assistant tokens; on done, invalidate the thread query to pull the persisted messages, then clear local state (await the invalidate first to avoid a flash).

8. **[2026-06-12] "UI bugs" are often front↔backend envelope-shape mismatches, not rendering bugs**
   Do instead: when a value renders as Invalid Date / blank / empty-list despite data existing, check the controller's EXACT response shape before debugging the component. Backend wraps under nested keys: `/auth/me` and `/profile` → `data.user` (not `data`); notifications list → `data.notifications` (not `data.items`). Fix the `*.api.ts` unwrap to match the controller, not the component.

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
