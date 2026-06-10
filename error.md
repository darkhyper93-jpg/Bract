# Error / Decision Log

## Format
```
## [YYYY-MM-DD] Título del problema
**Problema:** Descripción del problema encontrado
**Causa:** Por qué ocurrió
**Solución:** Qué se hizo
**Lección:** Qué aprendemos para no repetirlo
```

## [2026-06-07] apps/api "build" script no emite archivos compilados
**Problema:** `apps/api/package.json` define `"build": "tsc --noEmit"`, igual que `typecheck`. La flag `--noEmit` impide que TypeScript emita archivos en `dist/`, lo cual hace imposible ejecutar `node dist/server.js` en producción.
**Causa:** El script `build` fue configurado para validación de tipos, no para compilación real.
**Solución:** Cambiado a `"build": "prisma generate && tsc"` y agregado `"start": "node dist/server.js"`. `prisma generate` corre primero para que el cliente Prisma exista en `node_modules/.prisma/client/` antes de compilar. El script `typecheck` mantiene `tsc --noEmit` para validación sin output.
**Lección:** `typecheck` = validar tipos sin output. `build` = compilar con output. En imágenes Docker limpias, `prisma generate` debe correr antes de `tsc` o el import de `@prisma/client` puede fallar.

## [2026-06-07] nginx:alpine no incluye ngx_headers_more
**Problema:** La especificación usa `more_clear_headers Server;` para eliminar el header `Server` de las respuestas Nginx. Este directivo requiere el módulo `ngx_headers_more`, que no está incluido en la imagen `nginx:1.25-alpine`.
**Causa:** La imagen oficial de Nginx Alpine es minimal; módulos extras requieren compilación o imagen alternativa (nginx-extras, openresty).
**Solución:** Se eliminó la directiva `more_clear_headers`. La directiva `server_tokens off` ya presente oculta la versión de Nginx (ej: `nginx/1.25.3` → `nginx`). Si se necesita eliminar el header `Server` completamente, migrar a `openresty:alpine` o compilar Nginx con `--add-module=ngx_headers_more`.
**Lección:** Verificar disponibilidad de módulos Nginx antes de especificarlos. Las imágenes Alpine son minimal por diseño.

## [2026-06-07] BullMQ reemplazado por ejecución síncrona para MVP
**Problema:** BullMQ requiere conexión TCP persistente (ioredis). El plan Free de Upstash Redis limita a 1 conexión TCP simultánea, causando que los jobs se encolen pero nunca se procesen en producción.
**Causa:** Upstash Free usa un proxy HTTP que no soporta todos los comandos de Redis que BullMQ necesita para mantener workers activos.
**Solución:** Workers convertidos a ejecución síncrona directa: notification.producer.ts crea notificaciones directamente en Prisma; email jobs ya llamaban a Resend directamente (sin cambios); cleanup reemplazado por setInterval nativo en server.ts cada 15 minutos. Los archivos *.worker.ts y queues.ts se conservan sin modificar para reactivar BullMQ fácilmente cuando el tráfico justifique Upstash Pay-as-you-go.
**Lección:** Para MVPs, la ejecución síncrona es preferible a colas si el volumen es bajo. Las colas añaden valor a partir de ~1000 jobs/hora o cuando la latencia de respuesta es crítica.

## [2026-06-07] Arquitectura de deploy cambiada de K8s+Docker a Render
**Problema:** El README §12 especifica K8s + Nginx + Docker para producción, lo cual requiere un servidor VPS propio, nginx, certbot y mantenimiento de infraestructura.
**Causa:** El usuario necesita deploys simples vía git push sin administrar infraestructura.
**Solución:** Se adopta Render (PaaS) para el API (Web Service) y el frontend (Static Site). Render maneja TLS, health checks, rolling deploys y scaling. Los archivos Docker y nginx.conf se mantienen en el repo como fallback para deploy manual si se necesita. El deploy es: push a main → GitHub Actions CI → Render Deploy Hook → `prisma migrate deploy` automático.
**Lección:** Para startups y MVPs, PaaS (Render, Railway, Fly.io) > K8s propio. K8s tiene sentido cuando el costo del PaaS supera el costo del equipo de infraestructura.

