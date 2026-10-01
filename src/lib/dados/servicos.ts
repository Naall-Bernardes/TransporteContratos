// Operações de negócio que mexem em várias tabelas de uma vez (sempre dentro de uma transação).
// No banco, cada uma vira uma função SQL (RPC) chamada pelo front.

import { calcularSituacao, diasCorridos } from '../contratos/calculos'
import { somarDias, somarMeses } from '../datas'
import { hojeIso } from '../diasUteis'
import { avaliarEtapa, montarDadosProcesso } from '../fluxo/processo'
import { prazoDaEtapa } from '../fluxo/sla'
import { formatarData } from '../formatacao'
import { ehCentral, ehDiretorOuCentral, podeAutorizarLiberacao } from '../permissoes'
import { calcularPrioridade, errosAbertura, errosNecessidade, type DadosAbertura, type NecessidadeTransporte } from '../judicial/abertura'
import { resumoCotacoes } from '../judicial/cotacoes'
import { origemDoOrgao } from '../judicial/oficios'
import { criarProcesso, ErroPermissao, ErroRegra, ErroValidacao, transacao, type Tx } from './repositorio'
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

/** Cadastra um ofício recebido (só o órgão central). Ganha código único OFC-ano-seq e pasta de documentos. */
export function criarOficio(usuario: Usuario, dados: Record<string, unknown>) {
  if (!ehCentral(usuario)) return Promise.reject(new ErroPermissao('Os ofícios são cadastrados pelo órgão central.'))
  return transacao(usuario, (tx) => {
    const processo = criarProcesso(tx, 'OFICIO', {
      ano: Number(String(dados.data_recebimento ?? hojeIso()).slice(0, 4)),
      sre_id: null,
      numero_sei: dados.numero_sei,
    })
    return tx.salvar('oficios', { ...dados, processo_id: processo.id, sre_id: null, responsavel_id: dados.responsavel_id ?? usuario.id })
  })
}

export interface DadosConsulta {
  sre_id: string
  pergunta: string
  prazo: string
}

/** Central pede informação à SRE. A SRE passa a ver o ofício e os documentos dele. */
export function consultarSre(usuario: Usuario, oficioId: string, c: DadosConsulta) {
  if (!ehCentral(usuario)) return Promise.reject(new ErroPermissao('Só o órgão central encaminha pedidos de informação.'))
  return transacao(usuario, (tx) => {
    const oficio = tx.consulta('oficios', oficioId)
    if (!oficio) throw new ErroRegra('Ofício não encontrado.')
    if (oficio.resposta_data) throw new ErroRegra('Este ofício já foi respondido.')
    if (!c.sre_id) throw new ErroRegra('Escolha a SRE.')
    if (oficio.sre_id && oficio.sre_id !== c.sre_id) throw new ErroRegra('Este ofício já foi encaminhado a outra SRE.')
    tx.salvar('oficios', { id: oficio.id, sre_id: c.sre_id })
    tx.salvar('processos', { id: oficio.processo_id, sre_id: c.sre_id })
    return tx.salvar('oficio_consultas', {
      oficio_id: oficio.id,
      pergunta: c.pergunta?.trim() || null,
      prazo: c.prazo,
      solicitada_em: hojeIso(),
      solicitada_por: usuario.id,
      status: 'pendente',
    })
  })
}

/** A SRE (ou o central) registra a informação solicitada. */
export function responderConsulta(usuario: Usuario, consultaId: string, resposta: string) {
  return transacao(usuario, (tx) => {
    const c = tx.consulta('oficio_consultas', consultaId)
    if (!c || c.status !== 'pendente') throw new ErroRegra('Este pedido não está aguardando resposta.')
    return tx.salvar('oficio_consultas', { id: c.id, resposta: resposta?.trim() || null, respondida_em: hojeIso(), respondida_por: usuario.id, status: 'respondida' })
  })
}

export interface DadosResposta {
  resposta_numero: string
  resposta_data: string
  resposta_resumo?: string
}

/** Registra a resposta enviada ao órgão (encerra o controle do ofício). */
export function registrarRespostaOficio(usuario: Usuario, oficioId: string, r: DadosResposta) {
  if (!ehCentral(usuario)) return Promise.reject(new ErroPermissao('A resposta é registrada pelo órgão central.'))
  return transacao(usuario, (tx) => {
    const pendente = tx.lista('oficio_consultas').some((c) => c.oficio_id === oficioId && c.status === 'pendente')
    if (pendente) throw new ErroRegra('Há pedido de informação à SRE ainda sem resposta.')
    return tx.salvar('oficios', { id: oficioId, resposta_numero: r.resposta_numero?.trim() || null, resposta_data: r.resposta_data || null, resposta_resumo: r.resposta_resumo?.trim() || null })
  })
}

