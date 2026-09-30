// Reúne os dados de um processo (demanda judicial ou adesão PTE) e avalia o que falta
// para concluir cada etapa: documentos do checklist + requisitos de dados.

import { conformidadeDoContexto, totalPendencias, type ConformidadeEntidade } from '../conformidade'
import { ESTADOS_FINAIS_PRESTACAO } from '../contratos/calculos'
import { hojeIso } from '../diasUteis'
import type { Colecao, Registro } from '../dados/tipos'
import { avaliarChecklist, condicoesAtivas, documentosFaltantes, type ItemChecklist } from './checklist'

export type Lista = (colecao: Colecao) => Registro[]

export interface DadosProcesso {
  processo?: Registro
  demanda?: Registro
  adesao?: Registro
  ciclo?: Registro
  alunosDemanda: Registro[]
  caracterizacoes: Registro[]
  saude: Registro[]
  /** Decisões do subsecretário (aprovações e devoluções), da mais antiga para a mais recente. */
  autorizacoes: Registro[]
  pafs: Registro[]
  instrumentos: Registro[]
  parcelas: Registro[]
  fiscalizacoes: Registro[]
  prestacoes: Registro[]
  documentos: Registro[]
  etapas: Registro[]
  pteAlunos: Registro[]
  divergencias: Registro[]
  calculos: Registro[]
  contratacoes: Registro[]
  rotas: Registro[]
  /** Alocações vigentes (veículo/condutor) do contrato judicial ou das contratações do município. */
  alocacoes: Registro[]
  /** Conformidade documental (CTB/DETRAN/SEE) do contratado, veículos e condutores. */
  conformidade: ConformidadeEntidade[]
}

export function montarDadosProcesso(lista: Lista, processoId: string, hoje = hojeIso()): DadosProcesso {
  const de = (c: Colecao, campo: string, valor: unknown) => (valor ? lista(c).filter((r) => r[campo] === valor) : [])
  const demanda = lista('demandas').find((d) => d.processo_id === processoId)
  const adesao = lista('adesoes_pte').find((a) => a.processo_id === processoId)
  const caracterizacoes = de('caracterizacoes', 'demanda_id', demanda?.id)
  const instrumentos = de('instrumentos', 'processo_id', processoId)
  const ids = new Set(instrumentos.map((i) => i.id))
  const doInstrumento = (c: Colecao) => lista(c).filter((r) => ids.has(r.instrumento_id as string))
  const contratacoes = de('contratacoes_municipais', 'adesao_id', adesao?.id)
  const contrato = instrumentos.find((i) => i.tipo === 'contrato_caixa')
  const conformidade = contrato
    ? conformidadeDoContexto(lista, { instrumento_id: contrato.id }, hoje, contrato.transportador_id)
    : contratacoes.flatMap((c) => conformidadeDoContexto(lista, { contratacao_id: c.id }, hoje))
  const alocacoes = lista('alocacoes').filter(
    (a) => (!a.fim || String(a.fim) >= hoje) && ((contrato && a.instrumento_id === contrato.id) || contratacoes.some((c) => c.id === a.contratacao_id)),
  )
  return {
    contratacoes,
    rotas: de('rotas_pte', 'adesao_id', adesao?.id),
    alocacoes,
    conformidade,
    processo: lista('processos').find((p) => p.id === processoId),
    demanda,
    adesao,
    ciclo: adesao ? lista('ciclos_pte').find((c) => c.id === adesao.ciclo_id) : undefined,
    alunosDemanda: de('demanda_alunos', 'demanda_id', demanda?.id).filter((a) => !a.removido_em),
    caracterizacoes,
    saude: lista('caracterizacoes_saude').filter((s) => caracterizacoes.some((c) => c.id === s.caracterizacao_id)),
    autorizacoes: de('autorizacoes_subsecretario', 'demanda_id', demanda?.id).sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em))),
    pafs: de('pafs', 'demanda_id', demanda?.id),
    instrumentos,
    parcelas: doInstrumento('parcelas'),
    fiscalizacoes: doInstrumento('fiscalizacoes'),
    prestacoes: doInstrumento('prestacoes_contas'),
    documentos: de('documentos', 'processo_id', processoId),
    etapas: de('processo_etapas', 'processo_id', processoId),
    pteAlunos: de('pte_alunos', 'adesao_id', adesao?.id),
    divergencias: de('divergencias', 'adesao_id', adesao?.id),
    calculos: de('calculos_repasse', 'adesao_id', adesao?.id),
  }
}

