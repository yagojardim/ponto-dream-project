-- Layout livre do Dash View por projeto (Fatia 6d): o gestor escolhe quais
-- widgets o cliente vê e onde, igual ao board de widgets da tela de Início.
-- Null = layout padrão (todos os widgets, ordem atual) — nenhum dash precisa
-- de migração de dados para continuar funcionando como hoje.
alter table public.projects
  add column if not exists client_dashboard_layout jsonb;

comment on column public.projects.client_dashboard_layout is
  'Layout customizado do Dash View deste projeto: array de {i,x,y,w,h} (ids do catálogo client-safe). Null = layout padrão com todos os widgets.';