/**
 * Cadastra a demanda de transporte a partir de um ofício de intimação: cria a demanda (código JUD-ano-SRE-seq)
 * com os dados do ofício, inclui os alunos (criando no cadastro os que não existem) e abre a primeira etapa
 * (Detalhamento da demanda) com o responsável da SRE, que completa a necessidade de transporte de cada aluno.
 */
export function abrirDemandaTransporte(usuario: Usuario, oficioId: string, d: DadosAbertura) {
  if (!ehCentral(usuario)) return Promise.reject(new ErroPermissao('A demanda é cadastrada pelo órgão central.'))
  const erros = errosAbertura(d)
  if (Object.keys(erros).length) return Promise.reject(new ErroValidacao({ ...erros, _geral: 'Há campos obrigatórios sem preencher. Revise os blocos destacados.' }))
  return transacao(usuario, (tx) => {
    const oficio = tx.consulta('oficios', oficioId)
    if (!oficio) throw new ErroRegra('Ofício não encontrado.')
    if (oficio.tipo !== 'intimacao_cumprimento') throw new ErroRegra('Só ofício de intimação para cumprimento abre uma demanda de transporte.')
    if (oficio.demanda_id) throw new ErroRegra('Este ofício já tem demanda de transporte cadastrada.')
    if (!oficio.numero_processo_judicial || !oficio.comarca) throw new ErroRegra('Preencha no ofício o nº do processo judicial e a comarca.')
    const escola = tx.consulta('escolas', d.escola_id)
    if (!escola) throw new ErroRegra('Escolha a escola estadual.')
    const numeroSei = oficio.numero_sei || tx.consulta('processos', oficio.processo_id)?.numero_sei || null
    const processo = criarProcesso(tx, 'JUDICIAL', { ano: Number(String(oficio.data_recebimento).slice(0, 4)), sre_id: escola.sre_id, numero_sei: numeroSei })
    const origem = origemDoOrgao(oficio.orgao_tipo)
    const hoje = hojeIso()
    const { alunos, ...campos } = d
    const demanda = tx.salvar('demandas', {
      ...campos,
      data_termino_prevista: d.prazo_indeterminado ? null : d.data_termino_prevista,
      processo_id: processo.id,
      origem,
      origem_outro: origem === 'outro' ? String(oficio.orgao_nome || oficio.orgao_tipo) : null,
      numero_processo_origem: oficio.numero_processo_judicial,
      comarca: oficio.comarca,
      orgao: oficio.orgao_nome ?? null,
      data_recebimento: oficio.data_recebimento,
      prioridade: calcularPrioridade({ ...d, origem }, hoje, feriadosDe(tx.lista)),
      situacao: 'ativa',
    })
    for (const a of alunos) {
      const alunoId = a.aluno_id ? a.aluno_id : tx.salvar('alunos', { ...a.novo, cpf: a.novo?.cpf || null, escola_atual_id: escola.id, ativo: true }).id
      const da = tx.salvar('demanda_alunos', { demanda_id: demanda.id, aluno_id: alunoId, incluido_em: hoje })
      // formulário de caracterização em rascunho: a necessidade de transporte vem no Detalhamento (SRE/escola)
      tx.salvar('caracterizacoes', {
        demanda_id: demanda.id,
        demanda_aluno_id: da.id,
        status: 'rascunho',
        data_inicio_pretendida: d.data_inicio_prevista,
        periodo_atendimento: d.prazo_indeterminado ? 'ate_nova_decisao' : 'outro',
      })
    }
    tx.salvar('oficios', { id: oficio.id, demanda_id: demanda.id })
    iniciarEtapa(tx, processo.id, modelosDo(tx, 'JUDICIAL')[0], d.responsavel_sre_id ?? null)
    return demanda
  })
}

/**
 * Detalhamento da demanda: grava a necessidade de transporte de um aluno no formulário de caracterização
 * (turno, horários, dias, endereço, viagem), na saúde (acessibilidade, cadeira, acompanhante) e no responsável legal.
 */
