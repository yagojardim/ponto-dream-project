-- ─────────────────────────────────────────────────────────────────────────────
-- Personas fictícias de VALIDAÇÃO de papéis (tenant Rautaki)
-- Objetivo: ter 1 usuário ativo por papel para validar cada dashboard do Início.
-- Todas marcadas com metadata->>'seed' = 'role-validation'.
--
-- Papéis já cobertos por usuários reais: Dev, ProductOwner, ScrumMaster, TechLead.
-- Criados aqui: Admin, PMO, ProjectManager, ProductManager, QA, UX.
--
-- profiles.id NÃO referencia auth.users (o vínculo de auth é profiles.auth_user_id),
-- portanto os perfis são criados com gen_random_uuid() e sem usuário de auth.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.profiles
  (id, tenant_id, name, email, primary_role, status,
   avatar_initials, avatar_color, can_create_projects, can_handle_client_messages, metadata)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Diana Costa',  'diana.admin@validacao.suaempresa.com',  'admin',           'active', 'DC', '#6366F1', true,  true,  '{"seed":"role-validation"}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Helena Prado', 'helena.pmo@validacao.suaempresa.com',   'pmo',             'active', 'HP', '#0EA5E9', true,  true,  '{"seed":"role-validation"}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Rafael Nunes', 'rafael.pm@validacao.suaempresa.com',    'project_manager', 'active', 'RN', '#22C55E', true,  true,  '{"seed":"role-validation"}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Camila Rocha', 'camila.pdm@validacao.suaempresa.com',   'product_manager', 'active', 'CR', '#EC4899', true,  false, '{"seed":"role-validation"}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Tiago Ferraz', 'tiago.qa@validacao.suaempresa.com',     'qa',              'active', 'TF', '#F59E0B', false, false, '{"seed":"role-validation"}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Sofia Lima',   'sofia.ux@validacao.suaempresa.com',     'ux',              'active', 'SL', '#A855F7', false, false, '{"seed":"role-validation"}'::jsonb)
on conflict do nothing;

-- Vínculo oficial em user_roles (roles.key; 'admin' resolve para 'admin_master').
insert into public.user_roles (tenant_id, profile_id, role_id, is_primary)
select p.tenant_id, p.id, r.id, true
from public.profiles p
join public.roles r
  on r.key = case when p.primary_role = 'admin' then 'admin_master' else p.primary_role end
where p.tenant_id = '00000000-0000-0000-0000-000000000001'
  and p.metadata->>'seed' = 'role-validation'
  and not exists (
    select 1 from public.user_roles ur
    where ur.profile_id = p.id and ur.role_id = r.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- COMO REMOVER ANTES DA VIRADA DE PRODUÇÃO
--
-- Opção A — inativar (mantém histórico):
--   update public.profiles set status = 'inactive'
--    where metadata->>'seed' = 'role-validation';
--
-- Opção B — remover de vez (arquivar, some do seletor de Inspection):
--   update public.profiles set archived_at = now()
--    where metadata->>'seed' = 'role-validation';
--
-- Opção C — apagar fisicamente (só se não houver itens atribuídos a elas):
--   delete from public.user_roles
--    where profile_id in (select id from public.profiles where metadata->>'seed' = 'role-validation');
--   delete from public.profiles where metadata->>'seed' = 'role-validation';
-- ─────────────────────────────────────────────────────────────────────────────
