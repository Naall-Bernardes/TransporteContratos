// Monitoramento geral: situação de cada processo (etapa atual + semáforo), alertas por
// e-mail com escalonamento e gatilhos automáticos de risco. Tudo derivado dos dados.
// Em produção roda diariamente no banco (pg_cron) e envia e-mails por uma Edge Function.

import { alertasInstrumento } from './contratos/alertas'
import { calcularSituacao, situacaoPrazoPrestacao, type SituacaoInstrumento } from './contratos/calculos'
import type { Colecao, Registro } from './dados/tipos'
import { formatarData, formatarMoeda } from './formatacao'
import { etapaAtual, montarDadosProcesso } from './fluxo/processo'
import { calcularSemaforo, type Semaforo } from './fluxo/sla'

type Lista = (c: Colecao) => Registro[]

export interface SituacaoProcesso {
  processo: Registro
  demanda?: Registro
  adesao?: Registro
  instancia?: Registro
  modelo?: Registro
  semaforo: Semaforo
  sre_id: string | null
}

export function situacaoDosProcessos(lista: Lista, hoje: string, feriados: ReadonlySet<string>): SituacaoProcesso[] {
  const modelos = lista('etapas_modelo')
  return lista('processos')
    .map((processo) => {
      const d = montarDadosProcesso(lista, processo.id)
      if (!d.demanda && !d.adesao) return null
      const { instancia, modelo } = etapaAtual(d, modelos)
      const encerrado = d.demanda ? d.demanda.situacao !== 'ativa' : d.adesao?.status === 'encerrado'
      const semaforo = calcularSemaforo(
        {
          prazoJudicial: d.demanda?.prazo_judicial as string | undefined,
          inicioTransporte: d.demanda?.data_inicio_transporte as string | undefined,
          prazoEtapa: instancia?.prazo_sla as string | undefined,
          encerrado,
        },
        hoje,
        feriados,
      )
      return { processo, demanda: d.demanda, adesao: d.adesao, instancia, modelo, semaforo, sre_id: (processo.sre_id as string) ?? null }
    })
    .filter(Boolean) as SituacaoProcesso[]
}

export function situacaoDosInstrumentos(lista: Lista, hoje: string): { instrumento: Registro; situacao: SituacaoInstrumento }[] {
  return lista('instrumentos').map((instrumento) => ({
    instrumento,
    situacao: calcularSituacao(
      instrumento,
      lista('aditivos').filter((a) => a.instrumento_id === instrumento.id),
      lista('parcelas').filter((p) => p.instrumento_id === instrumento.id),
      hoje,
    ),
  }))
}

// ---------- Alertas por e-mail ----------

export interface AlertaGerado {
  chave: string
  tipo: 'sla_etapa' | 'prazo_judicial' | 'vigencia' | 'prestacao_contas'
  nivel: number
  titulo: string
  mensagem: string
  processo_id: string | null
  instrumento_id: string | null
  sre_id: string | null
  destinatario_ids: string[]
}

function destinatarios(lista: Lista, sreId: string | null, nivel: number, base: unknown[]): string[] {
  const ids = new Set(base.filter(Boolean).map(String))
  const usuarios = lista('usuarios').filter((u) => u.ativo)
  if (nivel >= 2) usuarios.filter((u) => u.papel === 'diretor_sre' && u.sre_id === sreId).forEach((u) => ids.add(u.id))
  if (nivel >= 3) usuarios.filter((u) => u.papel === 'analista_central').forEach((u) => ids.add(u.id))
  if (ids.size === 0) usuarios.filter((u) => u.papel === 'analista_central').forEach((u) => ids.add(u.id))
  return [...ids]
}

