// Campos das telas da gestão contratual (mesmo formato dos cadastros).

import { opcoes, type CadastroConfig, type Opcao } from '@/features/cadastros/configuracoes'
import { ROTULO_STATUS_PRESTACAO } from '@/lib/dados/regrasContratos'
import type { ColecaoContrato } from '@/lib/dados/tipos'

export const TIPOS_INSTRUMENTO = opcoes({
  contrato_caixa: 'Contrato Caixa Escolar × transportador (Judicial)',
  termo_pte: 'Termo / convênio Estado × município (PTE)',
})

export const STATUS_INSTRUMENTO = opcoes({
  vigente: 'Vigente',
  suspenso: 'Suspenso',
  encerrado: 'Encerrado',
  rescindido: 'Rescindido',
})

export const SITUACOES_FINAIS = opcoes({
  concluido: 'Concluído regularmente',
  concluido_com_pendencias: 'Concluído com pendências',
  rescindido: 'Rescindido',
})

/** Modalidades de garantia contratual (Lei 14.133/2021, art. 96). */
export const TIPOS_GARANTIA = opcoes({
  sem_garantia: 'Sem garantia',
  caucao_dinheiro: 'Caução em dinheiro',
  caucao_titulos: 'Caução em títulos da dívida pública',
  seguro_garantia: 'Seguro-garantia',
  fianca_bancaria: 'Fiança bancária',
  titulo_capitalizacao: 'Título de capitalização',
})

const STATUS_PRESTACAO: Opcao[] = opcoes(ROTULO_STATUS_PRESTACAO)
const ehContrato = (v: Record<string, unknown>) => v.tipo === 'contrato_caixa'
const ehTermo = (v: Record<string, unknown>) => v.tipo === 'termo_pte'

