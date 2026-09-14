-- Meeting Intelligence (módulo premium mod_meeting_intel).
-- Reuniões → transcrição → resumo IA → action items vinculados a issues.
-- RLS por tenant (padrão rls_lockdown: app.current_tenant_id / app.is_tenant_admin).
-- Escrita de transcript/summary: só service_role (Edge Function / bot). Idempotente.

-- ─── Reuniões ───────────────────────────────────────────────────────────────
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  project_id    uuid,                        -- vínculo opcional a um projeto (sem FK: nome da tabela varia)
  title         text not null default 'Reunião',
  source        text not null default 'upload'
                  check (source in ('zoom', 'meet', 'teams', 'upload', 'manual')),
  status        text not null default 'created'
                  check (status in ('created', 'recording', 'transcribing', 'processing', 'ready', 'failed')),
  external_id   text,                        -- id do bot/gravação (ex.: Recall.ai)
  started_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists meetings_tenant_idx on public.meetings (tenant_id, created_at desc);
create index if not exists meetings_project_idx on public.meetings (project_id);

-- ─── Transcrição ────────────────────────────────────────────────────────────
create table if not exists public.meeting_transcripts (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  language      text,
  provider      text,                        -- whisper | deepgram | ...
  segments      jsonb not null default '[]'::jsonb,  -- [{speaker, start, end, text}]
  full_text     text,
  created_at    timestamptz not null default now()
);
create index if not exists meeting_transcripts_meeting_idx on public.meeting_transcripts (meeting_id);

-- ─── Resumo IA ──────────────────────────────────────────────────────────────
create table if not exists public.meeting_summaries (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  summary       text,
  decisions     jsonb not null default '[]'::jsonb,
  model         text,
  generated_at  timestamptz not null default now()
);
create index if not exists meeting_summaries_meeting_idx on public.meeting_summaries (meeting_id);

-- ─── Action items (o diferencial: viram issues) ─────────────────────────────
create table if not exists public.meeting_action_items (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  text          text not null,
  assignee      text,                        -- nome sugerido pela IA (livre)
  due_hint      text,                        -- prazo sugerido pela IA (livre)
  status        text not null default 'open'
                  check (status in ('open', 'converted', 'dismissed')),
  issue_id      uuid,                        -- preenchido quando vira issue (sem FK: nome da tabela varia)
  created_at    timestamptz not null default now()
);
create index if not exists meeting_action_items_meeting_idx on public.meeting_action_items (meeting_id, created_at);

-- ─── RLS ────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['meetings','meeting_transcripts','meeting_summaries','meeting_action_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_scope', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    -- leitura: membros do tenant leem o do próprio tenant
    execute format($f$create policy %I on public.%I for select to authenticated using (tenant_id = app.current_tenant_id())$f$, t || '_read', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- meetings e action_items: membros do tenant também criam/editam (o resto só service_role escreve).
grant insert, update, delete on public.meetings, public.meeting_action_items to authenticated;
create policy meetings_write on public.meetings for all to authenticated
  using (tenant_id = app.current_tenant_id()) with check (tenant_id = app.current_tenant_id());
create policy meeting_action_items_write on public.meeting_action_items for all to authenticated
  using (tenant_id = app.current_tenant_id()) with check (tenant_id = app.current_tenant_id());
-- meeting_transcripts e meeting_summaries: escrita SOMENTE service_role (Edge Function/bot).
