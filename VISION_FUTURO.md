# Bract — Análisis crítico y visión de futuro

> Documento de PLANIFICACIÓN, no de implementación. Parte del estado proyectado: con todo lo planeado
> ya hecho (MVP A–H, K importación, Temario, I quiz, I-2 progreso/personalización, L voz, J gamificación,
> pase estético). Pregunta guía: **¿qué hace que el estudiante aprenda MÁS y mejor?** — no "¿qué feature
> falta?". Las features son medios; el resultado de aprendizaje es el fin.

---

## 0. La lente para decidir

Una app de estudio no se evalúa por cantidad de funciones sino por **outcome de aprendizaje** y
**retención de uso**. Toda idea de abajo se juzga con dos preguntas: ¿el estudiante retiene/entiende
más?, ¿vuelve mañana? Si una feature no mueve ninguna de las dos, es decoración.

---

## 1. El diferencial real de Bract (dónde doblar la apuesta)

Existen muchas apps de estudio (Anki, Quizlet, RemNote). Casi todas hacen UNA pieza bien. La ventaja de
Bract es el **loop adaptativo integrado**:

```
importar material → plan del día → estudiar (flashcards/chat) → evaluarse (quiz)
→ detectar puntos débiles → re-planificar + el tutor ya sabe dónde flaqueás → repetir
```

Pocas apps cierran ese círculo. **Esa integración ES el moat.** Recomendación estratégica: antes de
sumar features dispersas, hacer ese loop más inteligente y más visible para el estudiante (que sienta
que la app lo conoce y se adapta). Todo lo demás debería reforzar el loop, no competir con él.

---

## 2. PUNTOS CRÍTICOS / RIESGOS (lo más importante, primero)

### 2.1 Correctitud del contenido generado por IA ⚠️ (el riesgo #1 de una app de estudio)
Si Gemini genera una flashcard con un dato falso, o un quiz cuya opción "correcta" está mal, el
estudiante **memoriza algo incorrecto y la repetición espaciada lo refuerza**. Es peor que no estudiar.
Para una app cuyo núcleo es contenido IA, esto es existencial.
Mitigaciones (en orden de valor):
- **Grounding en el material del usuario:** generar flashcards/quiz desde el PDF/apunte importado, no
  desde el conocimiento abierto del modelo. Reduce drásticamente las alucinaciones (estilo RAG).
- **Editar / marcar / reportar** cualquier carta o pregunta IA. El estudiante corrige y la app aprende
  qué descartar.
- **Señal de confianza:** marcar contenido que el modelo generó con baja certeza.

### 2.2 Techo del free tier de Gemini
Las features de IA dependen de un free tier con límites de rate y disponibilidad. Con varios usuarios
reales, se throttlea. Mitigar con: **cachear salidas de IA** (mismo tema → no regenerar), degradación
elegante (ya existe AI_UNAVAILABLE), y un modelo de costos pensado para cuando el free tier no alcance.

### 2.3 El frontend no tiene tests
El backend tiene vitest; el front, ningún runner. A medida que crece, eso es riesgo de regresión en lo
que el usuario realmente toca. Sumar Vitest + React Testing Library en los flujos críticos (quiz runner,
planner, auth).

### 2.4 Infraestructura free = arranques en frío
Render free apaga la instancia inactiva → primera carga lenta y el `setInterval` de limpieza muere
mientras está dormida. Para usuarios reales, afecta confianza y tareas en segundo plano.

### 2.5 Silo por estudiante (fricción de arranque)
Cada estudiante construye sus materias/temas/cartas desde cero. Es la barrera más grande para llegar al
"momento de valor". La importación ayuda; faltan **plantillas y/o mazos compartidos** (ver 4.4).

---

## 3. Mejoras PEDAGÓGICAS (mayor impacto en aprendizaje real)

Bract ya tiene los dos pilares con evidencia: recuerdo activo (quiz/flashcards) + repetición espaciada
(SM-2). Lo que más sumaría encima:

- **Preguntas abiertas / respuesta corta, corregidas por IA.** El quiz actual es solo opción múltiple,
  que mide *reconocimiento*. Las preguntas abiertas miden *recuerdo* real y comprensión. Alto valor.
- **Modo "explicámelo" (técnica Feynman).** El estudiante explica un tema con sus palabras y la IA
  evalúa y señala huecos. Es de lo más efectivo que existe para fijar conocimiento y casi nadie lo hace.
- **Calibración de confianza.** Antes de revelar, preguntar "¿qué tan seguro estás?". Cruzar confianza
  vs acierto detecta el peligro real: lo que creés que sabés y no. Metacognición pura, muy subutilizada.