export const INSTRUMENTO: CadastroConfig = {
  colecao: 'instrumentos',
  titulo: 'Contratos e termos',
  singular: 'instrumento',
  descricao: '',
  ordenarPor: (r) => String(r.vigencia_fim),
  campos: [
    { nome: 'tipo', rotulo: 'Tipo de instrumento', tipo: 'selecao', opcoes: TIPOS_INSTRUMENTO, padrao: 'contrato_caixa' },
    { nome: 'numero', rotulo: 'Nº do instrumento', tipo: 'texto', ajuda: 'Ex.: 012/2026' },
    { nome: 'numero_sei', rotulo: 'Nº do processo SEI', tipo: 'texto', ajuda: 'Ex.: 1260.01.0012345/2026-12' },
    { nome: 'caixa_escolar_id', rotulo: 'Contratante (Caixa Escolar)', tipo: 'referencia', referencia: 'caixas_escolares', visivel: ehContrato, obrigatorioSe: ehContrato },
    { nome: 'transportador_id', rotulo: 'Contratado (transportador)', tipo: 'referencia', referencia: 'transportadores', visivel: ehContrato, obrigatorioSe: ehContrato },
    { nome: 'municipio_id', rotulo: 'Município convenente', tipo: 'referencia', referencia: 'municipios', visivel: ehTermo, obrigatorioSe: ehTermo },
    { nome: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo' },
    { nome: 'data_assinatura', rotulo: 'Data de assinatura', tipo: 'data' },
    { nome: 'dotacao_orcamentaria', rotulo: 'Dotação orçamentária', tipo: 'texto' },
    { nome: 'vigencia_inicio', rotulo: 'Início da vigência', tipo: 'data' },
    { nome: 'vigencia_fim', rotulo: 'Fim da vigência (original)', tipo: 'data', ajuda: 'Prorrogações entram por termo aditivo.' },
    { nome: 'valor_global', rotulo: 'Valor global original (R$)', tipo: 'moeda', ajuda: 'Acréscimos e supressões entram por termo aditivo.' },
    { nome: 'valor_executado', rotulo: 'Valor executado (R$)', tipo: 'moeda', visivel: ehContrato, ajuda: 'Informado manualmente. O saldo é calculado: valor atual − executado.' },
    { nome: 'tipo_garantia', rotulo: 'Tipo de garantia', tipo: 'selecao', opcoes: TIPOS_GARANTIA, padrao: 'sem_garantia', visivel: ehContrato },
    { nome: 'valor_garantia', rotulo: 'Valor da garantia (R$)', tipo: 'moeda', visivel: (v) => ehContrato(v) && !!v.tipo_garantia && v.tipo_garantia !== 'sem_garantia', obrigatorioSe: (v) => ehContrato(v) && !!v.tipo_garantia && v.tipo_garantia !== 'sem_garantia' },
    { nome: 'garantia_vigencia_fim', rotulo: 'Garantia válida até', tipo: 'data', visivel: (v) => ehContrato(v) && !!v.tipo_garantia && v.tipo_garantia !== 'sem_garantia' },
    { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: STATUS_INSTRUMENTO.slice(0, 2), padrao: 'vigente', ajuda: 'Para encerrar, use a aba Encerramento.' },
    { nome: 'gestor_id', rotulo: 'Gestor do instrumento', tipo: 'referencia', referencia: 'usuarios' },
    { nome: 'fiscal_id', rotulo: 'Fiscal do instrumento', tipo: 'referencia', referencia: 'usuarios' },
    {
      nome: 'periodicidade_prestacao',
      rotulo: 'Periodicidade da prestação de contas',
      tipo: 'selecao',
      opcoes: opcoes({ mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual', final: 'Única, ao final da vigência' }),
      padrao: 'final',
    },
    { nome: 'prazo_prestacao_dias', rotulo: 'Prazo para prestar contas (dias após o período)', tipo: 'numero', padrao: 30 },
  ],
}

export const ENCERRAMENTO: CadastroConfig = {
  colecao: 'instrumentos',
  titulo: 'Encerramento',
  singular: 'encerramento',
  descricao: '',
  ordenarPor: () => '',
  campos: [
    { nome: 'encerrado_em', rotulo: 'Data de encerramento', tipo: 'data', obrigatorioSe: () => true },
    { nome: 'situacao_final', rotulo: 'Situação final', tipo: 'selecao', opcoes: SITUACOES_FINAIS, obrigatorioSe: () => true },
    { nome: 'termo_encerramento_sei', rotulo: 'Nº SEI do termo de encerramento', tipo: 'texto' },
    {
      nome: 'pendencias_encerramento',
      rotulo: 'Pendências remanescentes',
      tipo: 'texto_longo',
      obrigatorioSe: (v) => v.situacao_final === 'concluido_com_pendencias',
    },
  ],
}

const DOC_SEI_AJUDA = 'Nº SEI do documento. O upload do arquivo entra com o repositório de documentos (Fase 2).'

export const CONFIGS_CONTRATO: Record<ColecaoContrato, CadastroConfig> = {
  processos: {
    colecao: 'processos',
    titulo: 'Processos',
    singular: 'processo',
    descricao: '',
    ordenarPor: (r) => String(r.codigo),
    campos: [
      { nome: 'codigo', rotulo: 'Código único', tipo: 'texto', naTabela: true },
      { nome: 'numero_sei', rotulo: 'Nº SEI', tipo: 'texto', naTabela: true },
      { nome: 'modulo', rotulo: 'Módulo', tipo: 'texto', naTabela: true },
    ],
  },

  instrumentos: INSTRUMENTO,

  aditivos: {
    colecao: 'aditivos',
    titulo: 'Termos aditivos',
    singular: 'termo aditivo',
    descricao: 'Vigência e valor do instrumento são recalculados automaticamente a cada aditivo.',
    ordenarPor: (r) => String(r.data_assinatura),
    campos: [
      { nome: 'numero', rotulo: 'Nº do aditivo', tipo: 'numero', naTabela: true },
      { nome: 'data_assinatura', rotulo: 'Data de assinatura', tipo: 'data', naTabela: true },
      { nome: 'documento_sei', rotulo: 'Documento SEI', tipo: 'texto', naTabela: true, ajuda: DOC_SEI_AJUDA },
      { nome: 'altera_prazo', rotulo: 'Prorroga o prazo', tipo: 'booleano', padrao: false },
      { nome: 'nova_vigencia_fim', rotulo: 'Nova data de término', tipo: 'data', naTabela: true, visivel: (v) => !!v.altera_prazo, obrigatorioSe: (v) => !!v.altera_prazo },
      { nome: 'altera_valor', rotulo: 'Altera o valor', tipo: 'booleano', padrao: false },
      {
        nome: 'valor_variacao',
        rotulo: 'Acréscimo (+) ou supressão (−) em R$',
        tipo: 'moeda',
        naTabela: true,
        visivel: (v) => !!v.altera_valor,
        obrigatorioSe: (v) => !!v.altera_valor,
        ajuda: 'Use valor negativo para supressão. Ex.: -2500',
      },
      { nome: 'altera_rota_veiculo', rotulo: 'Altera rota ou veículo', tipo: 'booleano', padrao: false, naTabela: true },
      { nome: 'descricao', rotulo: 'Descrição / justificativa', tipo: 'texto_longo', obrigatorioSe: (v) => !!v.altera_rota_veiculo },
    ],
  },

  parcelas: {
    colecao: 'parcelas',
    titulo: 'Execução financeira',
    singular: 'parcela',
    descricao: '',
    ordenarPor: (r) => String(r.numero).padStart(4, '0'),
    campos: [
      { nome: 'numero', rotulo: 'Parcela nº', tipo: 'numero', naTabela: true },
      { nome: 'competencia', rotulo: 'Competência', tipo: 'mes', naTabela: true },
      { nome: 'valor_previsto', rotulo: 'Valor previsto (R$)', tipo: 'moeda', naTabela: true },
      { nome: 'data_prevista', rotulo: 'Data prevista', tipo: 'data', naTabela: true },
      { nome: 'valor_pago', rotulo: 'Valor pago (R$)', tipo: 'moeda', naTabela: true, ajuda: 'Preencha quando o pagamento/repasse for efetivado.' },
      { nome: 'data_pagamento', rotulo: 'Data do pagamento', tipo: 'data', naTabela: true },
      { nome: 'documento_sei', rotulo: 'Documento SEI (NF / OB)', tipo: 'texto', naTabela: true, ajuda: DOC_SEI_AJUDA },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'texto_longo' },
    ],
  },

  fiscalizacoes: {
    colecao: 'fiscalizacoes',
    titulo: 'Fiscalização',
    singular: 'registro de fiscalização',
    descricao: 'Um registro por mês de execução.',
    ordenarPor: (r) => String(r.competencia),
    campos: [
      { nome: 'competencia', rotulo: 'Competência', tipo: 'mes', naTabela: true },
      { nome: 'dias_rodados', rotulo: 'Dias rodados', tipo: 'numero', naTabela: true },
      { nome: 'alunos_transportados', rotulo: 'Alunos transportados', tipo: 'numero', naTabela: true },
      { nome: 'km_rodados', rotulo: 'Km rodados', tipo: 'numero', naTabela: true },
      {
        nome: 'conformidade',
        rotulo: 'Avaliação',
        tipo: 'selecao',
        opcoes: opcoes({ conforme: 'Conforme', ressalvas: 'Conforme com ressalvas', nao_conforme: 'Não conforme' }),
        padrao: 'conforme',
        naTabela: true,
      },
      { nome: 'fiscal_id', rotulo: 'Fiscal', tipo: 'referencia', referencia: 'usuarios', naTabela: true },
      { nome: 'data_registro', rotulo: 'Data do registro', tipo: 'data' },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'texto_longo' },
    ],
  },

  ocorrencias: {
    colecao: 'ocorrencias',
    titulo: 'Ocorrências e notificações',
    singular: 'ocorrência',
    descricao: '',
    ordenarPor: (r) => String(r.data),
    campos: [
      { nome: 'data', rotulo: 'Data', tipo: 'data', naTabela: true },
      {
        nome: 'tipo',
        rotulo: 'Tipo',
        tipo: 'selecao',
        naTabela: true,
        opcoes: opcoes({
          atraso: 'Atraso',
          interrupcao: 'Interrupção do transporte',
          veiculo_irregular: 'Veículo irregular',
          condutor_irregular: 'Condutor irregular',
          superlotacao: 'Superlotação',
          acidente: 'Acidente',
          reclamacao: 'Reclamação',
          outro: 'Outro',
        }),
      },
      { nome: 'gravidade', rotulo: 'Gravidade', tipo: 'selecao', naTabela: true, opcoes: opcoes({ baixa: 'Baixa', media: 'Média', alta: 'Alta' }) },
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', naTabela: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto_longo' },
      { nome: 'providencia', rotulo: 'Providência adotada', tipo: 'texto_longo' },
      {
        nome: 'status',
        rotulo: 'Situação',
        tipo: 'selecao',
        naTabela: true,
        padrao: 'aberta',
        opcoes: opcoes({ aberta: 'Aberta', em_tratamento: 'Em tratamento', resolvida: 'Resolvida' }),
      },
      { nome: 'notificacao_data', rotulo: 'Contratado notificado em', tipo: 'data', naTabela: true, ajuda: 'Deixe em branco se não houve notificação.' },
      { nome: 'notificacao_prazo', rotulo: 'Prazo para resposta', tipo: 'data', visivel: (v) => !!v.notificacao_data },
      { nome: 'notificacao_respondida_em', rotulo: 'Respondida em', tipo: 'data', visivel: (v) => !!v.notificacao_data },
    ],
  },

  prestacoes_contas: {
    colecao: 'prestacoes_contas',
    titulo: 'Prestação de contas',
    singular: 'prestação de contas',
    descricao: '',
    ordenarPor: (r) => String(r.data_limite),
    campos: [
      { nome: 'periodo_referencia', rotulo: 'Período de referência', tipo: 'texto', naTabela: true, ajuda: 'Ex.: 1º semestre/2026' },
      { nome: 'data_limite', rotulo: 'Prazo de entrega', tipo: 'data', naTabela: true },
      { nome: 'data_entrega', rotulo: 'Entregue em', tipo: 'data', naTabela: true, emFormulario: false },
      { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: STATUS_PRESTACAO, naTabela: true, emFormulario: false },
    ],
  },
}

