// Pré-filtro para a tela Lista, consumido UMA vez ao abrir.
// Usado por atalhos como o KPI "Entregues" da Início, que abre a Lista já
// filtrada pelo projeto do escopo + status (ex.: Concluído).

export interface ListPrefilter {
  /** Id de um único projeto (quando o escopo tem exatamente 1). */
  projectId?: string
  /** Status da UI (ex.: 'done'). */
  status?: string
}

let PENDING: ListPrefilter | null = null

export function setListPrefilter(pf: ListPrefilter): void {
  PENDING = pf
}

/** Retorna o pré-filtro pendente e o limpa (consumo único). */
export function takeListPrefilter(): ListPrefilter | null {
  const pf = PENDING
  PENDING = null
  return pf
}