- **Interleaving deliberado en el planner — OPCIONAL (decisión del usuario).** Mezclar temas/materias en
  una sesión (en vez de bloques) mejora la retención, PERO a algunos los marea o los desorienta. DEBE ser
  un toggle del estudiante (off por defecto), nunca forzado. Encaja como otra preferencia en
  UserStudyPreferences.
- **Variedad de recuperación:** cloze (completar huecos), no solo MCQ.
- **Soporte de imágenes/diagramas** en cartas y material (anatomía, química, matemática lo necesitan).

---

## 4. ENGAGEMENT (que vuelva mañana) — bien hecho

- **Gamificación atada a MAESTRÍA, no a actividad.** El error clásico (J): premiar "hice 10 cartas" crea
  métricas de vanidad y, peor, las rachas generan culpa/ansiedad (mal para el bienestar). Premiar
  retención y dominio real, y hacer las rachas perdonadoras (no castigar un día perdido).
- **Recordatorios inteligentes** alineados a cuándo vencen las cartas (SRS) y a la disponibilidad del
  estudiante. Requiere jobs en segundo plano (hoy BullMQ está desactivado) — decisión de infra.
- **Onboarding contra la pantalla en blanco.** Un primer flujo guiado: importá tu primer apunte → mirá
  cómo se arma el plan → hacé tu primer quiz. El primer "ajá" tiene que llegar en minutos.
- **Plantillas / mazos compartidos** (ver 2.5): bajar de "construí todo vos" a "empezá desde algo".
  Gran palanca, pero build grande (moderación, calidad). Evaluar más adelante.

---

## 5. CÓMO SE VE Y SE SIENTE

- **Pase estético** (ya planeado, ref codex.io): consistencia de tokens, micro-interacciones, momentos
  de celebración atados a la gamificación.
- **Modo oscuro.** Se estudia de noche; es de las cosas más pedidas. Verificar si ya está; si no, sumarlo.
- **Modo foco / sesión de estudio sin distracciones** (timer tipo pomodoro opcional, UI minimal).
- **Accesibilidad (a11y):** navegación por teclado, contraste, lectores de pantalla. Se suele saltear, y
  además amplía el público. Encaja natural con la feature de voz (L).

### Herramienta para el pase estético: skill `ui-ux-pro-max`
NO es un set de plantillas: es un motor de decisión de diseño + base de conocimiento (161 paletas, 57
pares de tipografías, 67 estilos, 99 reglas UX, checklist de QA). Soporta web (HTML+Tailwind por
defecto, React, Next, shadcn) — el SKILL.md "React Native only" que vimos era una variante generada para
un proyecto RN; al instalarla para Claude Code se le indica el stack real (React + Tailwind + shadcn).
- **USAR:** el generador de design-system (paleta/tipografía/efectos como MATERIA PRIMA), las 99 reglas
  UX + el pre-delivery checklist como QA, y las búsquedas de color/tipografía. Para PROYECTOS NUEVOS es
  donde más brilla (arranca un design system coherente en segundos).
- **NO seguir a ciegas:** su recomendación sale de una base fija → si la tomás literal, sale "samey".
  La identidad de Bract la marca TU dirección (codex.io) + los tokens propios; la skill es insumo + QA,
  no la identidad. Y sus anti-patrones por industria son opinables (p.ej. dice "evitá dark mode" para
  algunos rubros — para una app de estudio el dark mode SÍ se quiere; usar criterio).
- **Cuidado:** ejecuta scripts de Python locales (instala Python si falta). Se ve benigno pero corre
  código de terceros.
- **Instalación:** plugin de Claude Code (`/plugin marketplace add` + `/plugin install`) o el CLI
  `uipro init --ai claude`. Indicar stack React+Tailwind. Alternativa sin instalar nada: usar solo el
  Quick Reference + checklist del SKILL.md como doc estático de QA.

---

## 6. MÓVIL (lo preguntaste — y es crítico)

Los estudiantes estudian en el teléfono, muchísimo. Hoy Bract es web (React/Vite) pensada para desktop.
Tres caminos:

- **Responsive web** — que la app actual funcione bien en pantalla chica. Lo más barato, reusa todo.
- **PWA (recomendado)** — app instalable, **repaso offline** (estudiar flashcards en el colectivo sin
  señal = killer feature para estudiar), notificaciones push para recordatorios. Reusa el código React.
- **Nativa (React Native)** — mejor experiencia y app stores, pero mucho más trabajo. Sobredimensionado
  por ahora.

**Recomendación:** primero **responsive**, después **PWA**. El repaso offline + las push de recordatorio
son, para una app de estudio, de altísimo valor por costo relativamente bajo (reusa React). Diseñar los
loops de estudio (cartas, quiz, chat) *mobile-first* —son perfectos para el teléfono, incluso con swipe—
y dejar la gestión pesada (armar el planner, importar) para desktop.

