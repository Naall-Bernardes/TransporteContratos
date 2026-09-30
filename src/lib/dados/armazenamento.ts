// Armazenamento do modo demonstração: tudo fica no localStorage deste navegador.
// Não há servidor — cada computador/navegador tem sua própria cópia dos dados.

import { criarBaseDemonstracao } from './seed'
import type { Base } from './tipos'

const CHAVE = 'transporte-escolar:demo'
// Ao mudar a estrutura dos dados, aumente a versão: o navegador recarrega a demonstração.
const VERSAO = 4

let cache: Base | null = null

export function carregarBase(): Base {
  if (cache) return cache
  try {
    const texto = localStorage.getItem(CHAVE)
    if (texto) {
      const salvo = JSON.parse(texto) as Base
      if (salvo.versao === VERSAO) {
        cache = salvo
        return salvo
      }
    }
  } catch {
    // localStorage indisponível ou corrompido: recomeça com os dados de demonstração.
  }
  return restaurarDemonstracao()
}

export function gravarBase(base: Base) {
  cache = base
  try {
    localStorage.setItem(CHAVE, JSON.stringify(base))
  } catch {
    // Sem localStorage (ex.: janela anônima restrita) os dados valem só até recarregar a página.
  }
}

export function restaurarDemonstracao(): Base {
  const base = criarBaseDemonstracao(VERSAO)
  gravarBase(base)
  return base
}
