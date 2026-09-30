// Controle de ofícios: a situação de cada ofício é calculada a partir da resposta registrada
// e dos pedidos de informação à SRE (não é digitada).

import type { Colecao, Registro } from '../dados/tipos'
import { calcularSemaforo, type Semaforo } from '../fluxo/sla'

export type SituacaoOficio = 'aguardando_analise' | 'aguardando_sre' | 'informacao_recebida' | 'respondido'

export const ROTULO_SITUACAO_OFICIO: Record<SituacaoOficio, string> = {
  aguardando_analise: 'Aguardando análise',
  aguardando_sre: 'Aguardando informação da SRE',
  informacao_recebida: 'Informação recebida',
  respondido: 'Respondido',
}

/** Prazo padrão para a SRE responder ao pedido de informação (dias úteis). */
export const PRAZO_PADRAO_SRE = 5

export function situacaoOficio(oficio: Registro, consultas: Registro[]): SituacaoOficio {
  if (oficio.resposta_data) return 'respondido'
  const doOficio = consultas.filter((c) => c.oficio_id === oficio.id)
  if (doOficio.some((c) => c.status === 'pendente')) return 'aguardando_sre'
  if (doOficio.length) return 'informacao_recebida'
  return 'aguardando_analise'
}

/** Mapeia o órgão remetente do ofício para a origem da demanda de cumprimento. */
export function origemDoOrgao(orgaoTipo: unknown): string {
  if (orgaoTipo === 'judiciario') return 'judicial'
  if (orgaoTipo === 'ministerio_publico') return 'ministerio_publico'
  return 'outro'
}

export interface LinhaOficio {
  oficio: Registro
  processo?: Registro
  situacao: SituacaoOficio
  semaforo: Semaforo
  /** Pedido de informação à SRE ainda sem resposta (o mais recente). */
  consultaPendente?: Registro
  vencido: boolean
}

/** Situação e semáforo (prazo de resposta, em dias úteis) de cada ofício visível. */
export function situacaoDosOficios(lista: (c: Colecao) => Registro[], hoje: string, feriados: ReadonlySet<string>): LinhaOficio[] {
  const consultas = lista('oficio_consultas')
  return lista('oficios').map((oficio) => {
    const situacao = situacaoOficio(oficio, consultas)
    const respondido = situacao === 'respondido'
    return {
      oficio,
      processo: lista('processos').find((p) => p.id === oficio.processo_id),
      situacao,
      semaforo: calcularSemaforo({ prazoEtapa: oficio.prazo_resposta as string, encerrado: respondido }, hoje, feriados),
      consultaPendente: consultas.filter((c) => c.oficio_id === oficio.id && c.status === 'pendente').at(-1),
      vencido: !respondido && String(oficio.prazo_resposta) < hoje,
    }
  })
}
