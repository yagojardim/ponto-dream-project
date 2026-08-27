/**
 * Altech — "casca única" de card para o board interativo do Início.
 * Quando um widget é renderizado dentro da casca do grid, o SCard mais externo
 * do widget deixa de desenhar a própria moldura/cabeçalho (evita moldura dupla e
 * título duplicado) e apenas informa o seu título para o cabeçalho da casca.
 */
import { createContext, useContext, type ReactNode } from 'react'

export interface CardShellValue {
  /** true = o próximo SCard deve renderizar sem moldura e sem cabeçalho. */
  bare: boolean
  /** Informa o título nativo do card ao cabeçalho da casca. */
  registerTitle?: (title: string) => void
}

const CardShellContext = createContext<CardShellValue>({ bare: false })

export function CardShellProvider({ value, children }: { value: CardShellValue; children: ReactNode }) {
  return <CardShellContext.Provider value={value}>{children}</CardShellContext.Provider>
}

export function useCardShell(): CardShellValue {
  return useContext(CardShellContext)
}
