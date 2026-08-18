-- Permissão por usuário "pode criar projeto" (espelho de profiles.reports_access).
-- Quem tem a marca cria projetos, épicos e funcionalidades e pode ser Responsável
-- de projeto. Quem não tem só cria história, subtarefa e bug.
alter table public.profiles
  add column if not exists can_create_projects boolean not null default false;

comment on column public.profiles.can_create_projects is
  'Permite criar projetos, épicos e funcionalidades e ser Responsável de projeto.';

-- Backfill: não quebrar leads atuais, Admin Master, admins e PMO.
update public.profiles set can_create_projects = true
where tenant_id = '00000000-0000-0000-0000-000000000001'
  and (
    tenant_owner = true
    or primary_role in ('admin', 'pmo')
    or id in (
      select lead_id from public.projects
      where tenant_id = '00000000-0000-0000-0000-000000000001'
        and archived_at is null
        and lead_id is not null
    )
  );

notify pgrst, 'reload schema';
