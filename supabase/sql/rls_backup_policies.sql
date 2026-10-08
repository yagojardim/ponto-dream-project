-- ============================================================================
-- BACKUP do estado ATUAL de segurança do banco (policies, permissões, RLS e
-- views) ANTES de aplicar o lockdown. SÓ LEITURA: não altera nada.
--
-- Rode CADA consulta separadamente (o editor mostra o resultado do último
-- comando). Cada uma devolve UMA célula com SQL pronto: copie o conteúdo da
-- célula e guarde num arquivo (ex.: restaurar-1-policies.sql ... restaurar-4-...).
-- Se algo der errado depois do lockdown, rodar esses 4 arquivos na ordem
-- (1, 2, 3, 4) + o bloco "restaurar-5" abaixo devolve o banco ao estado de hoje.
-- ============================================================================

-- ─── 1) Policies: gera os CREATE POLICY de hoje ──────────────────────────────
select coalesce(string_agg(
  format('create policy %I on %I.%I as %s for %s to %s%s%s;',
         policyname, schemaname, tablename,
         case when permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
         cmd,
         array_to_string(roles, ', '),
         case when qual is not null then ' using (' || qual || ')' else '' end,
         case when with_check is not null then ' with check (' || with_check || ')' else '' end),
  E'\n' order by tablename, policyname), '-- (nenhuma policy)') as restaurar_1_policies
from pg_policies
where schemaname = 'public';

-- ─── 2) Permissões (GRANT) de anon e authenticated em tabelas e views ────────
select coalesce(string_agg(
  format('grant %s on %I.%I to %s;', privilege_type, table_schema, table_name, grantee),
  E'\n' order by table_name, grantee, privilege_type), '-- (nenhuma permissão)') as restaurar_2_grants
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');

-- ─── 3) RLS ligado/forçado por tabela + opção das views ──────────────────────
select string_agg(sql, E'\n' order by ord, sql) as restaurar_3_rls_e_views
from (
  select 1 as ord,
         format('alter table public.%I %s row level security;', c.relname,
                case when c.relrowsecurity then 'enable' else 'disable' end) as sql
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 2,
         format('alter table public.%I %s row level security;', c.relname,
                case when c.relforcerowsecurity then 'force' else 'no force' end)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 3,
         format('alter view public.%I reset (security_invoker);', c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
) t;

-- ─── 4) Permissão de EXECUTAR funções do schema public (anon/authenticated/public) ─
select coalesce(string_agg(
  format('grant execute on function %s to %s;', p.oid::regprocedure,
         case when a.grantee = 0 then 'public' else pg_get_userbyid(a.grantee)::text end),
  E'\n' order by p.proname, a.grantee), '-- (nenhuma permissão de função)') as restaurar_4_funcoes
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where n.nspname = 'public'
  and a.privilege_type = 'EXECUTE'
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon', 'authenticated'));

-- ─── restaurar-5 (texto fixo; copie junto dos outros 4) ──────────────────────
--   grant usage on schema public to anon;
--   alter default privileges in schema public grant execute on functions to anon;
--   notify pgrst, 'reload schema';
