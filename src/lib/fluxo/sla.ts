// Prazo (SLA) das etapas, semáforo e escalonamento.
// Prazos contados em DIAS ÚTEIS (sem sábados, domingos e feriados cadastrados).

import { diasUteisEntre, somarDiasUteis } from '../diasUteis'
import { formatarData } from '../formatacao'

/** Faltando até este nº de dias úteis, o semáforo fica amarelo. */
export const AVISO_DIAS_UTEIS = 3
/** Etapa vencida há mais que este nº de dias úteis escala ao órgão central (nível 3). */
export const ESCALONAR_CENTRAL_APOS = 3

export type CorSemaforo = 'verde' | 'amarelo' | 'vermelho' | 'cinza'

export interface Semaforo {
  cor: CorSemaforo
  /** Prazo que manda no semáforo: o menor entre o judicial e o da etapa atual. */
  prazo: string | null
  origem: 'judicial' | 'etapa' | null
  dias_uteis: number | null
  /** 0 = nada; 1 = responsável; 2 = + Diretor DAFI; 3 = + órgão central. */
  nivel: 0 | 1 | 2 | 3
  texto: string
}

export function prazoDaEtapa(iniciadaEm: string, slaDiasUteis: number | null | undefined, feriados: ReadonlySet<string>): string | null {
  if (slaDiasUteis === null || slaDiasUteis === undefined || slaDiasUteis === 0) return null
  return somarDiasUteis(iniciadaEm, slaDiasUteis, feriados)
}

/** Duração de uma etapa em dias úteis (até hoje, se ainda aberta). */
export function duracaoDiasUteis(iniciadaEm: string, concluidaEm: string | null, hoje: string, feriados: ReadonlySet<string>): number {
  return Math.max(0, diasUteisEntre(iniciadaEm, concluidaEm ?? hoje, feriados))
}

interface EntradaSemaforo {
  prazoJudicial?: string | null
  /** Com o transporte iniciado, o prazo judicial está cumprido e deixa de contar. */
  inicioTransporte?: string | null
  prazoEtapa?: string | null
  encerrado?: boolean
}

function textoDias(dias: number, quem: string) {
  if (dias < 0) return `${quem} vencido há ${-dias} dia(s) útil(eis)`
  if (dias === 0) return `${quem} vence hoje`
  return `${quem} vence em ${dias} dia(s) útil(eis)`
}

export function calcularSemaforo(e: EntradaSemaforo, hoje: string, feriados: ReadonlySet<string>): Semaforo {
  if (e.encerrado) return { cor: 'cinza', prazo: null, origem: null, dias_uteis: null, nivel: 0, texto: 'Encerrado' }

  const judicial = e.prazoJudicial && !e.inicioTransporte ? String(e.prazoJudicial) : null
  const etapa = e.prazoEtapa ? String(e.prazoEtapa) : null
  const diasJudicial = judicial ? diasUteisEntre(hoje, judicial, feriados) : null
  const diasEtapa = etapa ? diasUteisEntre(hoje, etapa, feriados) : null

  let prazo: string | null = null
  let origem: Semaforo['origem'] = null
  if (judicial && (!etapa || judicial <= etapa)) {
    prazo = judicial
    origem = 'judicial'
  } else if (etapa) {
    prazo = etapa
    origem = 'etapa'
  }
  const dias = origem === 'judicial' ? diasJudicial : diasEtapa

  let nivel: Semaforo['nivel'] = 0
  if (diasEtapa !== null) {
    if (diasEtapa < -ESCALONAR_CENTRAL_APOS) nivel = 3
    else if (diasEtapa < 0) nivel = 2
    else if (diasEtapa <= AVISO_DIAS_UTEIS) nivel = 1
  }
  if (diasJudicial !== null && diasJudicial < 0) nivel = 3
  else if (diasJudicial !== null && diasJudicial <= AVISO_DIAS_UTEIS && nivel < 2) nivel = Math.max(nivel, 2) as Semaforo['nivel']

  const cor: CorSemaforo = dias === null ? 'verde' : dias < 0 ? 'vermelho' : dias <= AVISO_DIAS_UTEIS ? 'amarelo' : 'verde'
  const texto =
    dias === null
      ? 'Sem prazo nesta etapa'
      : `${textoDias(dias, origem === 'judicial' ? 'Prazo judicial' : 'Prazo da etapa')} (${formatarData(prazo)})`

  return { cor, prazo, origem, dias_uteis: dias, nivel, texto }
}

export const ROTULO_NIVEL: Record<Semaforo['nivel'], string> = {
  0: '—',
  1: 'Nível 1 · responsável',
  2: 'Nível 2 · + Diretor DAFI',
  3: 'Nível 3 · + órgão central',
}
