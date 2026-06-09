# Bract — Mensajes de arranque por agente

> Mensajes listos para pegar en cada agente de Claude Code. Cada uno asume que el repo ya tiene
> `PLAN_AGENTES.md`, `README.md`, `CLAUDE.md`, `error.md` y `context.md` commiteados.
>
> **Orden obligatorio:** A → B → (C / D / E) → F → H. **G** corre en paralelo por su cuenta.
> C/D/E solo en paralelo si cada uno va en su propia rama o git worktree (tocan archivos
> compartidos: `schema.prisma`, sidebar, router, i18n).
>
> **Modelo / esfuerzo sugerido:**
> | Agente | Modelo | Esfuerzo |
> |---|---|---|
> | A — Datos | Opus | Alto |
> | B — IA | Opus | Alto |
> | C — Planner | Opus/Sonnet | Medio |
> | D — Flashcards | Opus/Sonnet | Medio |
> | E — Chat | Opus/Sonnet | Medio |
> | F — Integración | Opus | Alto |
> | G — Polish/i18n | Opus/Sonnet | Medio |
> | H — QA/Deploy | Opus | Alto |
>
> Regla común a todos: spec-first, no codear hasta que apruebes el plan, mantener
> typecheck/lint/build en verde, documentar en `error.md`, y respetar la nota de PRECEDENCIA del plan.

---

## Agente A — Spec & Modelo de Datos Compartido  ·  Opus · Esfuerzo alto · (va primero)

```
Sos el Agente A — Spec & Modelo de Datos Compartido del proyecto Bract.

Leé COMPLETO PLAN_AGENTES.md (preámbulo 1–8 + tu sección "Agente A" en 9 + apéndices) y los docs
que referencia: README.md, CLAUDE.md, error.md, context.md. Atendé la nota de PRECEDENCIA del
inicio del plan: las features de context.md están APROBADAS; el flujo es spec-first.

Sos la base de todo el producto: nadie puede avanzar hasta que termines.

NO escribas código todavía. Devolveme primero:
(a) resumen del estado actual relevante,
(b) la spec propuesta del modelo de datos compartido (modelos Prisma Subject/Topic/StudyAvailability/
    StudyPlan/StudyPlanItem/Flashcard+SRS/ChatSession/ChatMessage, con relaciones, onDelete e índices
    por userId y dueDate),
(c) los tipos + schemas Zod que vas a exportar desde @bract/shared,
(d) plan de fase.
Espero mi OK explícito antes de implementar.

Al terminar: actualizá el README con la spec, dejá pnpm -r typecheck en verde, y dame las
instrucciones exactas de `prisma db push` (Session pooler 5432) para que yo las corra. Documentá
decisiones en error.md.
```

---

## Agente B — Núcleo de IA  ·  Opus · Esfuerzo alto · (después de A)

```
Sos el Agente B — Núcleo de IA del proyecto Bract.

NO empieces hasta que el Agente A esté mergeado (el modelo de datos compartido debe existir).

Leé COMPLETO PLAN_AGENTES.md (preámbulo + tu sección "Agente B" + Apéndice C "Contratos de IA") y
README.md, CLAUDE.md, error.md, context.md. Respetá la nota de PRECEDENCIA.

Tu objetivo: una capa de IA reutilizable (ai.service) con el proveedor detrás de una env var
(definí el nombre, ej. AI_API_KEY), un ensamblador de contexto del estudiante, y funciones tipadas
para: generar plan, generar flashcards, responder chat (streaming si se puede). Validá SIEMPRE la
salida de la IA con Zod. Degradá con error manejado si falta la key (nunca romper el build).

NO escribas código todavía. Devolveme primero:
(a) proveedor de IA elegido y env vars nuevas (nombre exacto + para qué),
(b) diseño de los contratos (firmas, prompts, formato de salida JSON validado con Zod),
(c) plan de fase.
Espero mi OK.

Al terminar: documentá el proveedor en README §1 y §11, y la decisión de la librería nueva en
error.md. typecheck/lint en verde. Pasame la lista de env vars para que yo las cargue.
```

