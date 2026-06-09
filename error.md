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
