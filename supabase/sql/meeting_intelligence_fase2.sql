-- Meeting Intelligence — Fase 2 (casca completa).
-- Tabelas de apoio para: notas, compartilhamento, cota/horas, solicitações,
-- contratação, pool do workspace, notificações; + colunas de gravação/arquivo
-- em meetings; + purga automática de arquivadas (30 dias).
--
-- PADRÃO (igual à Fatia 1A): RLS *desligada* neste estágio — o rls_lockdown.sql
-- global ainda NÃO foi aplicado, então o isolamento é feito no cliente (o front
-- SEMPRE envia tenant_id = getActiveTenantId() na escrita e filtra por ele na
-- leitura). Quando o rls_lockdown global for aplicado, estas tabelas entram no
-- lockdown junto com as demais. FKs de pessoa → public.profiles(id) (nunca
-- auth.users). Idempotente (create ... if not exists).

create schema if not exists app;

-- ─── Colunas novas em meetings (gravação + arquivamento) ────────────────────
alter table public.meetings add column if not exists audio_url   text;
alter table public.meetings add column if not exists archived_at timestamptz;
create index if not exists meetings_archived_idx
  on public.meetings (archived_at) where archived_at is not null;

-- ─── Notas da reunião (Onda A — funciona já) ────────────────────────────────
create table if not exists public.meeting_notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  time_anchor text,                      -- "mm:ss" opcional (âncora no tempo)
  created_at  timestamptz not null default now()
);
create index if not exists meeting_notes_meeting_idx on public.meeting_notes (meeting_id, created_at);
create index if not exists meeting_notes_tenant_idx  on public.meeting_notes (tenant_id);

-- ─── Compartilhamento de reunião (Onda A — funciona já) ─────────────────────
create table if not exists public.meeting_shares (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  meeting_id     uuid not null references public.meetings(id) on delete cascade,
  shared_with_id uuid not null references public.profiles(id) on delete cascade,
  shared_by_id   uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (meeting_id, shared_with_id)
);
create index if not exists meeting_shares_meeting_idx on public.meeting_shares (meeting_id);
create index if not exists meeting_shares_with_idx    on public.meeting_shares (shared_with_id, tenant_id);

-- ─── Cota por usuário (Onda B — casca; used_minutes só o motor preenche) ────
create table if not exists public.meeting_quotas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role_context  text,
  quota_minutes integer not null default 0,
  used_minutes  integer not null default 0,
  period_start  date,
  period_end    date,
  updated_at    timestamptz not null default now(),
  unique (tenant_id, profile_id)
);
create index if not exists meeting_quotas_tenant_idx on public.meeting_quotas (tenant_id);

-- ─── Solicitações de horas (Onda B — fluxo funciona; consumo depende do motor) ─
create table if not exists public.meeting_hour_requests (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  requester_id    uuid not null references public.profiles(id) on delete cascade,
  type            text not null check (type in ('temporaria', 'definitiva')),
  minutes         integer not null check (minutes > 0),
  justification   text not null,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  granted_minutes integer,
  decided_by      uuid references public.profiles(id) on delete set null,
  reason          text,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);
create index if not exists meeting_hour_requests_tenant_idx on public.meeting_hour_requests (tenant_id, status, created_at desc);

-- ─── Contratação de horas avulsas (Onda B — casca até pagamento) ────────────
create table if not exists public.meeting_hour_purchases (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  minutes      integer not null check (minutes > 0),
  amount_cents integer not null,
  method       text not null check (method in ('pix', 'card')),
  status       text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled')),
  purchased_by uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists meeting_hour_purchases_tenant_idx on public.meeting_hour_purchases (tenant_id, created_at desc);

-- ─── Pool de horas do workspace (Onda B — casca) ────────────────────────────
create table if not exists public.tenant_meeting_pool (
  tenant_id          uuid primary key references public.tenants(id) on delete cascade,
  contracted_minutes integer not null default 0,
  extra_minutes      integer not null default 0,
  period_start       date,
  period_end         date,
  renova_at          date,
  updated_at         timestamptz not null default now()
);

-- ─── Notificações do módulo (sino) ──────────────────────────────────────────
create table if not exists public.meeting_notifications (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,  -- null = admins do tenant
  kind         text not null check (kind in ('request', 'approved', 'denied', 'share', 'usage', 'module')),
  body         text not null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists meeting_notifications_recipient_idx on public.meeting_notifications (tenant_id, recipient_id, read, created_at desc);

-- ─── Grants (RLS-off: front acessa direto como authenticated; service_role total) ─
do $$
declare t text;
begin
  foreach t in array array[
    'meeting_notes', 'meeting_shares', 'meeting_quotas', 'meeting_hour_requests',
    'meeting_hour_purchases', 'tenant_meeting_pool', 'meeting_notifications'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ─── Purga automática de reuniões arquivadas (retenção 30 dias) ─────────────
-- Mesmo padrão de app.purge_support_logs: função no schema privado app,
-- executável só por service_role, agendada por pg_cron quando disponível.
create or replace function app.purge_archived_meetings(retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted integer;
begin
  delete from public.meetings
   where archived_at is not null
     and archived_at < now() - make_interval(days => greatest(retention_days, 1));
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function app.purge_archived_meetings(integer) from public, anon, authenticated;
grant execute on function app.purge_archived_meetings(integer) to service_role;

-- Agendamento diário via pg_cron, se a extensão existir (no-op caso não).
-- @devops: sem pg_cron, agende externamente um cron chamando
-- app.purge_archived_meetings(30) com a service_role.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge_archived_meetings') then
      perform cron.unschedule('purge_archived_meetings');
    end if;
    perform cron.schedule('purge_archived_meetings', '15 3 * * *', $cron$select app.purge_archived_meetings(30)$cron$);
  end if;
end $$;