## [2026-06-07] BullMQ + Upstash Free: referencia cruzada
**Nota:** La decisión completa y la implementación están documentadas en la entrada "BullMQ reemplazado por ejecución síncrona para MVP" más abajo. En render.yaml y deploy.yml la variable `BULLMQ_REDIS_URL` está ausente intencionalmente.

## [2026-06-07] GET /api/v1/admin/users no implementado
**Problema:** El README §5.5 lista GET /api/v1/admin/users [ADMIN] pero GET /api/v1/users ya implementado en Fase 3 sirve exactamente el mismo propósito con los mismos controles de acceso (middleware authenticate + authorize ADMIN).
**Causa:** La especificación duplicó el endpoint por convención de prefijo /admin.
**Solución:** No duplicar. El frontend admin usará GET /api/v1/users directamente.
**Lección:** Revisar solapamiento de endpoints antes de implementar — si la misma data está disponible en otra ruta protegida, no crear alias innecesarios.

## [2026-06-09] Estado REAL del deploy (corrige entradas previas sobre migraciones y DB)
**Problema:** Entradas anteriores (y `napkin.md`) dicen que el deploy corre `prisma migrate deploy` automático en el buildCommand y que `DATABASE_URL` usa el Transaction pooler (puerto 6543). Ninguna de las dos refleja el estado real ya deployado y verificado.
**Causa:** El proyecto nunca generó archivos de migración, y el Transaction pooler (pgbouncer, 6543) no soporta DDL (`db push`/migrate) porque el schema no define `directUrl`.
**Solución (estado actual verificado en producción):**
- **Sin archivos de migración.** El esquema se aplica con `npx prisma db push` corrido **manualmente** por el usuario. El buildCommand de Render **NO** corre migrate.
- **`DATABASE_URL` = Session pooler, puerto 5432** (`...pooler.supabase.com:5432/postgres`, sin `pgbouncer=true`). Sirve para runtime y para `db push`.
- **Build command real de la API:** `pnpm install --frozen-lockfile --prod=false && pnpm --filter @bract/shared build && pnpm --filter @bract/api build`. Se quitó `corepack enable` (rompía con EROFS: pnpm ya viene en la imagen). `--prod=false` instala devDeps (typescript/prisma) necesarias para buildear.
- **`NODE_VERSION=20`** seteado por env var (sin pin, Render agarraba Node 26).
- **`packages/shared`**: exports condicionales (`node`→`dist`, `default`→`src`). **`apps/web/tsconfig.json`**: `declaration:false`. `packages/shared/tsconfig.json`: `ignoreDeprecations:"5.0"`.
- **`PRISMA_SKIP_POSTINSTALL_GENERATE=true`** en Render para silenciar el warning de schema en el postinstall.
- Static site (web) con regla de **rewrite `/*` → `/index.html`** (SPA).
**Lección:** Para modelos NUEVOS, el flujo es: editar `schema.prisma` → el usuario corre `npx prisma db push` con la URL 5432 → deploy normal. No asumir migraciones automáticas.