export function salvarNecessidadeTransporte(usuario: Usuario, caracterizacaoId: string, n: NecessidadeTransporte) {
  const erros = errosNecessidade(n)
  if (Object.keys(erros).length) return Promise.reject(new ErroValidacao({ ...erros, _geral: 'Preencha os campos obrigatórios.' }))
  return transacao(usuario, (tx) => {
    const car = tx.consulta('caracterizacoes', caracterizacaoId)
    if (!car) throw new ErroRegra('Formulário não encontrado.')
    if (car.status === 'aprovada') throw new ErroRegra('A caracterização já foi aprovada; peça a reabertura para alterar.')
    const requisitos = new Set((Array.isArray(car.requisitos) ? car.requisitos : []) as string[])
    for (const [r, ligado] of [['veiculo_acessivel', n.veiculo_acessivel], ['acompanhante', n.acompanhante]] as const) {
      if (ligado) requisitos.add(r)
      else requisitos.delete(r)
    }
    tx.salvar('caracterizacoes', {
      id: car.id,
      turno: n.turno,
      horario_entrada: n.horario_entrada,
      horario_saida: n.horario_saida,
      dias_semana: n.dias_semana,
      endereco_residencia: n.endereco_origem,
      sentido_viagem: n.viagem,
      viagens_dia: n.viagem === 'ida_volta' ? '2' : 'outro',
      condicoes_transporte: n.outras_condicoes?.trim() || null,
      requisitos: requisitos.size ? [...requisitos] : null,
    })
    const pcd = Boolean(n.veiculo_acessivel || n.cadeira_rodas)
    const saude = tx.lista('caracterizacoes_saude').find((x) => x.caracterizacao_id === car.id)
    tx.salvar('caracterizacoes_saude', {
      ...(saude ? { id: saude.id } : { caracterizacao_id: car.id }),
      pcd_mobilidade_reduzida: pcd,
      pcd_especificacao: pcd ? (saude?.pcd_especificacao || 'Necessita veículo acessível (informado no detalhamento). Detalhar e anexar laudo.') : null,
      dispositivo_mobilidade: n.cadeira_rodas ? (saude?.dispositivo_mobilidade && saude.dispositivo_mobilidade !== 'nenhum' ? saude.dispositivo_mobilidade : 'outro') : 'nenhum',
      necessita_rampa_plataforma: Boolean(n.cadeira_rodas),
      necessita_acompanhante: Boolean(n.acompanhante),
    })
    const resp = tx.lista('responsaveis_legais').find((x) => x.caracterizacao_id === car.id)
    tx.salvar('responsaveis_legais', { ...(resp ? { id: resp.id } : { caracterizacao_id: car.id }), nome: n.responsavel_nome.trim() })
  })
}

/**
 * Escolha do transporte: marca a cotação escolhida (desmarca as demais). Se não for a de menor valor,
 * a justificativa é obrigatória e fica registrada na demanda.
 */
