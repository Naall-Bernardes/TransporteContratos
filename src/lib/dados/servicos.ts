// Operações de negócio que mexem em várias tabelas de uma vez (sempre dentro de uma transação).
// No banco, cada uma vira uma função SQL (RPC) chamada pelo front.

import { calcularSituacao, diasCorridos } from '../contratos/calculos'
import { somarDias, somarMeses } from '../datas'
import { hojeIso } from '../diasUteis'
import { avaliarEtapa, montarDadosProcesso } from '../fluxo/processo'
import { prazoDaEtapa } from '../fluxo/sla'
import { formatarData } from '../formatacao'
import { ehCentral, ehDiretorOuCentral, podeAutorizarLiberacao } from '../permissoes'
import { calcularRepasse, conciliar, DIVERGENCIAS_DE_ROTA, inconsistenciasRotas } from '../pte/pte'
import { criarProcesso, ErroPermissao, ErroRegra, transacao, type Tx } from './repositorio'
import type { Colecao, Registro, Usuario } from './tipos'

/** Feriados nacionais e estaduais (municipais ficam de fora da contagem geral). */
export function feriadosDe(lista: (c: Colecao) => Registro[]): Set<string> {
  return new Set(lista('feriados').filter((f) => f.abrangencia !== 'municipal').map((f) => String(f.data)))
}

function iniciarEtapa(tx: Tx, processoId: string, modelo: Registro, responsavelId: unknown) {
  const hoje = hojeIso()
  const existente = tx.lista('processo_etapas').find((e) => e.processo_id === processoId && e.etapa_modelo_id === modelo.id)
  return tx.salvar('processo_etapas', {
    ...(existente ? { id: existente.id } : {}),
    processo_id: processoId,
    etapa_modelo_id: modelo.id,
    status: 'em_andamento',
    responsavel_id: responsavelId ?? null,
    iniciada_em: hoje,
    prazo_sla: prazoDaEtapa(hoje, modelo.sla_dias_uteis as number | null, feriadosDe(tx.lista)),
    concluida_em: null,
  })
}

const modelosDo = (tx: Tx, modulo: 'JUDICIAL' | 'PTE') =>
  tx.lista('etapas_modelo').filter((m) => m.modulo === modulo).sort((a, b) => Number(a.ordem) - Number(b.ordem))

// ---------- Judicial ----------

export function criarDemanda(usuario: Usuario, dados: Record<string, unknown>) {
  return transacao(usuario, (tx) => {
    const escola = tx.consulta('escolas', dados.escola_id)
    if (!escola) throw new ErroRegra('Escolha a escola estadual.')
    const processo = criarProcesso(tx, 'JUDICIAL', {
      ano: Number(String(dados.data_recebimento ?? hojeIso()).slice(0, 4)),
      sre_id: escola.sre_id,
      numero_sei: dados.numero_sei,
    })
    const demanda = tx.salvar('demandas', { ...dados, processo_id: processo.id, situacao: 'ativa' })
    iniciarEtapa(tx, processo.id, modelosDo(tx, 'JUDICIAL')[0], usuario.id)
    return demanda
  })
}

/** Inclui o aluno na demanda e já abre o formulário de caracterização em rascunho. */
export function incluirAluno(usuario: Usuario, demandaId: string, alunoId: string) {
  return transacao(usuario, (tx) => {
    const da = tx.salvar('demanda_alunos', { demanda_id: demandaId, aluno_id: alunoId, incluido_em: hojeIso() })
    tx.salvar('caracterizacoes', { demanda_id: demandaId, demanda_aluno_id: da.id, status: 'rascunho' })
    return da
  })
}

/**
 * Conclui a etapa e inicia a próxima.
 * - Requisitos de dados são obrigatórios.
 * - Documentos faltantes só podem ser dispensados com justificativa, por Diretor DAFI ou órgão central.
 */