## [2026-06-09] Agente A — Contrato de datos de producto (tipos + Zod en @bract/shared)
**Problema:** Las 3 features de estudio (planner/flashcards/chat) necesitan un contrato de datos compartido (entidades + DTOs de I/O) consumido por API y web, antes de que B/C/D/E implementen.
**Causa:** A.2/A.3 del PLAN_AGENTES: tipos en `packages/shared/src/types/` y Zod en `schemas/`, exportados desde `@bract/shared`.
**Solución:** 4 pares type+schema alineados a C/D/E (`subject`, `study`, `flashcard`, `chat`) + reexports en `index.ts`. Decisiones tomadas:
- **Fechas en entidades de respuesta = `string` (ISO)**, no `Date`. Es el contrato JSON que cruza el cable (patrón de `notification`/`admin`). El mapeo `Date→string` (vía `toISOString`) vive en el service/controller de C/D/E, consistente con la fundación.
- **Tipos de DTO de input = `z.infer<typeof schema>`** exportados desde el `.schema.ts` (sin duplicar interfaces → sin drift). Las entidades de salida sí son `interface` en `.types.ts`.
- **`Subject.color` = paleta cerrada `z.enum(SUBJECT_COLORS)`** — 8 hex curados armonizados con los tokens del design system (§9.2 dark-first): brand indigo + estados info/success/warning/error + 3 acentos (purple/pink/teal). Exportada para reuso del frontend (swatches del selector). Descartado regex hex libre por la regla §3.3 "paleta permitida".
- **Tablas-hijo sin DTO de `userId`:** `StudyPlanItem`/`ChatMessage` se scopean por su padre (§3.4); sus schemas validan solo `planId`/`sessionId` y el body del bloque/mensaje.
- **Contratos de salida de la IA NO van acá:** los define y valida el Agente B (Apéndice C). A entrega solo entidades + DTOs de request.
- **Enums espejados de Prisma como `export enum` en `.types.ts`** (patrón de `Role`/`NotificationType`): los 6 enums de producto (`TopicStatus`, `TopicDifficulty`, `StudyPlanStatus`, `StudyPlanItemStatus`, `FlashcardSource`, `ChatRole`) replican exactamente los valores del `schema.prisma`. Zod los consume con `z.nativeEnum(...)` → una sola lista de valores, sin divergencia entre DB, validación y tipos.
- **Paginación selectiva en listados:** se paginan los de crecimiento no acotado (`chat sessions`, `flashcards?topicId`, `flashcards/due` con `limit`); `subjects`/`topics` NO se paginan porque el planner los consume como árbol completo (`SubjectWithTopics`) y paginarlos rompería el render día-por-día.
**Lección:** El contrato compartido se entrega como *entidades de salida* (interfaces, fechas ISO) + *DTOs de input* (z.infer). Mantener una sola fuente de verdad por DTO (el schema Zod) y por enum (Prisma → `z.nativeEnum`) evita que tipo y validación se desincronicen. Tras tocar `packages/shared`, rebuildear su `dist` (export condicional `node`→`dist`) para no dejar el runtime desfasado para el agente siguiente.

## [2026-06-09] `pnpm -r lint` roto a nivel fundación — eslint nunca instalado (TAREA AGENTE G)
**Problema:** `pnpm -r lint` falla con `"eslint" no se reconoce como un comando`. Los scripts `lint` de `apps/api` (`eslint src --ext .ts`) y `apps/web` (`eslint src --ext .ts,.tsx`) referencian un binario inexistente.
**Causa:** eslint nunca se instaló ni configuró en el repo: **0 ocurrencias en `pnpm-lock.yaml`**, no figura en ningún `package.json` (solo `typescript` como devDep raíz), y no hay `.eslintrc*` en ninguna parte. Es un script muerto del scaffolding de la fundación, preexistente al Agente A.
**Solución (PENDIENTE — Agente G, NO Agente A):** el Agente A NO lo arregla (excede su mandato de tipos+Zod y correría el linter sobre el código preexistente de la fundación). Para el Agente G:
1. Instalar + configurar eslint en el monorepo (config compartida + `@typescript-eslint`, reglas del CLAUDE.md: no `console.log`, no `any` sin `// DECISIÓN`).
2. Arreglar el step de lint del CI (hoy correría contra un binario inexistente).
3. Revisar y arreglar los hallazgos sobre el código existente de `apps/api` y `apps/web`.
**Mitigación del Agente A:** los archivos nuevos de `packages/shared` se verificaron a mano (grep): **cero `console.log`, cero `any`**; `pnpm -r typecheck` quedó en verde. El commit del entregable A se hizo con typecheck verde y verificación manual, con el lint documentado acá como deuda de G.
**Lección:** No declarar "lint verde" como criterio de hecho sin verificar que el linter exista y corra. Un script en `package.json` no implica que la herramienta esté instalada.

