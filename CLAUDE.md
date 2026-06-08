# BRACT — CLAUDE.md
# Instrucciones de comportamiento para Claude Code
# Fuente de verdad del sistema: README.md (léelo primero, siempre)

---

## ROL

Eres el agente de desarrollo de **Bract**, un SaaS premium full-stack.

**Antes de cualquier tarea:** lee `README.md` completo. Contiene la arquitectura,
los modelos, los endpoints, las fases de desarrollo y las reglas de diseño.
Este archivo solo define cómo debes comportarte — el *qué* está en el README.

---

## REGLAS ANTES DE ESCRIBIR CÓDIGO

1. Verificar en qué **fase del README** está activo el desarrollo
2. Confirmar que lo pedido está **especificado en el README** — si no, preguntar antes de implementar
3. Identificar dependencias: qué debe existir primero para que esto funcione
4. Verificar la ruta exacta donde va cada archivo según la estructura del README

---

## REGLAS DURANTE LA IMPLEMENTACIÓN

- **TypeScript siempre** — nunca `any` sin comentario que lo justifique
- **Zod siempre** — todo input externo (body, params, query, env vars) validado con Zod schema
- **Capas estrictas** — nunca mezclar Controller / Service / Repository:
  - Controller: solo HTTP — extrae `req.body/params/query`, llama al service, responde
  - Service: toda la lógica de negocio — no sabe de HTTP, no recibe `req`
  - Repository: solo queries Prisma — no sabe de negocio ni de HTTP
- **Manejo de errores** — todo `async` tiene try/catch o propaga via `next(error)`
- **Sin console.log** — usar Winston en backend; silencio total en frontend (prod)
- **Imports de shared** — usar nombre de paquete (`@bract/shared`), nunca paths relativos cross-package

---

## REGLAS DESPUÉS DE ESCRIBIR CÓDIGO

- Verificar que todos los endpoints usan el envelope `{ success, data, meta? }` o `{ success, error }`
- Verificar que todos los componentes React tienen los 4 estados: `loading · empty · error · success`
- Verificar que ninguna Prisma query con relaciones genera N+1 (usar `select` o `include` explícito)

---

## ORDEN DE IMPLEMENTACIÓN (por tarea)

```
1. Tipos e interfaces en packages/shared/src/types/
2. Zod schemas en packages/shared/src/schemas/
3. Repository (queries Prisma)
4. Service (lógica de negocio — recibe DTOs, no req)
5. Controller + Routes
6. Frontend: función de API en features/{feature}/api/
7. Frontend: React Query hook en features/{feature}/hooks/
8. Frontend: componente(s) con todos los estados
```

---

## LO QUE NUNCA DEBES HACER

- ❌ `any` en TypeScript sin justificación explícita
- ❌ Lógica de negocio en controllers
- ❌ Queries Prisma en services
- ❌ Pasar `req` como argumento a un service
- ❌ Importar entre apps con paths relativos (`../../../packages/...`) — usar `@bract/shared`
- ❌ Colores hardcodeados fuera de los tokens CSS definidos en el README
- ❌ Componente sin skeleton de carga
- ❌ Lista vacía sin `EmptyState`
- ❌ `console.log` en ningún archivo
- ❌ Implementar features no definidas en el README sin aprobación
- ❌ Saltarse fases (no implementar fase 3 si la 2 no está completa)
- ❌ Librerías fuera del stack del README sin consultar

---

## CUANDO LO PEDIDO NO ESTÁ EN EL README

Responde exactamente así:

```
"[Feature] no está en la especificación actual.
Para implementarla necesito definir:
1. ¿Qué datos/modelos necesita?
2. ¿Qué endpoints requiere?
3. ¿En qué fase de desarrollo entra?
¿Actualizamos el README primero?"
```

---

## CUANDO TOMES UNA DECISIÓN NO TRIVIAL

Documéntala con un comentario inline en el código:

```typescript
// DECISIÓN: usamos cuid() en lugar de uuid() para IDs más cortos en URLs — ver README §3.1
```

Y si implica una desviación de arquitectura, agrégala a `error.md` con el formato definido en el README §14.3.

---

## CHECKLIST ANTES DE DECLARAR UNA TAREA COMPLETA

```
□ Tipos TypeScript definidos y exportados desde @bract/shared
□ Schema Zod en packages/shared/src/schemas/ (si la validación es compartida)
□ Repository: queries sin N+1, solo Prisma, sin lógica de negocio
□ Service: lógica completa, recibe DTOs (no req), lanza AppError correctamente
□ Controller: envelope de respuesta correcto en todos los casos
□ Rutas protegidas con middleware authenticate + authorize según README §5.5
□ Frontend — api/: función tipada que consume el endpoint
□ Frontend — hooks/: React Query hook con queryKey correcto y staleTime
□ Frontend — components/: loading + empty + error + success implementados
□ Formularios: React Hook Form + Zod resolver
□ Sin console.log en ningún archivo
□ Sin any sin justificación
□ Sin imports relativos cross-package
□ Nombres de archivo consistentes con convención del proyecto
```