export function concluirEtapa(usuario: Usuario, processoEtapaId: string, justificativa?: string) {
  return transacao(usuario, (tx) => {
    const instancia = tx.consulta('processo_etapas', processoEtapaId)
    if (!instancia || instancia.status !== 'em_andamento') throw new ErroRegra('Etapa não está em andamento.')
    const modelo = tx.consulta('etapas_modelo', instancia.etapa_modelo_id)!
    const dados = montarDadosProcesso(tx.lista, String(instancia.processo_id))
    const av = avaliarEtapa(dados, modelo, tx.lista('checklist_modelo'), tx.lista('tipos_documento'))

    if (av.pendencias.length) throw new ErroRegra(`Não é possível concluir: ${av.pendencias.join(' ')}`)
    if (av.faltantes.length) {
      if (!justificativa?.trim())
        throw new ErroRegra(`Checklist incompleto: ${av.faltantes.map((f) => f.nome).join(', ')}.`)
      if (!ehDiretorOuCentral(usuario))
        throw new ErroPermissao('Só o Diretor DAFI ou o órgão central pode avançar com checklist incompleto.')
    }

    avancarDaEtapa(tx, usuario, instancia, modelo, {
      justificativa_avanco: av.faltantes.length ? justificativa : null,
      documentos_dispensados: av.faltantes.length ? av.faltantes.map((f) => f.nome).join(', ') : null,
      dispensa_autorizada_por: av.faltantes.length ? usuario.id : null,
    })
  })
}

/** Conclui a etapa e abre a próxima (ou encerra o processo, se era a última). */
function avancarDaEtapa(tx: Tx, usuario: Usuario, instancia: Registro, modelo: Registro, extras: Record<string, unknown> = {}) {
  tx.salvar('processo_etapas', { id: instancia.id, status: 'concluida', concluida_em: hojeIso(), ...extras })
  const dados = montarDadosProcesso(tx.lista, String(instancia.processo_id))
  const modulo = modelo.modulo as 'JUDICIAL' | 'PTE'
  const proxima = modelosDo(tx, modulo).find((m) => Number(m.ordem) > Number(modelo.ordem))
  if (proxima) {
    iniciarEtapa(tx, String(instancia.processo_id), proxima, responsavelPadrao(tx, usuario, proxima, dados.demanda))
    if (dados.adesao) tx.salvar('adesoes_pte', { id: dados.adesao.id, status: STATUS_ADESAO[String(proxima.codigo)] ?? dados.adesao.status })
  } else {
    if (dados.demanda) tx.salvar('demandas', { id: dados.demanda.id, situacao: 'cumprida' })
    if (dados.adesao) tx.salvar('adesoes_pte', { id: dados.adesao.id, status: 'encerrado' })
  }
}

/** Quem assume a próxima etapa: SRE → responsável da demanda; subsecretário → o(a) subsecretário(a); central → quem concluiu. */
function responsavelPadrao(tx: Tx, usuario: Usuario, proxima: Registro, demanda?: Registro): unknown {
  if (proxima.papel_responsavel === 'sre') return demanda?.responsavel_sre_id ?? null
  if (proxima.papel_responsavel === 'subsecretario') return tx.lista('usuarios').find((u) => u.papel === 'subsecretario' && u.ativo)?.id ?? null
  return ehCentral(usuario) ? usuario.id : null
}

function etapaEmAndamento(tx: Tx, processoId: unknown, codigo: string) {
  const modelo = tx.lista('etapas_modelo').find((m) => m.codigo === codigo)
  const instancia = tx.lista('processo_etapas').find((e) => e.processo_id === processoId && e.etapa_modelo_id === modelo?.id)
  return { modelo, instancia: instancia?.status === 'em_andamento' ? instancia : undefined }
}

export interface DecisaoAutorizacao {
  decisao: 'aprovada' | 'devolvida'
  valor_mensal?: number
  meses?: number
  parecer?: string
}

/**
 * Etapa 4 — o(a) subsecretário(a) aprova a liberação do recurso (com o valor autorizado)
 * ou devolve a demanda para ajuste (volta à etapa 3, Caracterização).
 */