## [2026-06-10] Agente B — Núcleo de IA (capa `lib/ai` reutilizable)
**Problema:** Las 3 features de estudio (planner/flashcards/chat) necesitan una capa de IA compartida con el proveedor detrás de una env var, ensamblador de contexto del estudiante y funciones tipadas, validando SIEMPRE la salida con Zod y degradando si falta la key (sin romper build).
**Causa:** Agente B del PLAN_AGENTES (Fase 9 + Apéndice C). Depende de A (tipos de `@bract/shared`).
**Solución:** Módulo `apps/api/src/lib/ai/` (`ai.client` / `ai.schemas` / `ai.context` / `ai.prompts` / `ai.service` / `index`) + tests con mock. Decisiones tomadas:
- **Proveedor: Anthropic Claude** vía `@anthropic-ai/sdk` (única librería nueva fuera del stack del README §1 — documentada acá). **Modelos escalonados por tarea, NO Opus para todo:** `AI_MODEL_GENERATION=claude-haiku-4-5` (plan + flashcards, barato) y `AI_MODEL_CHAT=claude-sonnet-4-6` (chat; opus opcional). Strings tomados de los docs actuales del proveedor, no inventados.
- **`AI_API_KEY` OPCIONAL en `env.ts`** (`.optional()`, sin `process.exit`). La app **bootea sin ella** y degrada: `generateStudyPlan` devuelve una **distribución base determinista** (urgencia por examen + pendientes + minutos/día) → el planner básico funciona sin IA; `generateFlashcards`/`chat` lanzan `AppError('AI_UNAVAILABLE')`. Mismo fallback ante fallo del proveedor en el plan (nunca lanza).
- **Nuevo código de error `AI_UNAVAILABLE` (503)** agregado a `config/constants.ts` (`ERROR_CODES`), `lib/errors.ts` (`STATUS_MAP`) y README §5.3. Desviación: el set original era cerrado; "IA no disponible" no encajaba en `INTERNAL_ERROR` genérico.
- **`effort`/`adaptive thinking` NO se mandan en Haiku** (devuelven 400). Generación usa solo structured outputs; `effort: 'medium'` se manda **solo en chat** con guard `isEffortCapable(model)` (allowlist opus-4.x/sonnet-4-6/fable-5) para tolerar overrides de env.
- **Structured outputs por JSON Schema a mano** (`output_config.format`), NO el helper `zodOutputFormat` del SDK: el SDK 0.104.1 tipa ese helper contra **zod v4** y el repo usa **zod v3** → mismatch de tipos (`parsed_output` quedaba `{}`). Se pasa el JSON Schema manual y se valida el texto crudo con los Zod de `ai.schemas.ts` (`safeParse`) → no se confía en el structured output a ciegas. Invariantes en código: todo `topicId` existe, `Σ minutos/día` clampeado a la disponibilidad, flashcards capadas (≤10) y deduplicadas.
- **B no toca Prisma ni HTTP:** recibe DTOs, devuelve datos tipados. Persistencia (`ChatMessage`), SSE del chat y rate-limit por ruta son de C/D/E. El chat se diseñó como `AsyncGenerator<string>` (streaming) — excepción documentada al envelope JSON.
- **Contexto del chat ACOTADO** (`ai.context.ts`): resume materias/temas/progreso, lista hasta 15 pendientes por materia con "(+N más)" — no vuelca toda la DB (tokens/costo).
- **Tooling de tests:** se agregó **`vitest` (devDependency, test-only, no va a prod)** porque el repo no tenía runner. Tests excluidos de `tsconfig` (build limpio) y de typecheck; corren con `vitest run`. Setup `vitest.setup.ts` puebla env dummy válido para evitar el `process.exit(1)` de `env.ts` al importar. Se fijó `vitest@^2` (vite 5; vitest 4 pide vite 6+ y rompía peers con `apps/web`).
- **Dependencias:** `pnpm install` corrido y **`pnpm-lock.yaml` commiteado** — CI/Render usan `--frozen-lockfile` y se rompen si el lock no refleja las deps nuevas.
**Lección:** Cuando el helper tipado de un SDK apunta a una versión mayor de una dep (zod v4) distinta a la del repo (v3), no forzar el helper: pasar el JSON Schema a mano y validar con la versión local de Zod desacopla y cumple "validar siempre". La salida de la IA se trata como no confiable: schema + invariantes de negocio en código, y degradación con error manejado (nunca romper la app).