/** Requisitos de DADOS de cada etapa (não dispensáveis por justificativa). */
export function pendenciasDeDados(codigoEtapa: string, d: DadosProcesso): string[] {
  const p: string[] = []
  const exige = (condicao: unknown, mensagem: string) => !condicao && p.push(mensagem)
  const prestacoesDecididas = d.prestacoes.length > 0 && d.prestacoes.every((x) => ESTADOS_FINAIS_PRESTACAO.includes(String(x.status)))

  switch (codigoEtapa) {
    case 'J02':
      exige(d.demanda?.responsavel_sre_id, 'Defina o responsável pelo acompanhamento na SRE.')
      break
    case 'J03': {
      exige(d.alunosDemanda.length > 0, 'Inclua ao menos um aluno na demanda.')
      const semForm = d.alunosDemanda.filter((a) => {
        const c = d.caracterizacoes.find((x) => x.demanda_aluno_id === a.id)
        return !c || !['enviada', 'aprovada'].includes(String(c.status))
      })
      exige(semForm.length === 0, `${semForm.length} aluno(s) sem formulário de caracterização enviado.`)
      break
    }
    case 'J04':
      // A etapa só é concluída pela decisão do subsecretário (aprovar ou devolver)
      p.push('Aguardando a decisão do subsecretário (aprovar a liberação ou devolver para ajuste).')
      break
    case 'J05':
      exige(d.pafs.length > 0, 'Crie o PAF (número oficial, data de criação, valor e CNPJ).')
      break
    case 'J06': {
      exige(d.instrumentos.some((i) => i.tipo === 'contrato_caixa'), 'Registre o contrato firmado pela Caixa Escolar.')
      exige(d.alocacoes.some((a) => a.veiculo_id) && d.alocacoes.some((a) => a.condutor_id), 'Informe o veículo e o motorista que farão o transporte (aba Frota e conformidade do contrato).')
      const pend = totalPendencias(d.conformidade)
      exige(pend === 0, `${pend} documento(s) obrigatório(s) do contratado, veículo ou condutor ausente(s) ou vencido(s) (CTB arts. 136–138 e 329; Res. SEE 3.670/2017).`)
      break
    }
    case 'J07':
      exige(d.demanda?.data_inicio_transporte, 'Informe a data de início efetivo do transporte.')
      exige(d.fiscalizacoes.length > 0, 'Registre ao menos um mês de fiscalização.')
      break
    case 'P05':
      exige(prestacoesDecididas, 'Todas as prestações de contas precisam estar decididas (aprovada, com ressalvas ou reprovada).')
      break
    case 'P02':
      exige(d.rotas.length > 0, 'Cadastre as rotas do TER/MG (km, custo por km, passageiros).')
      exige(d.contratacoes.length > 0, 'Informe como o município executa o transporte: contratação de terceiros e/ou frota própria.')
      exige(d.pteAlunos.length > 0, 'Informe a lista de alunos atendidos (TER).')
      exige(d.adesao?.conciliado_em, 'Execute a conciliação com o SIMADE.')
      exige(!d.divergencias.some((x) => x.status === 'aberta'), `Há ${d.divergencias.filter((x) => x.status === 'aberta').length} divergência(s) em aberto.`)
      break
    case 'P03': {
      exige(d.alocacoes.length > 0, 'Vincule os veículos e condutores às contratações do município.')
      const pend = totalPendencias(d.conformidade)
      exige(pend === 0, `${pend} documento(s) obrigatório(s) de veículos/condutores ausente(s) ou vencido(s) — exigido pelo art. 8º da Res. SEE/SEGOV 5.267/2026 (CTB arts. 136–139).`)
      exige(d.ciclo?.aprovado_em, 'O cálculo do ciclo ainda não foi aprovado.')
      exige(d.instrumentos.some((i) => i.tipo === 'termo_pte'), 'Registre o termo/convênio com o município.')
      exige(d.parcelas.some((x) => x.valor_pago), 'Registre ao menos um repasse efetivado.')
      break
    }
    case 'P04':
      exige(d.fiscalizacoes.length > 0, 'Registre ao menos um acompanhamento da execução.')
      break
  }
  return p
}

export interface AvaliacaoEtapa {
  checklist: ItemChecklist[]
  faltantes: ItemChecklist[]
  pendencias: string[]
}

export function avaliarEtapa(d: DadosProcesso, etapaModelo: Registro, checklistModelo: Registro[], tiposDocumento: Registro[]): AvaliacaoEtapa {
  const modelos = checklistModelo.filter((m) => m.etapa_modelo_id === etapaModelo.id)
  const checklist = avaliarChecklist(modelos, tiposDocumento, d.documentos, condicoesAtivas({ demanda: d.demanda, caracterizacoes: d.caracterizacoes, saude: d.saude }))
  return { checklist, faltantes: documentosFaltantes(checklist), pendencias: pendenciasDeDados(String(etapaModelo.codigo), d) }
}

/** Etapa em andamento (a de menor ordem, se houver mais de uma). */
export function etapaAtual(d: DadosProcesso, etapasModelo: Registro[]): { instancia?: Registro; modelo?: Registro } {
  const abertas = d.etapas
    .filter((e) => e.status === 'em_andamento')
    .map((e) => ({ instancia: e, modelo: etapasModelo.find((m) => m.id === e.etapa_modelo_id) }))
    .sort((a, b) => Number(a.modelo?.ordem ?? 0) - Number(b.modelo?.ordem ?? 0))
  return abertas[0] ?? {}
}