export function decidirAutorizacao(usuario: Usuario, demandaId: string, d: DecisaoAutorizacao) {
  if (!podeAutorizarLiberacao(usuario)) return Promise.reject(new ErroPermissao('Só o(a) subsecretário(a) autoriza a liberação do recurso.'))
  return transacao(usuario, (tx) => {
    const demanda = tx.consulta('demandas', demandaId)!
    const { modelo, instancia } = etapaEmAndamento(tx, demanda.processo_id, 'J04')
    if (!modelo || !instancia) throw new ErroRegra('Esta demanda não está aguardando autorização.')
    const valorTotal = d.decisao === 'aprovada' ? Math.round(Number(d.valor_mensal) * Number(d.meses) * 100) / 100 : null
    tx.salvar('autorizacoes_subsecretario', {
      demanda_id: demandaId,
      decisao: d.decisao,
      data: hojeIso(),
      subsecretario_id: usuario.id,
      valor_mensal: d.decisao === 'aprovada' ? d.valor_mensal : null,
      meses: d.decisao === 'aprovada' ? d.meses : null,
      valor_total: valorTotal,
      parecer: d.parecer?.trim() || null,
    })
    if (d.decisao === 'aprovada') {
      tx.salvar('demandas', { id: demandaId, valor_mensal: d.valor_mensal, meses_previstos: d.meses })
      avancarDaEtapa(tx, usuario, instancia, modelo)
    } else {
      // Devolução: a etapa 4 fica registrada como devolvida e a Caracterização é reaberta
      tx.salvar('processo_etapas', { id: instancia.id, status: 'devolvida', concluida_em: hojeIso() })
      const modeloJ03 = tx.lista('etapas_modelo').find((m) => m.codigo === 'J03')!
      iniciarEtapa(tx, String(demanda.processo_id), modeloJ03, demanda.responsavel_sre_id ?? null)
    }
  })
}

export interface DadosPaf {
  numero: string
  data_criacao: string
  valor: number
  cnpj_destinatario: string
}

/** Etapa 5 — registro manual do PAF criado (vigência = 5 anos após a criação). Conclui a etapa. */
export function criarPaf(usuario: Usuario, demandaId: string, p: DadosPaf) {
  if (!ehCentral(usuario)) return Promise.reject(new ErroPermissao('O PAF é registrado pelo órgão central.'))
  return transacao(usuario, (tx) => {
    const demanda = tx.consulta('demandas', demandaId)!
    const { modelo, instancia } = etapaEmAndamento(tx, demanda.processo_id, 'J05')
    if (!modelo || !instancia) throw new ErroRegra('A demanda não está na etapa de registro do PAF.')
    const paf = tx.salvar('pafs', { demanda_id: demandaId, ...p })
    avancarDaEtapa(tx, usuario, instancia, modelo)
    return paf
  })
}

const STATUS_ADESAO: Record<string, string> = {
  P03: 'definicao_repasse',
  P04: 'execucao',
  P05: 'prestacao',
}

// ---------- PTE ----------

export function criarAdesao(usuario: Usuario, dados: Record<string, unknown>) {
  return transacao(usuario, (tx) => {
    const ciclo = tx.consulta('ciclos_pte', dados.ciclo_id)
    const municipio = tx.consulta('municipios', dados.municipio_id)
    if (!ciclo || !municipio) throw new ErroRegra('Escolha o ciclo e o município.')
    if (ciclo.aprovado_em) throw new ErroRegra('Ciclo já aprovado: não aceita novas adesões.')
    const processo = criarProcesso(tx, 'PTE', {
      ano: Number(ciclo.ano),
      sre_id: municipio.sre_id,
      municipio_id: municipio.id,
      numero_sei: dados.numero_sei,
    })
    const adesao = tx.salvar('adesoes_pte', { ...dados, processo_id: processo.id, status: 'aderido' })
    iniciarEtapa(tx, processo.id, modelosDo(tx, 'PTE')[0], null)
    return adesao
  })
}

