# IngApp v2 — complemento para aprender inglés

Reconstrucción completa de IngApp desde una toma de requerimientos real
(no iteración al azar). La v1 quedó pausada en el repo `IngApp-v1`.

**En vivo:** (se agrega cuando se publique el primer deploy)

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

## Estado (Fase 1 de 4 — Base)

- [x] Repo y proyecto de Supabase nuevos, esquema completo desde el inicio.
- [x] Autenticación (email + contraseña, Supabase Auth).
- [x] Layout, navegación inferior y estilo visual (opción C: minimalista
      oscuro, elegida por el usuario entre 3 mockups).
- [ ] Fase 2 — Organización: Cuaderno, Tareas, Mis 3 cosas, Gramática.
- [ ] Fase 3 — Aprendizaje activo: Vocabulario + SRS, ejercicios de
      gramática, dictado, pronunciación, escritura, conversación simulada
      (diálogos guiados, sin IA).
- [ ] Fase 4 — Motivación: gamificación, estadísticas detalladas.
- [ ] Fuera de esta v1 del proyecto: notificaciones push, rol docente con
      edición en vivo del cuaderno (esquema ya reservado en `shared_access`).

## Multiusuario

Jonny y Constanza usan la app con cuentas independientes (cada una con su
propio vocabulario, progreso y nivel). La seguridad por fila (RLS) en
Supabase ya lo soporta sin trabajo extra.

## Stack

React + Vite + TypeScript + Tailwind CSS · Supabase (Postgres + Auth) ·
GitHub Pages + GitHub Actions · lucide-react.
