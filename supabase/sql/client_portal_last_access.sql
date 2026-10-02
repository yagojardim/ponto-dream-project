-- Rastreia o último acesso real do cliente ao portal (client_portal_users),
-- usado pela Gestão do Dash View para identificar dashes inativos (sem
-- acesso há 30+ dias). Gravado pelo próprio front (ClientPortalPage) a cada
-- visita real do cliente — nunca durante o preview da gestão.
alter table public.client_portal_users
  add column if not exists last_access_at timestamptz;

comment on column public.client_portal_users.last_access_at is
  'Último acesso real do cliente a este dash. Null = nunca acessou. Usado para o KPI "Dashes inativos" (30+ dias sem acesso).';
