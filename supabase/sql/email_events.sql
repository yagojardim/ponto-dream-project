-- email_events: métricas de e-mail (eventos do Resend recebidos por webhook).
-- Escrita: apenas service_role (Edge Function) — ignora RLS.
-- Leitura: apenas admin do tenant, e só do próprio tenant.
-- Alinhado ao padrão do rls_lockdown.sql (schema app: current_tenant_id / is_tenant_admin).

create table if not exists public.email_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete set null,
  provider      text not null default 'resend',
  message_id    text,                 -- data.email_id do Resend
  event_type    text not null,        -- email.sent | delivered | opened | clicked | bounced | complained | delivery_delayed
  to_email      text,
  from_email    text,
  subject       text,
  template_key  text,
  payload       jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz,          -- created_at do evento (Resend)
  created_at    timestamptz not null default now()
);

-- Idempotência: mesmo e-mail + mesmo tipo + mesmo instante não duplica.
-- COALESCE evita NULLs "distintos" burlarem o unique.
create unique index if not exists email_events_dedupe
  on public.email_events (message_id, event_type, coalesce(occurred_at, created_at));

create index if not exists email_events_tenant_idx  on public.email_events (tenant_id, created_at desc);
create index if not exists email_events_type_idx    on public.email_events (event_type);
create index if not exists email_events_to_idx      on public.email_events (to_email);
create index if not exists email_events_tmpl_idx    on public.email_events (template_key);

alter table public.email_events enable row level security;

-- Leitura: admin do tenant lê eventos do próprio tenant.
drop policy if exists email_events_admin_read on public.email_events;
create policy email_events_admin_read on public.email_events
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_tenant_admin());

-- Sem policies de insert/update/delete para authenticated:
-- somente service_role (que ignora RLS) escreve, via a Edge Function do webhook.
revoke all on public.email_events from anon, authenticated;
grant select on public.email_events to authenticated;
