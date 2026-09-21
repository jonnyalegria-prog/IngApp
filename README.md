# IngApp v2 — complemento para aprender inglés

Reconstrucción completa de IngApp desde una toma de requerimientos real
(no iteración al azar). La v1 quedó pausada en el repo `IngApp-v1`.

**En vivo:** https://jonnyalegria-prog.github.io/IngApp/

## Documentos del proyecto

- Requerimientos (funcionales + no funcionales): documento compartido en
  Claude Docs, acordado con el usuario antes de escribir código.
- Plan técnico y decisiones de arquitectura:
  `C:\Users\jonny\.claude\plans\creo-que-no-entendimos-wild-clock.md`
  (fuera de este repo, en el entorno de la sesión de Claude Code).

## Cómo correrla localmente

```bash
npm install
npm run dev
```

Requiere un `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
(ver `.env.local.example`).

## Estado — Fases 1 a 4 completas

- [x] **Fase 1 — Base**: repo y proyecto de Supabase nuevos, esquema
      completo desde el inicio, autenticación, layout, navegación inferior
      y estilo visual (opción C: minimalista oscuro, elegida entre 3
      mockups).
- [x] **Fase 2 — Organización**: Cuaderno (clasifica solo vocabulario,
      tareas y gramática; detecta la fecha de la clase del texto), Tareas
      (con detección de ejercicio automático disponible), Mis 3 cosas de
      la semana, Gramática — todo agrupado en "Mi Clase".
- [x] **Fase 3 — Aprendizaje activo**: Practicar con 5 modos (Vocabulario
      SRS, Gramática con banco ampliable + ejercicios personalizados
      generados de tus propias tareas/notas, Dictado, Pronunciación,
      Conversación con diálogos guiados) + Diario (libre + guiado).
- [x] **Fase 4 — Motivación**: puntos, 8 logros, progreso detallado.
- [ ] Fuera de esta v1 del proyecto: notificaciones push, rol docente con
      edición en vivo del cuaderno (esquema ya reservado en
      `shared_access`), sugerencias de vocabulario vía DeepL (necesita que
      consigas tu propia clave de API — mientras tanto usa un banco
      curado, igual que v1).

## Banco de contenido (`exercise_bank`)

Tabla ampliable sin tocar código: 24 ejercicios de gramática (to be,
futuro, pasado), 15 frases de dictado, 8 consignas de escritura y 3
diálogos guiados. Se puede seguir agregando contenido con `INSERT`.

## Multiusuario

Jonny y Constanza usan la app con cuentas independientes (cada una con su
propio vocabulario, progreso y nivel). La seguridad por fila (RLS) en
Supabase ya lo soporta sin trabajo extra.

## Stack

React + Vite + TypeScript + Tailwind CSS · Supabase (Postgres + Auth) ·
GitHub Pages + GitHub Actions · lucide-react.
