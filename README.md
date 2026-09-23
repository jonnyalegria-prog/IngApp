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
- [x] **DeepL**: traducción con contexto, sugerencias de vocabulario por nivel,
      lectura con traducción al toque y retro-traducción en escritura
      guiada (ver sección "DeepL" abajo).
- [ ] Fuera de esta versión: notificaciones push y rol docente con edición
      en vivo del cuaderno (esquema ya reservado en `shared_access`).

## DeepL

Usos, todos con el texto del banco de contenido o palabras sueltas (nunca el
Cuaderno ni el Diario libre):

- **Vocabulario → 🌐 Traducir**: completa el campo vacío (EN→ES o ES→EN),
  usando el ejemplo como contexto.
- **Vocabulario → Palabras nuevas para ti**: sugerencias por nivel
  (`vocab_bank`), traducidas según su ejemplo.
- **Practicar → Lectura**: textos por nivel (`reading_texts`) o texto propio;
  tocas una palabra y ves su significado según la oración.
- **Dictado / Conversación**: 🌐 para ver el significado en español.
- **Diario → Consignas guiadas**: traducción de referencia de DeepL y
  "retro-traducción" de tu respuesta (más corrección de LanguageTool).

Cómo está armado:

- La clave de DeepL API Free vive en **Supabase Vault** (`deepl_api_key`). Solo
  la lee la Edge Function `supabase/functions/deepl` mediante
  `public.get_deepl_key()` (ejecutable únicamente por `service_role`). Nunca
  está en el repo ni en el navegador.
- La función exige un usuario logueado (`verify_jwt` **y** `auth.getUser`: la
  clave pública `anon` pasa la primera verificación, no la segunda).
- Caché compartido `translation_cache` (cada texto del banco se traduce una
  sola vez para todos) y tope mensual por usuario en `translation_usage`
  (300.000 de los 1.000.000 caracteres/mes del plan Free); máx. 1.500
  caracteres por pedido.
- Para cambiar la clave: `select vault.update_secret(id, 'nueva-clave')` desde
  el SQL Editor de Supabase (el `id` sale de `select id from vault.secrets
  where name = 'deepl_api_key'`).
- **Recomendado:** cuando Jonny y Constanza ya tengan cuenta, desactivar el
  registro abierto en Supabase → Authentication → Sign In / Providers →
  "Allow new users to sign up". Sin eso cualquiera podría crear una cuenta y
  gastar el cupo de DeepL.

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
