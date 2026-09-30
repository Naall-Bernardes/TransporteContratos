// Cálculos da gestão contratual. Tudo é DERIVADO dos registros (instrumento + aditivos
// + parcelas): vigência atual, valor atual, saldo e % executado nunca são digitados.
// Ao conectar o banco, estas funções viram a view `vw_instrumento_situacao`.

import type { Registro } from '../dados/tipos'

export type FaixaVigencia = 'encerrado' | 'nao_iniciado' | 'vigente' | 'ate_90' | 'ate_60' | 'ate_30' | 'vencido'

export interface SituacaoInstrumento {
  vigencia_fim_atual: string
  valor_original: number
  valor_atual: number
  valor_executado: number
  saldo: number
  pct_executado: number
  dias_para_vencer: number
  faixa: FaixaVigencia
  /** Acréscimos acumulados sobre o valor original (%). Referência legal usual: até 25%. */
  pct_acrescimos: number
  pct_supressoes: number
  qtd_aditivos: number
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v))

/** Dias corridos de `de` até `ate` (datas ISO). Negativo quando `ate` já passou. */
export function diasCorridos(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number)
  const [a2, m2, d2] = ate.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000)
}

/** Aditivos em ordem cronológica (data de assinatura, depois número). */
export function ordenarAditivos(aditivos: Registro[]): Registro[] {
  return [...aditivos].sort(
    (a, b) => String(a.data_assinatura).localeCompare(String(b.data_assinatura)) || num(a.numero) - num(b.numero),
  )
}

/** Fim de vigência antes de um determinado aditivo (para saber se ele foi assinado com o contrato ainda vigente). */
export function vigenciaAntesDoAditivo(instrumento: Registro, aditivos: Registro[], aditivoId: string): string {
  let fim = String(instrumento.vigencia_fim)
  for (const a of ordenarAditivos(aditivos)) {
    if (a.id === aditivoId) break
    if (a.altera_prazo && a.nova_vigencia_fim) fim = String(a.nova_vigencia_fim)
  }
  return fim
}

export function faixaVigencia(dias: number, inicio: string, hoje: string, encerrado: boolean): FaixaVigencia {
  if (encerrado) return 'encerrado'
  if (dias < 0) return 'vencido'
  if (hoje < inicio) return 'nao_iniciado'
  if (dias <= 30) return 'ate_30'
  if (dias <= 60) return 'ate_60'
  if (dias <= 90) return 'ate_90'
  return 'vigente'
}

export function calcularSituacao(
  instrumento: Registro,
  aditivos: Registro[],
  parcelas: Registro[],
  hoje: string,
): SituacaoInstrumento {
  const ordenados = ordenarAditivos(aditivos)
  let fim = String(instrumento.vigencia_fim)
  let acrescimos = 0
  let supressoes = 0
  for (const a of ordenados) {
    if (a.altera_prazo && a.nova_vigencia_fim) fim = String(a.nova_vigencia_fim)
    if (a.altera_valor) {
      const v = num(a.valor_variacao)
      if (v > 0) acrescimos += v
      else supressoes += -v
    }
  }
  const original = num(instrumento.valor_global)
  const atual = original + acrescimos - supressoes
  // Executado informado manualmente no instrumento (contratos da Caixa Escolar); senão, soma dos pagamentos registrados
  const manual = instrumento.valor_executado
  const executado = manual !== null && manual !== undefined && manual !== '' ? num(manual) : parcelas.reduce((s, p) => s + num(p.valor_pago), 0)
  const dias = diasCorridos(hoje, fim)
  const encerrado = instrumento.status === 'encerrado' || instrumento.status === 'rescindido'

  return {
    vigencia_fim_atual: fim,
    valor_original: original,
    valor_atual: atual,
    valor_executado: executado,
    saldo: atual - executado,
    pct_executado: atual > 0 ? (executado / atual) * 100 : 0,
    dias_para_vencer: dias,
    faixa: faixaVigencia(dias, String(instrumento.vigencia_inicio), hoje, encerrado),
    pct_acrescimos: original > 0 ? (acrescimos / original) * 100 : 0,
    pct_supressoes: original > 0 ? (supressoes / original) * 100 : 0,
    qtd_aditivos: aditivos.length,
  }
}

// ---------- Prestação de contas ----------

export type SituacaoPrazoPrestacao = 'entregue' | 'no_prazo' | 'a_vencer' | 'vencida'

/** Dias antes do prazo em que a prestação passa a "a vencer". */
export const AVISO_PRESTACAO_DIAS = 15

export function situacaoPrazoPrestacao(p: Registro, hoje: string): SituacaoPrazoPrestacao {
  if (p.data_entrega) return 'entregue'
  const dias = diasCorridos(hoje, String(p.data_limite))
  if (dias < 0) return 'vencida'
  if (dias <= AVISO_PRESTACAO_DIAS) return 'a_vencer'
  return 'no_prazo'
}

