// Escolha do transporte: a regional apoia o diretor e registra as cotações (mínimo 3).
// A escolhida define quem será contratado; o valor a liberar na Autorização é a MÉDIA das cotações.

import type { Registro } from '../dados/tipos'

export const MINIMO_COTACOES = 3

export interface ResumoCotacoes {
  qtd: number
  menor?: Registro
  escolhida?: Registro
  /** A escolhida não é a de menor valor total (exige justificativa). */
  escolhidaNaoEhMenor: boolean
  mediaMensal: number
  mediaTotal: number
  /** Meses usados no cálculo (quando todas as cotações têm o mesmo prazo). */
  meses?: number
}

const total = (c: Registro) => Number(c.valor_total ?? Number(c.valor_mensal) * Number(c.meses))
const arred = (v: number) => Math.round(v * 100) / 100

export function resumoCotacoes(cotacoes: Registro[]): ResumoCotacoes {
  const qtd = cotacoes.length
  const menor = qtd ? cotacoes.reduce((m, c) => (total(c) < total(m) ? c : m)) : undefined
  const escolhida = cotacoes.find((c) => c.escolhida)
  const meses = new Set(cotacoes.map((c) => Number(c.meses)))
  return {
    qtd,
    menor,
    escolhida,
    escolhidaNaoEhMenor: Boolean(escolhida && menor && total(escolhida) > total(menor)),
    mediaMensal: qtd ? arred(cotacoes.reduce((s, c) => s + Number(c.valor_mensal), 0) / qtd) : 0,
    mediaTotal: qtd ? arred(cotacoes.reduce((s, c) => s + total(c), 0) / qtd) : 0,
    meses: meses.size === 1 ? [...meses][0] : undefined,
  }
}
