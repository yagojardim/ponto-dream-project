// Humaniza registros de `audit_logs` para a "Atividade Recente" da Início.
// Traduz (action, entity_type) reais em frase pt-BR + ícone/cor por tipo de entidade.
// Nada aqui inventa dados: só mapeia os valores que já são gravados na tabela.
import { T } from '@/components/ds/tokens'

export interface ActivityView {
  /** Frase curta da ação, ex.: "Anexou um arquivo". */
  label: string
  /** Chip da entidade, ex.: "📋 Demanda". */
  sub: string
  /** Cor do ponto da timeline (derivada da entidade). */
  color: string
  /** Rótulo curto do tipo de entidade (usado no filtro por tipo). */
  entityLabel: string
}

interface EntityMeta { label: string; icon: string; color: string }

const ENTITY: Record<string, EntityMeta> = {
  work_item:               { label: 'Demanda',            icon: '📋', color: T.accent },
  project:                 { label: 'Projeto',            icon: '📁', color: T.indigo },
  sprint:                  { label: 'Sprint',             icon: '🏃', color: T.purple },
  release:                 { label: 'Release',            icon: '🚀', color: T.success },
  attachment:              { label: 'Anexo',              icon: '📎', color: T.text2 },
  profile:                 { label: 'Membro',             icon: '👤', color: T.warn },
  module:                  { label: 'Módulo',             icon: '🧩', color: T.purple },
  storage:                 { label: 'Armazenamento',      icon: '💾', color: T.accent },
  client_signal:           { label: 'Mensagem do cliente', icon: '💬', color: T.success },
  client_messages_project: { label: 'Conversa do cliente', icon: '💬', color: T.success },
  notification:            { label: 'Notificação',        icon: '🔔', color: T.warn },
  tenant:                  { label: 'Conta',              icon: '🏢', color: T.text2 },
  admin_master:            { label: 'Admin Master',       icon: '🛡️', color: T.crit },
  auth:                    { label: 'Acesso',             icon: '🔑', color: T.text2 },
  activation_token:        { label: 'Ativação',           icon: '✅', color: T.success },
  dashboard_assignment:    { label: 'Painel',             icon: '🗂️', color: T.indigo },
}

// Frases pt-BR para os `action` reais gravados em audit_logs.
const ACTION: Record<string, string> = {
  'work_item.dates_updated':    'Atualizou as datas',
  'profile.invited':            'Convidou um membro',
  'attachment_added':           'Anexou um arquivo',
  'attachment_deleted':         'Removeu um anexo',
  'login_success':              'Entrou na conta',
  'password_reset_completed':   'Redefiniu a senha',
  'approved':                   'Aprovou',
  'rejected':                   'Recusou',
  'submitted':                  'Enviou para análise',
  'request':                    'Solicitou ativação',
  'trial':                      'Iniciou um teste',
  'preview':                    'Pré-visualizou',
  'details':                    'Abriu detalhes',
  'open':                       'Abriu',
  'reason':                     'Registrou um motivo',
  'deactivate':                 'Desativou',
  'none':                       'Interagiu',
  'admin_master_defined':       'Assumiu como Admin Master',
  'admin_master_invited':       'Indicou um Admin Master',
  'admin_master_auto_elected':  'Foi eleito Admin Master',
  'admin_master_reminder_sent': 'Enviou lembrete de Admin Master',
}

function titleize(value: string): string {
  return value.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function entityMeta(entityType: string): EntityMeta {
  return ENTITY[entityType] ?? { label: titleize(entityType), icon: '•', color: T.text2 }
}

/** Rótulo curto do tipo de entidade — usado nos chips de filtro da Atividade. */
export function activityEntityLabel(entityType: string): string {
  return entityMeta(entityType).label
}

export function humanizeActivity(row: { action: string; entityType: string }): ActivityView {
  const ent = entityMeta(row.entityType)
  const phrase = ACTION[row.action] ?? titleize(row.action)
  return { label: phrase, sub: `${ent.icon} ${ent.label}`, color: ent.color, entityLabel: ent.label }
}
