# IngApp v2 — complemento para aprender inglés

App para practicar inglés entre clases: Cuaderno que ordena tus apuntes, tareas por clase, repaso espaciado, ruta de
aprendizaje con el temario de la profe, práctica de gramática, dictado, escucha, pronunciación y conversación, Diario con
corrección, recordatorios y reto en pareja. Todo en español de Chile, pensada para el teléfono (PWA instalable).

**En vivo:** https://jonnyalegria-prog.github.io/IngApp/

## Cómo correrla localmente

```bash
npm install
npm run dev
```

Requiere un `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.local.example`).

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm test` | pruebas automáticas (Vitest) |
| `npm run lint` | lint (oxlint) |
| `npm run build` | compila para producción (`tsc` + Vite) |

Al hacer push a `main`, GitHub Actions corre lint, pruebas y compilación, y publica en GitHub Pages (~40 s). Si el lint o las
pruebas fallan, no se publica.

## Qué tiene

**Mi Clase**
- **Notas (Cuaderno):** pegas tus apuntes y la app separa vocabulario, tareas y gramática (sin IA: reglas + detección de idioma).
  Antes de guardar muestra cómo quedó y marca lo que ya tienes. Reconoce la fecha de la clase, frases completas con su traducción
  (`What do you do for a living? = ¿A qué te dedicas?`) y palabras sueltas en inglés. Se puede **editar y volver a revisar** una
  clase guardada sin duplicar nada.
- **Tareas** agrupadas por clase, **Mis 3 cosas** de la semana y **Gramática** (temas por clase).

**Vocabulario:** lista con búsqueda, edición, deshacer al borrar, sin duplicados y sugerencias por nivel con el significado ya escrito.

**Practicar** (pestañas):
- **Ruta:** 21 unidades con el temario de la profe (números, colores, familia, casa, días, meses, estaciones, ropa, cuerpo,
  animales, ordinales, profesiones, ciudad, transporte, 50 verbos, adjetivos y antónimos, clima, sentimientos, conectores, comida
  y frases útiles). Cada unidad: palabras con audio, agregar a tu vocabulario y mini-prueba (con 70% se completa).
- **Vocabulario:** repaso espaciado (SM-2), máx. 10 palabras nuevas por día, rondas de 20, lo fallado vuelve en la misma ronda y
  lo que más cuesta va primero.
- **Gramática:** 12 temas de opción múltiple + "Mis ejercicios" (generados de tus tareas y notas) + "Repasar mis errores".
- **Lectura** (toca una palabra para verla), **Dictado** (voz normal o lenta, revisión palabra por palabra), **Escucha**
  (audio + preguntas), **Pronunciación** (reconocimiento de voz cuando el navegador lo permite; si no, grabarte y compararte) y
  **Conversación** (diálogos guiados).

**Diario:** texto libre o consignas guiadas, con corrección de gramática (LanguageTool + reglas para hispanohablantes) y
retro-traducción.

**Inicio:** racha, meta diaria (10 respuestas), "seguir donde quedaste", tu ruta, temas a reforzar, precisión por práctica y logros.

**Ajustes** (menú de la cuenta): tu nombre, **recordatorios push**, **enlace de solo lectura para la profe** y **reto en pareja**.

## Cómo está armado

- **Front:** React 19 + Vite + TypeScript + Tailwind v4, HashRouter, zustand, PWA (`vite-plugin-pwa`, actualización con aviso).
  Pantallas menos usadas se cargan bajo demanda (`React.lazy`).
- **Carga y errores:** `useLoad` (estado de error + "Reintentar" + recarga al volver a la app), `ToastProvider` (avisos y "Deshacer"),
  `ErrorBoundary`, caché de lecturas en memoria (`src/lib/cache.ts`) que las escrituras invalidan.
- **Datos:** Supabase (Postgres + Auth). Todas las tablas del usuario tienen RLS `to authenticated` con `(select auth.uid())`.
- **Lógica pura con pruebas** (`src/lib/*.test.ts`): reconocedor de apuntes, guardado sin duplicados (`classSave`), SRS y rondas,
  cloze, semanas y racha, progreso, quiz de unidades, dictado, recordatorios, corrector.

### Base de datos

| Tabla | Para qué |
|---|---|
| `words`, `grammar_topics`, `notebook_entries`, `homework_tasks`, `discovery_picks`, `user_settings` | datos de cada persona |
| `practice_log` | cada respuesta de práctica (meta diaria, precisión, temas a reforzar, resumen) |
| `unit_progress` | mejor puntaje por unidad de la ruta |
| `vocab_bank` | ~640 palabras con su significado escrito a mano (`translation`) y tema (`theme`) |
| `exercise_bank` | ejercicios: `grammar_mcq`, `dictation`, `dialogue`, `writing_prompt`, `listening` |
| `reading_texts` | lecturas por nivel |
| `translation_cache`, `translation_usage` | caché compartido y cupo mensual de DeepL |
| `push_subscriptions`, `reminder_prefs` | recordatorios |
| `share_links` | enlaces de solo lectura para la profe |
| `partner_invites`, `partnerships` | reto en pareja |

El contenido (banco de palabras, ejercicios, textos) se carga con `INSERT` y se puede seguir ampliando sin tocar código. El
esquema agregado en la fase 3 está en `supabase/migrations/`; las migraciones de datos están en el historial de Supabase.

Funciones SQL: `shared_summary(token)` (público, solo cifras), `create_partner_invite()`, `accept_partner_invite(code)`,
`partner_overview()` (autenticados) y `get_deepl_key()`, `get_vapid_keys()`, `get_cron_secret()`, `reminder_batch()`,
`set_vapid_keys()` (solo `service_role`).

### Funciones Edge

- **`deepl`** — proxy de traducción. La clave de DeepL API Free vive en **Vault** (`deepl_api_key`), nunca en el repo ni en el
  navegador. Exige sesión (`verify_jwt` + `auth.getUser`), caché compartido, tope de 300.000 caracteres/mes por usuario y 1.500 por
  pedido. Acciones: `translate`, `suggest` (usa el significado del banco y solo llama a DeepL si falta) y `status` (diagnóstico:
  consumo real de DeepL, tuyo y del caché). Los pasos quedan en los logs (`[deepl] ...`).
  Solo se envía a DeepL vocabulario y contenido del banco; **nunca** el Cuaderno ni el Diario.
- **`send-reminders`** — avisos push. `pg_cron` la llama cada hora en punto con un secreto de Vault (`cron_secret`); decide con
  `reminderRules.ts` (probado con Vitest) y manda con `web-push`. Las claves VAPID se generan solas la primera vez y quedan en
  Vault. Con sesión, también entrega la clave pública y manda un aviso de prueba.

### Recordatorios

- Aviso diario a la hora que elijas (hora de Chile): "Te esperan N palabras" o "No pierdas tu racha de N días" (solo si no
  practicaste hoy), y la víspera de tu clase si te quedan tareas. Ventana de 2 horas por si falla una ejecución.
- **iPhone:** requiere iOS 16.4+ y la app **instalada** (Safari → Compartir → Agregar a inicio, abrir desde el ícono). El permiso se
  pide desde el botón de Ajustes. Solo se puede comprobar de verdad en un iPhone real.

## Operación

- **Cambiar la clave de DeepL:** `select vault.update_secret(id, 'nueva-clave')` en el SQL Editor (el `id` sale de
  `select id from vault.secrets where name = 'deepl_api_key'`).
- **Ver si DeepL funciona:** menú de la cuenta → "Probar la traducción" (muestra la etapa exacta si falla).
- **Desactivar el registro abierto** (recomendado ahora que las dos cuentas existen): Supabase → Authentication → Sign In /
  Providers → "Allow new users to sign up". Sin eso cualquiera podría crear una cuenta y gastar el cupo de DeepL. También conviene
  activar la protección de contraseñas filtradas en el mismo panel.
- **Apagar los recordatorios para todos:** `select cron.unschedule('send-reminders-hourly');`

## Límites conocidos

- El reconocimiento de voz de Pronunciación depende del navegador; en la app instalada del iPhone puede no estar disponible (la
  pantalla pasa sola a "grabarme y comparar").
- Los recordatorios y el micrófono/voz del iPhone solo se prueban en un dispositivo real.
- Los apuntes se clasifican con reglas (sin IA): cuando duda, manda la línea a Gramática y se puede mover desde la vista previa.

## Stack

React + Vite + TypeScript + Tailwind CSS · Supabase (Postgres + Auth + Vault + Edge Functions + pg_cron) · GitHub Pages +
GitHub Actions · lucide-react · Vitest · oxlint.
