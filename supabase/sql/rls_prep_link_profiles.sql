-- ============================================================================
-- Fatia 3 / Fase 2a — PREPARAÇÃO do lockdown (aditivo e seguro; pode rodar já).
--
-- Problema: com o RLS ligado, ler o próprio profile exige já estar vinculado ao
-- Auth (profiles.auth_user_id). Hoje o app acha o profile por e-mail e vincula
-- pelo navegador — o que o RLS passa a impedir. Esta preparação:
--   1) cria link_my_profile(): o BANCO vincula o profile ao usuário logado, só
--      pelo e-mail CONFIRMADO e só se houver exatamente 1 profile livre com ele;
--   2) vincula agora (backfill) os profiles que já têm usuário no Auth.
--
-- Idempotente. Não altera policies nem permissões de tabelas.
-- ============================================================================

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

-- ─── 1. link_my_profile ──────────────────────────────────────────────────────
create or replace function app.link_my_profile()
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_profile   uuid;
begin
  if v_uid is null then
    return null;
  end if;

  -- já vinculado: devolve o profile e pronto
  select p.id into v_profile from public.profiles p where p.auth_user_id = v_uid limit 1;
  if v_profile is not null then
    return v_profile;
  end if;

  select lower(btrim(u.email)), u.email_confirmed_at
    into v_email, v_confirmed
    from auth.users u
   where u.id = v_uid;

  -- só vincula por e-mail CONFIRMADO (quem se cadastra com o e-mail de outra
  -- pessoa, sem confirmar, não herda o profile dela)
  if v_email is null or v_confirmed is null then
    return null;
  end if;

  -- exatamente 1 profile ativo com esse e-mail, ainda sem vínculo
  select p.id into v_profile
    from public.profiles p
   where lower(btrim(p.email)) = v_email
     and p.auth_user_id is null
     and p.archived_at is null
     and (select count(*)
            from public.profiles q
           where lower(btrim(q.email)) = v_email and q.archived_at is null) = 1;

  if v_profile is null then
    return null;
  end if;

  update public.profiles
     set auth_user_id = v_uid
   where id = v_profile and auth_user_id is null;

  return v_profile;
end;
$$;

revoke all on function app.link_my_profile() from public, anon;
grant execute on function app.link_my_profile() to authenticated, service_role;

create or replace function public.link_my_profile()
returns uuid
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app.link_my_profile()
$$;

revoke all on function public.link_my_profile() from public, anon;
grant execute on function public.link_my_profile() to authenticated, service_role;

-- ─── 2. Backfill: vincula agora quem já tem usuário no Auth ──────────────────
-- Mesmas regras da função: e-mail confirmado, 1 único profile com o e-mail, e o
-- usuário do Auth ainda não está vinculado a outro profile.
update public.profiles p
   set auth_user_id = au.id
  from auth.users au
 where p.auth_user_id is null
   and p.archived_at is null
   and au.email_confirmed_at is not null
   and lower(btrim(au.email)) = lower(btrim(p.email))
   and not exists (select 1 from public.profiles x where x.auth_user_id = au.id)
   and (select count(*)
          from public.profiles q
         where lower(btrim(q.email)) = lower(btrim(p.email)) and q.archived_at is null) = 1;

notify pgrst, 'reload schema';