/** Refaz a conciliação: novas divergências entram abertas; as que sumiram são marcadas corrigidas; justificadas são mantidas. */
export function executarConciliacao(usuario: Usuario, adesaoId: string) {
  return transacao(usuario, (tx) => {
    const adesao = tx.consulta('adesoes_pte', adesaoId)!
    const informados = tx.lista('pte_alunos').filter((a) => a.adesao_id === adesaoId)
    const simade = tx.lista('simade_registros').filter((s) => s.ciclo_id === adesao.ciclo_id)
    const outras = tx
      .lista('adesoes_pte')
      .filter((a) => a.ciclo_id === adesao.ciclo_id && a.id !== adesaoId)
      .flatMap((a) => {
        const municipio = String(tx.consulta('municipios', a.municipio_id)?.nome ?? '')
        return tx.lista('pte_alunos').filter((x) => x.adesao_id === a.id).map((aluno) => ({ aluno, municipio }))
      })
    const rotasCiclo = tx.lista('rotas_pte').filter((r) => tx.consulta('adesoes_pte', r.adesao_id)?.ciclo_id === adesao.ciclo_id && r.ativa !== false)
    const mediaCusto = rotasCiclo.length ? rotasCiclo.reduce((t, r) => t + Number(r.custo_km || 0), 0) / rotasCiclo.length : 0
    const encontradas = [
      ...conciliar(informados, simade, outras),
      ...inconsistenciasRotas(tx.lista('rotas_pte').filter((r) => r.adesao_id === adesaoId), informados, mediaCusto),
    ]
    const existentes = tx.lista('divergencias').filter((d) => d.adesao_id === adesaoId)
    const chave = (d: Record<string, unknown>) => `${d.referencia ?? d.cod_simade}|${d.tipo}`
    const atuais = new Set(encontradas.map((e) => chave({ ...e })))

    for (const e of existentes)
      if (!atuais.has(chave(e)) && e.status === 'aberta')
        tx.salvar('divergencias', { id: e.id, status: 'corrigida', resolucao: `Não aparece mais na conciliação de ${formatarData(hojeIso())}.` })
    for (const n of encontradas) {
      const ja = existentes.find((e) => chave(e) === chave({ ...n }))
      if (!ja) tx.salvar('divergencias', { adesao_id: adesaoId, ...n, status: 'aberta' })
      else if (ja.status === 'corrigida') tx.salvar('divergencias', { id: ja.id, status: 'aberta', resolucao: null, descricao: n.descricao })
    }
    tx.salvar('adesoes_pte', { id: adesaoId, conciliado_em: hojeIso() })
    return encontradas.length
  })
}

export function calcularAdesao(usuario: Usuario, adesaoId: string) {
  return transacao(usuario, (tx) => {
    const adesao = tx.consulta('adesoes_pte', adesaoId)!
    const ciclo = tx.consulta('ciclos_pte', adesao.ciclo_id)!
    const abertas = tx.lista('divergencias').filter((d) => d.adesao_id === adesaoId && d.status === 'aberta')
    const alunosDiv = new Set(abertas.filter((d) => !DIVERGENCIAS_DE_ROTA.includes(d.tipo as never)).map((d) => String(d.referencia)))
    const rotasDiv = new Set(abertas.filter((d) => DIVERGENCIAS_DE_ROTA.includes(d.tipo as never)).map((d) => String(d.referencia).replace(/^ROTA /, '')))
    const r = calcularRepasse(
      tx.lista('rotas_pte').filter((x) => x.adesao_id === adesaoId),
      tx.lista('pte_alunos').filter((a) => a.adesao_id === adesaoId),
      alunosDiv,
      rotasDiv,
      { dias_letivos: Number(ciclo.dias_letivos || 200), pnate_estadual: Number(adesao.pnate_estadual || 0), saldo_reprogramado: Number(adesao.saldo_reprogramado || 0) },
    )
    const versao = tx.lista('calculos_repasse').filter((c) => c.adesao_id === adesaoId).length + 1
    const { rotas: _detalhe, ...resumo } = r
    void _detalhe
    return tx.salvar('calculos_repasse', { adesao_id: adesaoId, versao, ...resumo, calculado_em: hojeIso() })
  })
}

