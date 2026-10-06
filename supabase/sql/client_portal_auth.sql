-- Portal do Cliente — Fatia 1: credencial real (Supabase Auth).
-- Vincula cada acesso de portal ao usuário do Supabase Auth que prova o e-mail.
-- Idempotente. O vínculo é gravado pela Edge Function `client-portal-login`
-- (service_role) no primeiro login com e-mail confirmado.
--
-- Aplicar ANTES do deploy das Edge Functions `portal-invite` e `client-portal-login`.

alter table public.client_portal_users
  add column if not exists auth_user_id uuid;

create index if not exists client_portal_users_auth_user_idx
  on public.client_portal_users (auth_user_id)
  where auth_user_id is not null;

comment on column public.client_portal_users.auth_user_id is
  'auth.users.id do cliente. Preenchido no 1º login real (e-mail confirmado). Base das policies de portal (fatia 2).';