---

## 7. DISTRIBUCIÓN Y MONETIZACIÓN (cómo lograr que la usen y paguen)

El cuello de botella de casi todo producto no es construirlo, es que lo usen. Orden correcto:
**primero amor, después plata.** No se monetiza la indiferencia.

**Conseguir usuarios (un estudiante solo, presupuesto chico):**
- **Empezá por vos y tu círculo.** Usá Bract en tus propias materias; después tus compañeros (misma
  cursada, mismos temas). Acá los mazos compartidos (4.4) se vuelven motor de crecimiento: "hice las
  flashcards de toda Anatomía, tomá". Una app de estudio se contagia DENTRO de una cohorte.
- **Nichá.** "App de estudio para todos" es invisible. "La app que convierte los PDFs de [materia/examen]
  en plan + quizzes" para una facultad/examen concreto es buscable y compartible. Dominá un nicho que
  conozcas, después expandís.
- **Estate donde ya están los estudiantes:** grupos de WhatsApp/Telegram de la cursada, Discord,
  subreddits, grupos de Facebook de la facultad, y study-tok (TikTok/Instagram). Mostrá, no expliques:
  un clip de "pego un PDF → flashcards + quiz en 30 segundos" es viral por sí solo.
- **La cuña viral es la importación:** es el momento más demostrable. Liderá la comunicación con eso.
- **Primer "ajá" en minutos** (ver onboarding 4): si un compañero abre y ve pantalla vacía, se va.

**Monetización (cómo cobrar):**
- **Freemium:** gratis lo suficiente para ser útil de verdad (SRS + un cupo de IA/mes); pago por IA
  ilimitada y features avanzadas (preguntas abiertas, voz, compartir). Stripe.
- **Precio de estudiante:** bajo ($3–8/mes, o pago por semestre, o por examen). Son sensibles al precio
  pero SÍ pagan por ahorrar tiempo y mejorar notas (Quizlet, Chegg, Photomath viven de eso).
- **Vendé el resultado, no la feature:** ahorrar tiempo, mejor nota, menos ansiedad.
- **Cobrá DESPUÉS del amor:** llegá primero a unas decenas de estudiantes activos semanales que se
  frustrarían si Bract desapareciera; recién ahí monetizás. Cobrar antes mata el crecimiento temprano.
- **Cuidá la unit economics:** el costo de IA por usuario vs el precio. El techo del free tier (2.2)
  limita cuán generoso puede ser tu plan gratis. Modelá esto ANTES de escalar usuarios gratis.

**Verdad incómoda:** esto es difícil y la mayoría no consigue tracción. Mejor 10 estudiantes que la AMAN
que 1000 que se encogen de hombros. Profundidad sobre amplitud al principio. Tu ventaja real: estás
(o estuviste) en el mercado objetivo — tu propia cursada es tu cabecera de playa y tu loop de feedback.

---

## 8. PRIORIZACIÓN RECOMENDADA (siendo crítico)

No todo vale lo mismo. Si tuviera que ordenar por impacto-en-aprendizaje sobre esfuerzo:

**Hacer sí o sí (núcleo y riesgo):**
1. **Grounding del contenido IA en el material importado** (2.1) — protege lo más valioso de la app.
2. **Editar/marcar contenido IA** (2.1) — barato y alto impacto en confianza y calidad.
3. **Móvil: responsive → PWA con repaso offline** (6) — donde realmente estudian.

**Alto valor pedagógico (el diferencial):**
4. **Preguntas abiertas + modo Feynman + calibración de confianza** (3) — sube a Bract por encima del
   quiz MCQ genérico; es el moat del loop adaptativo aplicado a la evaluación.

**Salud del producto:**
5. Cachear IA + plan para el techo del free tier (2.2); tests de frontend (2.3); arranques en frío (2.4).

**Engagement y forma (después del núcleo):**
6. Gamificación atada a maestría + recordatorios SRS (4); modo oscuro/foco + a11y (5); pase estético.

**Más adelante / según objetivo:**
7. Plantillas/mazos compartidos (4.4); freemium + Stripe (7); imágenes en cartas (3).

---

## 9. La idea de una línea

El futuro de Bract no es "más features": es **cerrar y afilar el loop adaptativo** (importar→plan→
estudiar→evaluar→puntos débiles→re-plan), con **contenido IA en el que se pueda confiar** y **disponible
en el teléfono**. Eso —no la cantidad de pantallas— es lo que hace que un estudiante aprenda más y vuelva.
