# Bract

App de estudio con IA para preparar exámenes. Reúne en un solo lugar la organización, el material de estudio y las dudas, y las tres partes comparten el mismo contexto: la IA sabe qué materias tenés, cuánto avanzaste y qué te cuesta.

**Estado:** desplegada en Render (API y web), con Supabase, Upstash Redis y Google Gemini. El primer acceso puede tardar un minuto si el servidor gratuito estaba dormido.

## Qué hace

- **Planificador.** Cargás materias, temas, fechas de examen y horas libres por día, y la IA arma un cronograma semanal según qué examen está más cerca y cuánto falta. Se recalcula solo cuando marcás temas como hechos o cuando un día no estudiaste.
- **Flashcards con repaso espaciado.** Se generan por tema o por varios temas a la vez, y se repasan con un algoritmo SM-2 que decide cuándo vuelve cada tarjeta.
- **Chat tutor.** Responde las dudas teniendo en cuenta tus materias, tu avance y tus puntos débiles, con respuesta en streaming.
- **Temario.** Vista de materias y temas desde la que se estudia cada tema, se genera material o se pregunta al chat.
- **Importar material.** Se cargan apuntes en texto o en archivos; la IA extrae los temas y guarda un extracto fiel de cada uno para que las preguntas y tarjetas se basen en tu material y no en lo que invente.
- **Evaluaciones.** Cuestionarios generados por IA, corregidos en el servidor pregunta a pregunta (sin forma de ver las respuestas antes de contestar), con explicación por opción, historial y medición de cuánta confianza tenías al responder.
- **Progreso.** Porcentaje de acierto por materia y por tema, detección de puntos débiles y preferencias de refuerzo que el planificador y el chat tienen en cuenta.
- **Voz.** Dictado en el chat y lectura en voz alta de las respuestas, con la API de voz del navegador, sin costo.
- **Gamificación.** Niveles, experiencia, racha con escudos, misiones diarias y un «jefe del día» que es tu tema más flojo. Solo da puntos por aprender (aciertos, repasos que tocaban, temas dominados), nunca por actividad vacía.
- Español e inglés, modo oscuro de base, roles de estudiante y administrador.

## Tecnología

Monorepo con pnpm y TypeScript en todo el sistema:

- **`apps/web`:** React 18, Vite, Tailwind, TanStack Query, Zustand, React Hook Form, Framer Motion, Recharts e i18next.
- **`apps/api`:** Node 20 con Express, Prisma sobre Supabase Postgres, autenticación con JWT RS256, Upstash Redis para límites de uso, caché y lista de sesiones revocadas, y Winston para registros.
- **`packages/shared`:** tipos y esquemas Zod compartidos entre la web y la API.

La IA se usa a través de un único servicio con modelos distintos según la tarea. Si falta la clave, la aplicación arranca igual: el planificador usa un cálculo propio y lo que depende de la IA responde «no disponible».

## Ponerlo en marcha

Requiere Node 20 o posterior y pnpm 9.

1. Copiar `apps/api/.env.example` y `apps/web/.env.example` como `.env` en cada carpeta y completarlos (base de datos de Supabase, Redis de Upstash, claves JWT y, si se quiere IA, `AI_API_KEY` con la clave de Gemini).
2. Instalar y arrancar:

```bash
pnpm install
pnpm --filter @bract/shared build
pnpm dev
```

Otros comandos: `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm build`. El despliegue en Render está descrito en `render.yaml`.

## Documentación

| Archivo | Qué es |
|---|---|
| [`SPEC.md`](SPEC.md) | La especificación completa: arquitectura, datos, API, interfaz, seguridad y fases. Es la fuente de verdad del sistema |
| [`CLAUDE.md`](CLAUDE.md) | Reglas para los agentes que desarrollan el proyecto |
| [`PLAN_AGENTES.md`](PLAN_AGENTES.md) | Plan de trabajo por agente y estado del despliegue |
| [`VISION_FUTURO.md`](VISION_FUTURO.md) e [`IDEAS_POST_MVP.md`](IDEAS_POST_MVP.md) | Hacia dónde va el producto |
| [`error.md`](error.md) | Registro de errores y decisiones técnicas |

---

**In English:** Bract is an AI study app for exam preparation. A planner builds and rebalances a weekly schedule from your subjects, topics, exam dates and free hours; flashcards use SM-2 spaced repetition; an AI tutor chat knows your progress and weak topics; imported notes ground the generated quizzes and cards; server-graded quizzes, a progress dashboard, voice dictation and read-aloud, and learning-based gamification complete it. TypeScript monorepo: React + Vite web app, Express + Prisma API on Supabase Postgres, Upstash Redis, Google Gemini. Run `pnpm install`, build `@bract/shared`, then `pnpm dev`.