/** Formulários de cada passo do fluxo da prestação de contas. */
export const ACOES_PRESTACAO: Record<string, { rotulo: string; destino?: string; config: CadastroConfig }> = {
  entregar: {
    rotulo: 'Registrar entrega',
    destino: 'em_analise',
    config: { ...CONFIGS_CONTRATO.prestacoes_contas, campos: [{ nome: 'data_entrega', rotulo: 'Entregue em', tipo: 'data', obrigatorioSe: () => true }] },
  },
  diligenciar: {
    rotulo: 'Abrir diligência',
    destino: 'em_diligencia',
    config: {
      ...CONFIGS_CONTRATO.prestacoes_contas,
      campos: [
        { nome: 'diligencia_data', rotulo: 'Data da diligência', tipo: 'data', obrigatorioSe: () => true },
        { nome: 'diligencia_prazo', rotulo: 'Prazo para atendimento', tipo: 'data', obrigatorioSe: () => true },
        { nome: 'diligencia_descricao', rotulo: 'O que deve ser corrigido/complementado', tipo: 'texto_longo', obrigatorioSe: () => true },
      ],
    },
  },
  reapresentar: {
    rotulo: 'Registrar reapresentação',
    destino: 'reapresentada',
    config: { ...CONFIGS_CONTRATO.prestacoes_contas, campos: [{ nome: 'reapresentada_em', rotulo: 'Reapresentada em', tipo: 'data', obrigatorioSe: () => true }] },
  },
  decidir: {
    rotulo: 'Registrar decisão',
    config: {
      ...CONFIGS_CONTRATO.prestacoes_contas,
      campos: [
        { nome: 'status', rotulo: 'Decisão', tipo: 'selecao', opcoes: STATUS_PRESTACAO.slice(4), obrigatorioSe: () => true },
        { nome: 'data_decisao', rotulo: 'Data da decisão', tipo: 'data', obrigatorioSe: () => true },
        { nome: 'analista_id', rotulo: 'Analista responsável', tipo: 'referencia', referencia: 'usuarios', obrigatorioSe: () => true },
        { nome: 'parecer', rotulo: 'Parecer', tipo: 'texto_longo', obrigatorioSe: () => true },
      ],
    },
  },
}