/** Aprovação ÚNICA por ciclo: trava parâmetros e cálculos. */
export function aprovarCiclo(usuario: Usuario, cicloId: string) {
  return transacao(usuario, (tx) => {
    if (!ehCentral(usuario)) throw new ErroPermissao('Só o órgão central aprova o ciclo.')
    const ciclo = tx.consulta('ciclos_pte', cicloId)!
    if (ciclo.aprovado_em) throw new ErroRegra('Este ciclo já foi aprovado.')
    const adesoes = tx.lista('adesoes_pte').filter((a) => a.ciclo_id === cicloId)
    const semCalculo = adesoes.filter((a) => !tx.lista('calculos_repasse').some((c) => c.adesao_id === a.id))
    if (adesoes.length === 0) throw new ErroRegra('Nenhuma adesão neste ciclo.')
    if (semCalculo.length) throw new ErroRegra(`${semCalculo.length} adesão(ões) ainda sem cálculo.`)
    tx.salvar('ciclos_pte', { id: cicloId, aprovado_em: hojeIso(), aprovado_por: usuario.id, status: 'aprovado' })
  })
}

/** Gera o termo/convênio da adesão com o valor aprovado e o cronograma de repasses do ciclo. */
export function gerarTermo(usuario: Usuario, adesaoId: string, dados: Record<string, unknown>) {
  return transacao(usuario, (tx) => {
    const adesao = tx.consulta('adesoes_pte', adesaoId)!
    const ciclo = tx.consulta('ciclos_pte', adesao.ciclo_id)!
    if (!ciclo.aprovado_em) throw new ErroRegra('Aprove o ciclo antes de gerar o termo.')
    if (tx.lista('instrumentos').some((i) => i.processo_id === adesao.processo_id)) throw new ErroRegra('Esta adesão já tem termo.')
    const calculos = tx.lista('calculos_repasse').filter((c) => c.adesao_id === adesaoId)
    const ultimo = calculos.sort((a, b) => Number(b.versao) - Number(a.versao))[0]
    const municipio = tx.consulta('municipios', adesao.municipio_id)
    const inst = tx.salvar('instrumentos', {
      tipo: 'termo_pte',
      processo_id: adesao.processo_id,
      municipio_id: adesao.municipio_id,
      objeto: `Repasse PTE/MG ${ciclo.ano} ao município de ${municipio?.nome} para transporte de estudantes da rede estadual.`,
      vigencia_inicio: ciclo.vigencia_inicio,
      vigencia_fim: ciclo.vigencia_fim,
      valor_global: ultimo?.valor_calculado,
      status: 'vigente',
      periodicidade_prestacao: 'anual',
      prazo_prestacao_dias: 60,
      ...dados,
    })
    // Repasses mensais de fevereiro a novembro (Res. 5.267/2026, art. 16)
    criarParcelas(tx, inst, Number(ciclo.num_parcelas || 10), `${ciclo.ano}-02-10`, 1)
    // Prestação de contas anual até 28/02 do ano seguinte (art. 19, II; Decreto 46.946/2016, art. 9º)
    tx.salvar('prestacoes_contas', { instrumento_id: inst.id, periodo_referencia: `Exercício ${ciclo.ano}`, data_limite: `${Number(ciclo.ano) + 1}-02-28`, status: 'pendente' })
    return inst
  })
}

// ---------- Contratos ----------

function criarParcelas(tx: Tx, inst: Registro, qtd: number, primeira: string, intervaloMeses: number, valorParcela?: number) {
  const existentes = tx.lista('parcelas').filter((p) => p.instrumento_id === inst.id)
  const inicioNumero = existentes.reduce((m, p) => Math.max(m, Number(p.numero) || 0), 0)
  const s = calcularSituacao(inst, tx.lista('aditivos').filter((a) => a.instrumento_id === inst.id), existentes, hojeIso())
  const jaPrevisto = existentes.reduce((t, p) => t + Number(p.valor_previsto || 0), 0)
  const valor = valorParcela ?? Math.floor(((s.valor_atual - jaPrevisto) / qtd) * 100) / 100
  if (valor <= 0) throw new ErroRegra('Não há valor a distribuir: as parcelas existentes já cobrem o valor do instrumento.')
  for (let i = 0; i < qtd; i++) {
    const data = somarMeses(primeira, Math.round(i * intervaloMeses))
    // a última parcela absorve os centavos do arredondamento
    const v = !valorParcela && i === qtd - 1 ? Math.round((s.valor_atual - jaPrevisto - valor * (qtd - 1)) * 100) / 100 : valor
    tx.salvar('parcelas', { instrumento_id: inst.id, numero: inicioNumero + i + 1, competencia: data.slice(0, 7), valor_previsto: v, data_prevista: data })
  }
}

