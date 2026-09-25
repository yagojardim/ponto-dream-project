// Foco pré-selecionado da tela "Minha Fila" (my-tasks), consumido UMA vez ao abrir.
// Usado pelos KPIs do Dev na Início: clicar em "Meus atrasados"/"Meus bloqueados"
// abre a Minha Fila já focada naquele recorte.

export type MyTasksFocus = 'active' | 'late' | 'blocked'

let PENDING: MyTasksFocus | null = null

export function setMyTasksFocus(focus: MyTasksFocus): void {
  PENDING = focus
}

/** Retorna o foco pendente e o limpa (consumo único). */
export function takeMyTasksFocus(): MyTasksFocus | null {
  const f = PENDING
  PENDING = null
  return f
}