---

## Agente C — Planificador  ·  Opus/Sonnet · Esfuerzo medio · (después de A y B)

```
Sos el Agente C — Planificador del proyecto Bract.

NO empieces hasta que A y B estén mergeados. Trabajá en tu propia rama/worktree si C/D/E corren
en paralelo (tocás schema/sidebar/router/i18n compartidos).

Leé COMPLETO PLAN_AGENTES.md (preámbulo + tu sección "Agente C") y README.md, CLAUDE.md, error.md,
context.md. Respetá la PRECEDENCIA y el orden de 8 capas.

Objetivo: CRUD de materias/temas/disponibilidad + generación y recálculo del cronograma (urgencia
por fecha de examen + temas pendientes + horas/día, usando la capa de IA del Agente B). Frontend
features/planner/ con api/hooks/componentes y los 4 estados; vista día por día; marcar tema
completado → recálculo reactivo; entrada en el sidebar (con i18n) dentro del DashboardShell.

NO escribas código todavía. Devolveme: (a) endpoints y DTOs, (b) lógica de distribución/recálculo,
(c) plan de UI con los 4 estados, (d) plan de fase. Espero mi OK.

Criterio de hecho: crear materia/tema/horas → generar plan → completar tema → el plan se recalcula.
typecheck/lint en verde. Documentá decisiones en error.md.
```

---

## Agente D — Flashcards + SRS  ·  Opus/Sonnet · Esfuerzo medio · (después de A y B)

```
Sos el Agente D — Flashcards + SRS del proyecto Bract.

NO empieces hasta que A y B estén mergeados. Rama/worktree propio si va en paralelo con C/E.

Leé COMPLETO PLAN_AGENTES.md (preámbulo + tu sección "Agente D" + Apéndice B "SRS") y README.md,
CLAUDE.md, error.md, context.md. Respetá la PRECEDENCIA y el orden de 8 capas.

Objetivo: generación de flashcards con IA por tema (usa Agente B) + CRUD manual + motor de repaso
espaciado (SM-2 simplificado, ver Apéndice B) con endpoint "revisar" que actualiza ease/intervalDays/
dueDate, y endpoint de cartas "due". Frontend features/flashcards/ con UI de estudio (mostrar →
revelar → calificar), 4 estados, entrada en sidebar (i18n).

NO escribas código todavía. Devolveme: (a) endpoints y DTOs, (b) implementación del SRS,
(c) plan de UI, (d) plan de fase. Espero mi OK.

Criterio de hecho: generar cartas → estudiar → calificar → dueDate y frecuencia reflejan la
dificultad. typecheck/lint en verde. Documentá en error.md.
```

---

## Agente E — Chat de Estudio  ·  Opus/Sonnet · Esfuerzo medio · (después de A y B)

```
Sos el Agente E — Chat de Estudio del proyecto Bract.

NO empieces hasta que A y B estén mergeados. Rama/worktree propio si va en paralelo con C/D.

Leé COMPLETO PLAN_AGENTES.md (preámbulo + tu sección "Agente E" + Apéndice C "Contratos de IA") y
README.md, CLAUDE.md, error.md, context.md. Respetá la PRECEDENCIA y el orden de 8 capas.

Objetivo: tutor IA con contexto del estudiante (materias, temas pendientes/completados, próximo
examen) + persistencia de sesiones/mensajes. Backend: ChatSession/ChatMessage, endpoint de mensaje
que ensambla contexto vía Agente B (streaming si se puede). Frontend features/chat/ con UI de chat
con hilo por sesión, 4 estados, entrada en sidebar (i18n).

NO escribas código todavía. Devolveme: (a) endpoints y DTOs, (b) diseño del ensamblado de contexto
y streaming, (c) plan de UI, (d) plan de fase. Espero mi OK.

Criterio de hecho: el chat responde conociendo el contexto real del estudiante y mantiene el hilo.
typecheck/lint en verde. Documentá en error.md.
```

---

## Agente F — Integración y Contexto Compartido  ·  Opus · Esfuerzo alto · (después de C, D, E)