export function escolherCotacao(usuario: Usuario, cotacaoId: string, justificativa?: string) {
  return transacao(usuario, (tx) => {
    const escolhida = tx.consulta('cotacoes', cotacaoId)
    if (!escolhida) throw new ErroRegra('Cotação não encontrada.')
    const todas = tx.lista('cotacoes').filter((c) => c.demanda_id === escolhida.demanda_id)
    const r = resumoCotacoes(todas.map((c) => ({ ...c, escolhida: c.id === cotacaoId })))
    if (r.escolhidaNaoEhMenor && !justificativa?.trim()) throw new ErroValidacao({ justificativa: 'Justifique por que não foi escolhida a de menor valor.', _geral: 'Justifique por que não foi escolhida a de menor valor.' })
    for (const c of todas) if (Boolean(c.escolhida) !== (c.id === cotacaoId)) tx.salvar('cotacoes', { id: c.id, escolhida: c.id === cotacaoId })
    tx.salvar('demandas', { id: escolhida.demanda_id, justificativa_cotacao: r.escolhidaNaoEhMenor ? justificativa!.trim() : null })
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
 * ou devolve a demanda para ajuste (volta à Escolha do transporte, de onde vem o valor).
 */
export function decidirAutorizacao(usuario: Usuario, demandaId: string, d: DecisaoAutorizacao) {
  if (!podeAutorizarLiberacao(usuario)) return Promise.reject(new ErroPermissao('Só o(a) subsecretário(a) autoriza a liberação do recurso.'))
  return transacao(usuario, (tx) => {
    const demanda = tx.consulta('demandas', demandaId)!
    const { modelo, instancia } = etapaEmAndamento(tx, demanda.processo_id, 'C02')
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
      // Devolução: a Autorização fica registrada como devolvida e a Escolha do transporte é reaberta
      tx.salvar('processo_etapas', { id: instancia.id, status: 'devolvida', concluida_em: hojeIso() })
      const volta = tx.lista('etapas_modelo').find((m) => m.codigo === 'C06')!
      iniciarEtapa(tx, String(demanda.processo_id), volta, demanda.responsavel_sre_id ?? null)
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
    const { modelo, instancia } = etapaEmAndamento(tx, demanda.processo_id, 'C03')
    if (!modelo || !instancia) throw new ErroRegra('A demanda não está na etapa de registro do PAF.')
    const paf = tx.salvar('pafs', { demanda_id: demandaId, ...p })
    avancarDaEtapa(tx, usuario, instancia, modelo)
    return paf
  })
}

// ---------- PTE ----------
// O fluxo de adesão/cálculo é feito em outro sistema. Aqui o Estado registra o termo de repasse
// (valor pré-determinado e cronograma) e o município informa como executa o transporte.

export interface DadosTermoRepasse {
  municipio_id: string
  ano: number
  numero: string
  numero_sei: string
  data_assinatura: string
  vigencia_inicio: string
  vigencia_fim: string
  valor_global: number
  num_parcelas: number
  primeira_parcela: string
  dotacao_orcamentaria: string
  gestor_id: string
  fiscal_id: string
}

/** Cria o termo de repasse ao município: processo PTE, vínculo do município ao ano, termo, parcelas e prestação anual. */
export function criarTermoRepasse(usuario: Usuario, t: DadosTermoRepasse) {
  if (!ehCentral(usuario)) return Promise.reject(new ErroPermissao('O termo de repasse é cadastrado pelo órgão central.'))
  return transacao(usuario, (tx) => {
    const municipio = tx.consulta('municipios', t.municipio_id)
    if (!municipio) throw new ErroRegra('Escolha o município.')
    const ano = Number(t.ano)
    if (!ano) throw new ErroRegra('Informe o ano.')
    const parcelas = Number(t.num_parcelas)
    if (!parcelas || parcelas < 1 || parcelas > 12) throw new ErroValidacao({ num_parcelas: 'Informe de 1 a 12 parcelas.' })
    if (!t.primeira_parcela) throw new ErroValidacao({ primeira_parcela: 'Informe a data da 1ª parcela.' })
    const ciclo = tx.lista('ciclos_pte').find((c) => Number(c.ano) === ano) ?? tx.salvar('ciclos_pte', { ano, status: 'aprovado', dias_letivos: 200, num_parcelas: parcelas, vigencia_inicio: t.vigencia_inicio, vigencia_fim: t.vigencia_fim })
    if (tx.lista('adesoes_pte').some((a) => a.ciclo_id === ciclo.id && a.municipio_id === municipio.id)) throw new ErroRegra(`${municipio.nome} já tem termo de repasse em ${ano}.`)
    const processo = criarProcesso(tx, 'PTE', { ano, sre_id: municipio.sre_id, municipio_id: municipio.id, numero_sei: t.numero_sei })
    const adesao = tx.salvar('adesoes_pte', { processo_id: processo.id, ciclo_id: ciclo.id, municipio_id: municipio.id, data_adesao: t.data_assinatura, status: 'execucao', numero_sei: t.numero_sei })
    const inst = tx.salvar('instrumentos', {
      tipo: 'termo_pte',
      processo_id: processo.id,
      municipio_id: municipio.id,
      numero: t.numero,
      numero_sei: t.numero_sei,
      objeto: `Repasse PTE/MG ${ano} ao município de ${municipio.nome} para transporte de estudantes da rede estadual.`,
      data_assinatura: t.data_assinatura,
      vigencia_inicio: t.vigencia_inicio,
      vigencia_fim: t.vigencia_fim,
      valor_global: t.valor_global,
      dotacao_orcamentaria: t.dotacao_orcamentaria,
      gestor_id: t.gestor_id,
      fiscal_id: t.fiscal_id,
      status: 'vigente',
      periodicidade_prestacao: 'anual',
      prazo_prestacao_dias: 60,
    })
    criarParcelas(tx, inst, parcelas, t.primeira_parcela, 1)
    // Prestação de contas anual até 28/02 do ano seguinte (Res. 5.267/2026, art. 19, II)
    tx.salvar('prestacoes_contas', { instrumento_id: inst.id, periodo_referencia: `Exercício ${ano}`, data_limite: `${ano + 1}-02-28`, status: 'pendente' })
    return adesao
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