export function gerarCronograma(usuario: Usuario, instrumentoId: string, p: { qtd: number; primeira_data: string; intervalo_meses: number; valor_parcela?: number }) {
  return transacao(usuario, (tx) => {
    const inst = tx.consulta('instrumentos', instrumentoId)!
    if (p.qtd < 1 || p.qtd > 60) throw new ErroRegra('Informe de 1 a 60 parcelas.')
    criarParcelas(tx, inst, p.qtd, p.primeira_data, p.intervalo_meses, p.valor_parcela || undefined)
  })
}

export const PERIODICIDADES: Record<string, { rotulo: string; meses: number }> = {
  mensal: { rotulo: 'Mensal', meses: 1 },
  trimestral: { rotulo: 'Trimestral', meses: 3 },
  semestral: { rotulo: 'Semestral', meses: 6 },
  anual: { rotulo: 'Anual', meses: 12 },
  final: { rotulo: 'Única, ao final da vigência', meses: 0 },
}

/** Cria as prestações de contas previstas conforme a periodicidade do instrumento (não duplica períodos). */
export function gerarPrestacoesPrevistas(usuario: Usuario, instrumentoId: string) {
  return transacao(usuario, (tx) => {
    const inst = tx.consulta('instrumentos', instrumentoId)!
    const per = PERIODICIDADES[String(inst.periodicidade_prestacao ?? 'final')] ?? PERIODICIDADES.final
    const prazo = Number(inst.prazo_prestacao_dias ?? 30)
    const s = calcularSituacao(inst, tx.lista('aditivos').filter((a) => a.instrumento_id === inst.id), [], hojeIso())
    const inicio = String(inst.vigencia_inicio)
    const fim = s.vigencia_fim_atual
    const existentes = new Set(tx.lista('prestacoes_contas').filter((p) => p.instrumento_id === inst.id).map((p) => String(p.periodo_referencia)))
    let criadas = 0
    let ini = inicio
    for (let i = 0; i < 60 && ini <= fim; i++) {
      let fimPeriodo = per.meses === 0 ? fim : [somarDias(somarMeses(ini, per.meses), -1), fim].sort()[0]
      // sobra de menos de 30 dias no fim da vigência é incorporada ao último período
      if (diasCorridos(somarDias(fimPeriodo, 1), fim) < 30) fimPeriodo = fim
      const rotulo = `${formatarData(ini)} a ${formatarData(fimPeriodo)}`
      if (!existentes.has(rotulo)) {
        tx.salvar('prestacoes_contas', { instrumento_id: inst.id, periodo_referencia: rotulo, data_limite: somarDias(fimPeriodo, prazo), status: 'pendente' })
        criadas++
      }
      if (per.meses === 0 || fimPeriodo === fim) break
      ini = somarDias(fimPeriodo, 1)
    }
    return criadas
  })
}

// ---------- Importação de planilhas (CSV) ----------

export interface ResultadoImportacao {
  incluidos: number
  atualizados: number
  erros: string[]
}

/** Pega o valor da primeira coluna existente entre os nomes aceitos (cabeçalhos flexíveis). */
const coluna = (linha: Record<string, string>, ...nomes: string[]) => nomes.map((n) => linha[n]).find((v) => v !== undefined && v !== '') ?? ''

function importar(
  usuario: Usuario,
  linhas: Record<string, string>[],
  gravar: (tx: Tx, linha: Record<string, string>) => 'incluido' | 'atualizado',
): Promise<ResultadoImportacao> {
  return transacao(usuario, (tx) => {
    const r: ResultadoImportacao = { incluidos: 0, atualizados: 0, erros: [] }
    linhas.forEach((linha, i) => {
      try {
        const res = gravar(tx, linha)
        if (res === 'incluido') r.incluidos++
        else r.atualizados++
      } catch (e) {
        const msg = e instanceof Error ? ('erros' in e ? Object.values((e as { erros: Record<string, string> }).erros).join(' ') : e.message) : String(e)
        r.erros.push(`Linha ${i + 2}: ${msg}`)
      }
    })
    return r
  })
}