export function gerarAlertas(lista: Lista, hoje: string, feriados: ReadonlySet<string>): AlertaGerado[] {
  const alertas: AlertaGerado[] = []
  const codigoDe = (id: unknown) => String(lista('processos').find((p) => p.id === id)?.codigo ?? '')

  for (const s of situacaoDosProcessos(lista, hoje, feriados)) {
    if (!s.instancia || s.semaforo.cor === 'cinza') continue
    const codigo = String(s.processo.codigo)
    if (s.semaforo.nivel > 0) {
      const etapa = `${s.modelo?.ordem}. ${s.modelo?.nome}`
      alertas.push({
        chave: `sla|${s.instancia.id}|n${s.semaforo.nivel}`,
        tipo: 'sla_etapa',
        nivel: s.semaforo.nivel,
        titulo: `[${codigo}] Etapa "${s.modelo?.nome}" — ${s.semaforo.nivel >= 2 ? 'prazo vencido' : 'prazo próximo'}`,
        mensagem: `Processo ${codigo} (SEI ${s.processo.numero_sei ?? '-'}).\nEtapa atual: ${etapa}.\n${s.semaforo.texto}.\nNível de escalonamento: ${s.semaforo.nivel}.`,
        processo_id: s.processo.id,
        instrumento_id: null,
        sre_id: s.sre_id,
        destinatario_ids: destinatarios(lista, s.sre_id, s.semaforo.nivel, [s.instancia.responsavel_id, s.demanda?.responsavel_sre_id]),
      })
    }
    const pj = s.demanda?.prazo_judicial as string | undefined
    if (pj && !s.demanda?.data_inicio_transporte && s.semaforo.origem === 'judicial' && s.semaforo.cor !== 'verde') {
      const vencido = s.semaforo.cor === 'vermelho'
      alertas.push({
        chave: `judicial|${s.demanda!.id}|${vencido ? 'vencido' : 'a_vencer'}`,
        tipo: 'prazo_judicial',
        nivel: vencido ? 3 : 2,
        titulo: `[${codigo}] PRAZO JUDICIAL ${vencido ? 'VENCIDO' : 'a vencer'} em ${formatarData(pj)}`,
        mensagem: `Demanda ${codigo} — processo ${s.demanda!.numero_processo_origem} (${s.demanda!.comarca}).\nPrazo de cumprimento: ${formatarData(pj)}.\nO transporte ainda não foi iniciado.`,
        processo_id: s.processo.id,
        instrumento_id: null,
        sre_id: s.sre_id,
        destinatario_ids: destinatarios(lista, s.sre_id, vencido ? 3 : 2, [s.demanda!.responsavel_sre_id]),
      })
    }
  }

  for (const { instrumento: i, situacao } of situacaoDosInstrumentos(lista, hoje)) {
    const f = situacao.faixa
    const codigo = codigoDe(i.processo_id)
    if (['ate_90', 'ate_60', 'ate_30', 'vencido'].includes(f)) {
      const vencido = f === 'vencido'
      alertas.push({
        chave: `vigencia|${i.id}|${f}|${situacao.vigencia_fim_atual}`,
        tipo: 'vigencia',
        nivel: vencido ? 3 : f === 'ate_30' ? 2 : 1,
        titulo: `[${codigo}] ${i.tipo === 'termo_pte' ? 'Termo' : 'Contrato'} ${i.numero} ${vencido ? 'VENCIDO' : `vence em ${situacao.dias_para_vencer} dias`}`,
        mensagem: `Instrumento ${i.numero} (SEI ${i.numero_sei}).\nFim da vigência: ${formatarData(situacao.vigencia_fim_atual)}.\nSaldo: ${formatarMoeda(situacao.saldo)}.\n${vencido ? 'Verifique se o transporte continua sem cobertura contratual.' : 'Avalie a necessidade de aditivo de prazo.'}`,
        processo_id: (i.processo_id as string) ?? null,
        instrumento_id: i.id,
        sre_id: (i.sre_id as string) ?? null,
        destinatario_ids: destinatarios(lista, i.sre_id as string, vencido ? 3 : f === 'ate_30' ? 2 : 1, [i.gestor_id, i.fiscal_id]),
      })
    }
    for (const p of lista('prestacoes_contas').filter((x) => x.instrumento_id === i.id)) {
      const sit = situacaoPrazoPrestacao(p, hoje)
      if (sit !== 'a_vencer' && sit !== 'vencida') continue
      alertas.push({
        chave: `prestacao|${p.id}|${sit}`,
        tipo: 'prestacao_contas',
        nivel: sit === 'vencida' ? 2 : 1,
        titulo: `[${codigo}] Prestação de contas ${sit === 'vencida' ? 'ATRASADA' : 'a vencer'} — ${p.periodo_referencia}`,
        mensagem: `Instrumento ${i.numero}. Período: ${p.periodo_referencia}.\nPrazo de entrega: ${formatarData(p.data_limite)}.`,
        processo_id: (i.processo_id as string) ?? null,
        instrumento_id: i.id,
        sre_id: (i.sre_id as string) ?? null,
        destinatario_ids: destinatarios(lista, i.sre_id as string, sit === 'vencida' ? 2 : 1, [i.gestor_id, i.fiscal_id]),
      })
    }
  }
  return alertas
}

// ---------- Gatilhos automáticos de risco ----------

export interface OcorrenciaRiscoGerada {
  gatilho: string
  chave_automatica: string
  processo_id: string | null
  instrumento_id: string | null
  descricao: string
}

export const GATILHOS: Record<string, string> = {
  prazo_judicial_vencido: 'Prazo judicial vencido sem início do transporte',
  sla_vencido_nivel3: 'Etapa vencida há mais de 3 dias úteis',
  sla_etapa_5_6: 'Atraso na OP/PAF ou na liberação do recurso',
  valor_acima_cotacao: 'Valor definido acima da menor cotação',
  contrato_vencido_sem_aditivo: 'Contrato vencido sem aditivo/encerramento',
  ocorrencia_interrupcao: 'Ocorrência de interrupção do transporte',
  ocorrencia_veiculo_irregular: 'Veículo ou condutor irregular',
  prestacao_vencida: 'Prestação de contas não entregue no prazo',
  divergencia_aberta_prazo: 'Divergência TER × SIMADE aberta após o fim da adesão',
  saldo_menor_10pct: 'Saldo contratual abaixo de 10%',
}