## [2026-06-10] Agente C — Planificador (backend: capas + recálculo determinista)
**Problema:** El planner necesita CRUD de materias/temas/disponibilidad + generación y recálculo del cronograma, reusando la distribución del Agente B y degradando sin `AI_API_KEY`, sin duplicar el algoritmo ni romper las capas.
**Causa:** Agente C del PLAN_AGENTES (Fase 10). Depende de A (tipos `@bract/shared`) y B (`lib/ai`).
**Solución:** Módulo `apps/api/src/modules/planner/` (`subject.repository` · `topic.repository` · `study.repository` → `planner.service` → `planner.controller` → `planner.routes`, montado en `/api/v1`). Decisiones tomadas:
- **Dos niveles de recálculo (decisión de producto, confirmada por el usuario):** la **IA solo se usa en la generación explícita** `POST /study/plan/generate` (`generateStudyPlan` de B: determinista + refinamiento IA, degrada al baseline si falta la key o falla). El **recálculo incremental** —completar un tema (`PATCH /topics/:id/status`) y **saltar un bloque** (`PATCH /study/plan/items/:id` con `SKIPPED`)— usa la **distribución 100% determinista, sin IA** (`generateStudyPlanBaseline`): adapta el plan al instante, sin costo de tokens ni reshuffle caótico. Marcar un bloque `COMPLETED` solo lo registra (no recalcula).
- **Export aditivo en `lib/ai` (coordinación C↔B):** se expuso `generateStudyPlanBaseline(input)` desde `lib/ai/index.ts`, que reusa el `buildBaselinePlan` interno de B. C **no duplica** el algoritmo (fuente única de la distribución). Cambio mínimo (1 wrapper en `ai.service.ts` + 1 línea en `index.ts`); no altera el comportamiento existente de B.
- **Persistencia:** generación explícita = archivar el `StudyPlan` ACTIVE anterior (`ARCHIVED`) + crear uno nuevo. Recálculo incremental = mutar el **mismo** plan ACTIVE en transacción: borra solo los bloques **futuros PENDING** (`date >= hoy AND status = PENDING`) y recrea desde el baseline, **preservando el historial** (COMPLETED/SKIPPED y todo lo anterior a hoy). No crea plan nuevo ni archiva.
- **API plana, agrupado en el frontend:** `GET /study/plan` y el generate devuelven `StudyPlanWithItems` plano (items `orderBy [date, order]`); el agrupado día-por-día lo hace el frontend.
- **Endpoints que recalculan devuelven el plan junto al recurso:** `{ topic, plan }` y `{ item, plan }` (ahorra un round-trip; el frontend refleja el cronograma recalculado sin refetch extra).
- **Ownership de `StudyPlanItem` vía el plan padre (§3.4):** no tiene `userId` propio; `study.repository.findPlanItemWithOwner` trae `plan: { id, userId }` y el service compara contra `req.user.id` → `NOT_FOUND` si no pertenece.
- **Cast de enums Prisma↔shared:** mismo patrón que `notification.service` (Date→ISO + `as` para el enum compartido en los mappers). En los `data` de Prisma con `exactOptionalPropertyTypes`, castear al tipo de enum **puro** del modelo (`PrismaTopic['difficulty'|'status']`), **no** al field-type de `Prisma.TopicXxxInput['...']` (incluye `| undefined` y rompe la asignación). Ver napkin.
- **Sin env vars nuevas, sin modelos nuevos:** `AI_API_KEY` ya la introdujo B; los modelos los aplicó A con `db push`. C no requiere `db push`.
- **Tests:** `planner.service.test.ts` (7 casos, repos + `lib/ai` mockeados): mapeo de DTOs, generación con IA, recálculo determinista al completar/saltar, no-recálculo al completar bloque, plan=null sin plan activo, y ownership ajeno → `NOT_FOUND`. `pnpm -r typecheck` verde; `vitest run` 20/20.
**Lección:** Reservar la IA para la acción explícita y resolver las micro-interacciones con la distribución determinista mantiene el plan reactivo, barato y < 100ms. Reusar el algoritmo de B vía un export aditivo (en vez de duplicarlo en C) preserva la fuente única. El backend queda listo para que el Agente F conecte las invalidaciones cruzadas hacia chat/flashcards.