```
Sos el Agente F — Integración y Contexto Compartido del proyecto Bract.

NO empieces hasta que C, D y E estén mergeados.

Leé COMPLETO PLAN_AGENTES.md (preámbulo + tu sección "Agente F") y README.md, CLAUDE.md, error.md,
context.md. Respetá la PRECEDENCIA.

Objetivo (el diferencial del producto): garantizar que las 3 secciones compartan datos y contexto
en vivo. Completar un tema en el planner debe actualizar el contexto del chat y la frecuencia SRS de
sus flashcards; las flashcards se generan solo sobre temas del planner; el chat referencia el
progreso real. Asegurá una sola fuente de verdad para materias/temas/progreso (sin duplicación).
Implementá invalidaciones/refetch cruzados (React Query) y/o efectos de dominio.

NO escribas código todavía. Devolveme: (a) mapa de dependencias de datos entre las 3 secciones,
(b) qué invalidaciones/efectos vas a agregar, (c) plan de fase. Espero mi OK.

Criterio de hecho: un cambio en una sección se refleja en las otras dos sin recargar manualmente,
verificado end-to-end. typecheck/lint en verde. Documentá en error.md.
```

---

## Agente G — Polish, i18n y Bugs de la Fundación  ·  Opus/Sonnet · Esfuerzo medio · (paralelo, rama propia)

```
Sos el Agente G — Polish, i18n y Bugs de la Fundación del proyecto Bract.

Sos independiente de A–F: trabajá en tu propia rama y mergeá ordenado. Coordiná con F/H para no
pisar i18n de las features nuevas.

Leé COMPLETO PLAN_AGENTES.md (preámbulo + tu sección "Agente G" + sección 8 "Bugs") y README.md,
CLAUDE.md, error.md, context.md. Respetá la PRECEDENCIA.

Objetivo: arreglar los 4 bugs de la sección 8 — (1) i18n: textos hardcodeados (dashboard, "Analytics"
en sidebar) que no traducen; completar es/en de toda la UI. (2) Toggle de idioma en Header.tsx:
mostrar el idioma actual, no el destino. (3) Perfil: "Miembro desde Invalid Date" + nombre vacío
(revisar useProfile y el mapeo de /profile). (4) Notificaciones: campanita con contador pero lista
vacía (revisar query de la lista vs unreadCount). Sumá error boundaries por feature y revisá colores
hardcodeados (usar tokens).

NO escribas código todavía. Devolveme: (a) causa raíz de cada bug, (b) plan de fix, (c) plan de fase.
Espero mi OK.

Criterio de hecho: cambiar idioma afecta TODA la UI; perfil con fecha/nombre correctos;
notificaciones listan lo que el contador indica. typecheck/lint en verde. Documentá en error.md.
```

---

## Agente H — QA End-to-End y Deploy  ·  Opus · Esfuerzo alto · (al final)

```
Sos el Agente H — QA End-to-End y Deploy del proyecto Bract.

NO empieces hasta que F esté mergeado (idealmente también G).

Leé COMPLETO PLAN_AGENTES.md (preámbulo + tu sección "Agente H") y README.md, CLAUDE.md, error.md,
context.md. Respetá la PRECEDENCIA (deploy: db push manual, Session pooler 5432, sin migrate en build).

Objetivo: validar el sistema completo y conectado, y verificar el deploy. Recorré las 3 secciones
end-to-end comprobando el contexto compartido (completar un tema afecta plan + flashcards + chat).
Pasá el checklist de CLAUDE.md. Verificá pnpm -r typecheck + lint + build en verde, los 3 jobs de CI,
y el deploy en Render (API + web). Smoke test de los flujos clave en producción.

Devolveme: (a) reporte de QA con lo que pasa y lo que falla, (b) lista de fixes necesarios (si los
hay) o confirmación de "todo verde y conectado en producción", (c) actualización final de error.md y
README. Si falta cargar env vars/keys o correr db push, indicámelo claramente (eso lo hago yo).

Criterio de hecho: CI verde, deploy live, 3 secciones funcionando conectadas en prod, sin estados rotos.
```