export function detectarRiscos(lista: Lista, hoje: string, feriados: ReadonlySet<string>): OcorrenciaRiscoGerada[] {
  const o: OcorrenciaRiscoGerada[] = []
  const add = (gatilho: string, chave: string, processo_id: unknown, instrumento_id: unknown, descricao: string) =>
    o.push({ gatilho, chave_automatica: `${gatilho}|${chave}`, processo_id: (processo_id as string) ?? null, instrumento_id: (instrumento_id as string) ?? null, descricao })

  for (const s of situacaoDosProcessos(lista, hoje, feriados)) {
    const cod = String(s.processo.codigo)
    const d = s.demanda
    if (d && d.situacao === 'ativa' && !d.data_inicio_transporte && d.prazo_judicial && String(d.prazo_judicial) < hoje)
      add('prazo_judicial_vencido', d.id, s.processo.id, null, `${cod}: prazo judicial de ${formatarData(d.prazo_judicial)} vencido sem início do transporte.`)
    if (s.instancia && s.semaforo.nivel === 3 && s.instancia.prazo_sla && String(s.instancia.prazo_sla) < hoje)
      add('sla_vencido_nivel3', s.instancia.id, s.processo.id, null, `${cod}: etapa "${s.modelo?.nome}" vencida em ${formatarData(s.instancia.prazo_sla)}.`)
    if (s.instancia && ['J05', 'J06'].includes(String(s.modelo?.codigo)) && s.instancia.prazo_sla && String(s.instancia.prazo_sla) < hoje)
      add('sla_etapa_5_6', s.instancia.id, s.processo.id, null, `${cod}: "${s.modelo?.nome}" fora do prazo.`)
    if (d?.metodo_valor === 'tres_cotacoes' && d.valor_mensal) {
      const cot = lista('cotacoes').filter((c) => c.demanda_id === d.id).map((c) => Number(c.valor_mensal))
      const menor = cot.length ? Math.min(...cot) : null
      if (menor !== null && Number(d.valor_mensal) > menor)
        add('valor_acima_cotacao', `${d.id}|${d.valor_mensal}`, s.processo.id, null, `${cod}: valor mensal ${formatarMoeda(d.valor_mensal)} acima da menor cotação (${formatarMoeda(menor)}).`)
    }
    if (s.adesao && s.adesao.status !== 'encerrado') {
      const ciclo = lista('ciclos_pte').find((c) => c.id === s.adesao!.ciclo_id)
      const abertas = lista('divergencias').filter((x) => x.adesao_id === s.adesao!.id && x.status === 'aberta').length
      if (abertas && ciclo?.data_fim_adesao && String(ciclo.data_fim_adesao) < hoje)
        add('divergencia_aberta_prazo', s.adesao.id, s.processo.id, null, `${cod}: ${abertas} divergência(s) TER × SIMADE ainda abertas.`)
    }
  }

  for (const { instrumento: i, situacao } of situacaoDosInstrumentos(lista, hoje)) {
    const cod = String(lista('processos').find((p) => p.id === i.processo_id)?.codigo ?? i.numero)
    if (situacao.faixa === 'vencido')
      add('contrato_vencido_sem_aditivo', `${i.id}|${situacao.vigencia_fim_atual}`, i.processo_id, i.id, `${cod}: vigência terminou em ${formatarData(situacao.vigencia_fim_atual)} sem aditivo ou encerramento.`)
    if (situacao.faixa !== 'encerrado' && situacao.valor_atual > 0 && situacao.saldo / situacao.valor_atual < 0.1 && situacao.faixa !== 'vencido')
      add('saldo_menor_10pct', i.id, i.processo_id, i.id, `${cod}: saldo de ${formatarMoeda(situacao.saldo)} (${(100 - situacao.pct_executado).toFixed(1)}%).`)
    for (const oc of lista('ocorrencias').filter((x) => x.instrumento_id === i.id)) {
      if (oc.tipo === 'interrupcao') add('ocorrencia_interrupcao', oc.id, i.processo_id, i.id, `${cod}: ${oc.titulo} (${formatarData(oc.data)}).`)
      if (oc.tipo === 'veiculo_irregular' || oc.tipo === 'condutor_irregular')
        add('ocorrencia_veiculo_irregular', oc.id, i.processo_id, i.id, `${cod}: ${oc.titulo} (${formatarData(oc.data)}).`)
    }
    for (const p of lista('prestacoes_contas').filter((x) => x.instrumento_id === i.id))
      if (situacaoPrazoPrestacao(p, hoje) === 'vencida')
        add('prestacao_vencida', p.id, i.processo_id, i.id, `${cod}: prestação "${p.periodo_referencia}" venceu em ${formatarData(p.data_limite)}.`)
  }
  return o
}

/** Alertas de tela de um instrumento (reaproveitado nas listas). */
export { alertasInstrumento }
