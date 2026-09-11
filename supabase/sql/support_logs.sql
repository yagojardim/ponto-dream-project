-- support_logs: log de PRODUTO por tenant (complementa os logs nativos do Supabase).
-- Escrita: apenas service_role (Edge Function log-event) — ignora RLS.
-- Leitura: apenas admin do tenant, e só do próprio tenant.
-- Alinhado ao padrão do rls_lockdown.sql (schema app: current_tenant_id / is_tenant_admin).

create table if not exists public.support_logs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.tenants(id) on delete set null,
  profile_id     uuid references public.profiles(id) on delete set null,
  level          text not null default 'info'
                   check (level in ('debug', 'info', 'warn', 'error')),
  area           text,                 -- rota/módulo de origem (ex.: "render:AppShell", "board.load")
  message        text not null,
  context        jsonb not null default '{}'::jsonb,  -- já redigido (sem PII/segredos)
  correlation_id text,                 -- código do erro exibido ao usuário / usado no chamado
  created_at     timestamptz not null default now()
);

-- Últimos eventos do tenant, por período.
create index if not exists support_logs_tenant_idx
  on public.support_logs (tenant_id, created_at desc);
-- Busca direta pelo código informado no chamado.
create index if not exists support_logs_corr_idx
  on public.support_logs (correlation_id);
-- Filtro por severidade dentro do tenant.
create index if not exists support_logs_tenant_level_idx
  on public.support_logs (tenant_id, level, created_at desc);

alter table public.support_logs enable row level security;
alter table public.support_logs force row level security;

-- Remove a policy genérica por tenant que o rls_lockdown criaria para qualquer
-- tabela com coluna tenant_id (daria leitura a qualquer authenticated do tenant).
-- Aqui a leitura é restrita a admin do tenant.
drop policy if exists support_logs_tenant_scope on public.support_logs;

drop policy if exists support_logs_admin_read on public.support_logs;
create policy support_logs_admin_read on public.support_logs
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_tenant_admin());

-- Sem policies de insert/update/delete para authenticated:
-- somente service_role (que ignora RLS) escreve, via a Edge Function log-event.
revoke all on public.support_logs from anon, authenticated;
grant select on public.support_logs to authenticated;
grant all on public.support_logs to service_role;

-- ─── Retenção (AC7): apaga eventos com mais de 60 dias ──────────────────────
-- Função no schema privado app (não exposta na API). service_role a executa.
create or replace function app.purge_support_logs(retention_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted integer;
begin
  delete from public.support_logs
   where created_at < now() - make_interval(days => greatest(retention_days, 1));
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function app.purge_support_logs(integer) from public, anon, authenticated;
grant execute on function app.purge_support_logs(integer) to service_role;

-- Agendamento diário via pg_cron, se a extensão estiver disponível (no-op caso não).
-- @devops: se pg_cron não estiver instalado, agende a limpeza externamente
-- (cron chamando app.purge_support_logs() com a service_role).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge_support_logs') then
      perform cron.unschedule('purge_support_logs');
    end if;
    perform cron.schedule('purge_support_logs', '30 3 * * *', $cron$select app.purge_support_logs(60)$cron$);
  end if;
end $$;