/** Lista TER/MG do município. Colunas: matricula/cod_simade, nome, inep/escola_inep, km_ida, zona, turno. */
export function importarAlunosTer(usuario: Usuario, adesaoId: string, linhas: Record<string, string>[], numero: (v: string) => number) {
  return importar(usuario, linhas, (tx, l) => {
    const cod = coluna(l, 'cod_simade', 'matricula_simade', 'matricula', 'simade').replace(/\D/g, '')
    const existente = tx.lista('pte_alunos').find((a) => a.adesao_id === adesaoId && a.cod_simade === cod)
    tx.salvar('pte_alunos', {
      ...(existente ? { id: existente.id } : {}),
      adesao_id: adesaoId,
      cod_simade: cod,
      nome: coluna(l, 'nome', 'nome_aluno', 'estudante'),
      escola_inep: coluna(l, 'escola_inep', 'inep', 'cod_inep', 'codigo_inep'),
      km_ida: numero(coluna(l, 'km_ida', 'km', 'distancia_km', 'distancia')) || null,
      rota_codigo: coluna(l, 'rota', 'rota_codigo', 'codigo_rota') || null,
      zona: coluna(l, 'zona').toLowerCase() || null,
      turno: coluna(l, 'turno').toLowerCase().replace('ã', 'a') || null,
      origem: existente?.origem ?? 'TER',
      ativo: true,
    })
    return existente ? 'atualizado' : 'incluido'
  })
}

/** Base SIMADE do ciclo. Colunas: matricula/cod_simade, nome, inep/escola_inep, ibge/municipio_ibge, situacao. */
export function importarSimade(usuario: Usuario, cicloId: string, linhas: Record<string, string>[]) {
  return importar(usuario, linhas, (tx, l) => {
    const cod = coluna(l, 'cod_simade', 'matricula_simade', 'matricula', 'simade').replace(/\D/g, '')
    const existente = tx.lista('simade_registros').find((s) => s.ciclo_id === cicloId && s.cod_simade === cod)
    const situacao = coluna(l, 'situacao', 'situacao_matricula').toLowerCase()
    tx.salvar('simade_registros', {
      ...(existente ? { id: existente.id } : {}),
      ciclo_id: cicloId,
      cod_simade: cod,
      nome: coluna(l, 'nome', 'nome_aluno'),
      escola_inep: coluna(l, 'escola_inep', 'inep', 'cod_inep', 'codigo_inep'),
      municipio_ibge: coluna(l, 'municipio_ibge', 'ibge', 'cod_ibge'),
      situacao: ['ativo', 'ativa', 'matriculado', ''].includes(situacao) ? 'ativo' : situacao,
    })
    return existente ? 'atualizado' : 'incluido'
  })
}

/** Rotas do TER/MG. Colunas: rota/codigo, descricao, turno, km_diario, custo_km, passageiros, capacidade, urbana (sim/não). */
export function importarRotas(usuario: Usuario, adesaoId: string, linhas: Record<string, string>[], numero: (v: string) => number) {
  return importar(usuario, linhas, (tx, l) => {
    const codigo = coluna(l, 'rota', 'codigo', 'codigo_rota')
    const existente = tx.lista('rotas_pte').find((r) => r.adesao_id === adesaoId && r.codigo === codigo)
    const sim = (v: string) => ['sim', 's', 'true', '1', 'x'].includes(v.trim().toLowerCase())
    tx.salvar('rotas_pte', {
      ...(existente ? { id: existente.id } : {}),
      adesao_id: adesaoId,
      codigo,
      descricao: coluna(l, 'descricao', 'nome') || null,
      turno: coluna(l, 'turno').toLowerCase().replace('ã', 'a') || null,
      km_diario: numero(coluna(l, 'km_diario', 'km', 'quilometragem')),
      custo_km: numero(coluna(l, 'custo_km', 'valor_km', 'custo')),
      total_passageiros: numero(coluna(l, 'passageiros', 'total_passageiros')),
      capacidade: numero(coluna(l, 'capacidade', 'lotacao')) || null,
      urbana: sim(coluna(l, 'urbana')),
      ativa: true,
    })
    return existente ? 'atualizado' : 'incluido'
  })
}