export const ESTADOS_FINAIS_PRESTACAO = ['aprovada', 'aprovada_ressalvas', 'reprovada']

/**
 * Transições permitidas da prestação de contas (ciclo ÚNICO de diligência):
 * pendente → em_analise → (em_diligencia → reapresentada →) aprovada | aprovada_ressalvas | reprovada
 */
export const TRANSICOES_PRESTACAO: Record<string, string[]> = {
  pendente: ['em_analise'],
  em_analise: ['em_diligencia', ...ESTADOS_FINAIS_PRESTACAO],
  em_diligencia: ['reapresentada'],
  reapresentada: ESTADOS_FINAIS_PRESTACAO,
  aprovada: [],
  aprovada_ressalvas: [],
  reprovada: [],
}

// ---------- Linha do tempo ----------

export interface EventoLinhaTempo {
  data: string
  categoria: 'instrumento' | 'aditivo' | 'financeiro' | 'fiscalizacao' | 'ocorrencia' | 'prestacao' | 'encerramento'
  titulo: string
  detalhe?: string
}

interface DadosInstrumento {
  instrumento: Registro
  aditivos: Registro[]
  parcelas: Registro[]
  fiscalizacoes: Registro[]
  ocorrencias: Registro[]
  prestacoes: Registro[]
}

const brl = (v: unknown) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Todos os eventos do instrumento em ordem cronológica. */
export function montarLinhaDoTempo(d: DadosInstrumento): EventoLinhaTempo[] {
  const e: EventoLinhaTempo[] = []
  const add = (data: unknown, ev: Omit<EventoLinhaTempo, 'data'>) => {
    if (data) e.push({ data: String(data), ...ev })
  }
  const i = d.instrumento

  add(i.data_assinatura, { categoria: 'instrumento', titulo: 'Assinatura do instrumento', detalhe: `Valor global ${brl(i.valor_global)}` })
  add(i.vigencia_inicio, { categoria: 'instrumento', titulo: 'Início da vigência' })

  for (const a of d.aditivos) {
    const partes = [
      a.altera_prazo && `prazo até ${String(a.nova_vigencia_fim).split('-').reverse().join('/')}`,
      a.altera_valor && `valor ${num(a.valor_variacao) >= 0 ? '+' : ''}${brl(a.valor_variacao)}`,
      a.altera_rota_veiculo && 'alteração de rota/veículo',
    ].filter(Boolean)
    add(a.data_assinatura, { categoria: 'aditivo', titulo: `${a.numero}º Termo Aditivo`, detalhe: partes.join(' · ') })
  }

  for (const p of d.parcelas) {
    add(p.data_pagamento, {
      categoria: 'financeiro',
      titulo: `${i.tipo === 'termo_pte' ? 'Repasse' : 'Pagamento'} da parcela ${p.numero}`,
      detalhe: brl(p.valor_pago),
    })
  }

  for (const f of d.fiscalizacoes) {
    add(f.data_registro ?? `${f.competencia}-01`, {
      categoria: 'fiscalizacao',
      titulo: `Fiscalização – competência ${String(f.competencia).split('-').reverse().join('/')}`,
      detalhe: `${num(f.dias_rodados)} dias rodados · ${num(f.alunos_transportados)} alunos · ${num(f.km_rodados)} km`,
    })
  }

  for (const o of d.ocorrencias) {
    add(o.data, { categoria: 'ocorrencia', titulo: `Ocorrência: ${o.titulo}`, detalhe: String(o.descricao ?? '') })
    add(o.notificacao_data, { categoria: 'ocorrencia', titulo: 'Notificação ao contratado', detalhe: String(o.titulo) })
    add(o.notificacao_respondida_em, { categoria: 'ocorrencia', titulo: 'Resposta do contratado à notificação' })
  }

  for (const p of d.prestacoes) {
    const ref = `Prestação de contas ${p.periodo_referencia}`
    add(p.data_entrega, { categoria: 'prestacao', titulo: `${ref}: entregue` })
    add(p.diligencia_data, { categoria: 'prestacao', titulo: `${ref}: diligência`, detalhe: String(p.diligencia_descricao ?? '') })
    add(p.reapresentada_em, { categoria: 'prestacao', titulo: `${ref}: reapresentada` })
    add(p.data_decisao, { categoria: 'prestacao', titulo: `${ref}: ${String(p.status).replace('_', ' com ')}` })
  }

  add(i.encerrado_em, { categoria: 'encerramento', titulo: 'Encerramento do instrumento', detalhe: String(i.pendencias_encerramento ?? '') })

  return e.sort((a, b) => a.data.localeCompare(b.data))
}
