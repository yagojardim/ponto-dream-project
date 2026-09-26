-- Telemetria de uso por tenant (Fatia 5c). Alimenta MAU/DAU, Stickiness, Churn
-- e Adoção de features no painel do Product Manager. Eventos brutos; a captura
-- é fire-and-forget no app (src/data/db/usageEvents.ts) e só ocorre em sessão real.
-- Retenção sugerida: ~90 dias de eventos brutos (limpeza/rollup em fatia futura).
-- Espelha o padrão tenant-scoped de client_messages_responsibles.sql.

create table if not exists public.usage_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  user_id     uuid not null,
  event_type  text not null check (event_type in ('screen_view', 'action')),
  feature_key text not null,
  metadata    jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_usage_events_tenant_time
  on public.usage_events (tenant_id, occurred_at desc);
create index if not exists idx_usage_events_tenant_feature_time
  on public.usage_events (tenant_id, feature_key, occurred_at desc);
create index if not exists idx_usage_events_tenant_user_time
  on public.usage_events (tenant_id, user_id, occurred_at desc);

grant select, insert on public.usage_events to authenticated;
grant all on public.usage_events to service_role;

alter table public.usage_events enable row level security;

drop policy if exists usage_events_tenant_read on public.usage_events;
create policy usage_events_tenant_read on public.usage_events
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists usage_events_tenant_insert on public.usage_events;
create policy usage_events_tenant_insert on public.usage_events
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

notify pgrst, 'reload schema';
