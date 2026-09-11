-- feedback.correlation_id: liga o chamado (aba "Reportar problema / suporte")
-- ao log de produto (support_logs.correlation_id). O usuário cola o "Código do erro"
-- exibido na tela; assim o atendimento acha o evento exato.
-- RLS/grants já vêm da tabela feedback (rls_lockdown, escopo por tenant): adicionar
-- coluna é transparente, não requer mudança de policy.

alter table public.feedback add column if not exists correlation_id text;

-- Busca do chamado pelo código informado.
create index if not exists feedback_corr_idx on public.feedback (correlation_id);
