-- Esquema agregado en la fase 3 (ya aplicado en el proyecto). El contenido (palabras, ejercicios, textos)
-- vive en la base de datos y se cargó con migraciones de datos aparte; ver el historial de migraciones en Supabase.

-- Significado escrito a mano (español de Chile) para cada palabra del banco: sin depender de DeepL.
alter table public.vocab_bank add column if not exists translation text;

-- Nuevo tipo de ejercicio: comprensión auditiva.
alter table public.exercise_bank drop constraint if exists exercise_bank_kind_check;
alter table public.exercise_bank add constraint exercise_bank_kind_check
  check (kind = any (array['grammar_mcq','dictation','dialogue','writing_prompt','listening']));

-- Progreso por unidad de la ruta de aprendizaje.
create table if not exists public.unit_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unit_id text not null check (char_length(unit_id) <= 40),
  best_score integer not null default 0 check (best_score between 0 and 100),
  attempts integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_id)
);
alter table public.unit_progress enable row level security;

create policy "own unit progress: select" on public.unit_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own unit progress: insert" on public.unit_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own unit progress: update" on public.unit_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own unit progress: delete" on public.unit_progress
  for delete to authenticated using (user_id = (select auth.uid()));
