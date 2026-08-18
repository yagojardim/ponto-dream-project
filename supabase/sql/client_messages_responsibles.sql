-- Feature "Responsável por Mensagens do Cliente" (Wave 1).
-- Espelha o padrão de profiles.can_create_projects + tabela de vínculo por projeto.

alter table public.profiles
  add column if not exists can_handle_client_messages boolean not null default false;

comment on column public.profiles.can_handle_client_messages is
  'Pode ser responsável pelas tratativas de mensagens do cliente.';

create table if not exists public.project_client_responsibles (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  project_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id, profile_id)
);

create index if not exists idx_pcr_tenant_project
  on public.project_client_responsibles (tenant_id, project_id);
create index if not exists idx_pcr_tenant_profile
  on public.project_client_responsibles (tenant_id, profile_id);

grant select, insert, update, delete on public.project_client_responsibles to authenticated;
grant all on public.project_client_responsibles to service_role;

alter table public.project_client_responsibles enable row level security;

drop policy if exists pcr_tenant_read on public.project_client_responsibles;
create policy pcr_tenant_read on public.project_client_responsibles
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists pcr_tenant_write on public.project_client_responsibles;
create policy pcr_tenant_write on public.project_client_responsibles
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

notify pgrst, 'reload schema';
