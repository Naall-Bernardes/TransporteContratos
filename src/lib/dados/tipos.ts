// Tipos da camada de dados. Espelham as tabelas previstas em docs/01-proposta-modelo-de-dados.md.

export type ColecaoCadastro =
  | 'sres'
  | 'municipios'
  | 'escolas'
  | 'caixas_escolares'
  | 'alunos'
  | 'transportadores'
  | 'tipos_veiculo'
  | 'precos_referencia'
  | 'feriados'
  | 'usuarios'

/** Gestão contratual. `processos` é a tabela-eixo que guarda o código único e o nº SEI. */
export type ColecaoContrato =
  | 'processos'
  | 'instrumentos'
  | 'aditivos'
  | 'parcelas'
  | 'fiscalizacoes'
  | 'ocorrencias'
  | 'prestacoes_contas'

/** Repositório de documentos (Fase 2). */
export type ColecaoDocumento = 'tipos_documento' | 'documentos' | 'documento_versoes'

/** Motor de fluxo compartilhado (etapas, SLA, checklist). */
export type ColecaoFluxo = 'etapas_modelo' | 'checklist_modelo' | 'processo_etapas'

/** Módulo Judicial/MP (Fase 4). */
export type ColecaoJudicial =
  | 'demandas'
  | 'demanda_alunos'
  | 'caracterizacoes'
  | 'caracterizacoes_saude'
  | 'responsaveis_legais'
  | 'autorizacoes_subsecretario'
  | 'pafs'

/** Módulo PTE (Fase 5). */
export type ColecaoPte =
  | 'ciclos_pte'
  | 'adesoes_pte'
  | 'pte_alunos'
  | 'simade_registros'
  | 'divergencias'
  | 'calculos_repasse'
  | 'demandas_extraordinarias'

/**
 * Frota e conformidade legal: veículos, condutores/monitores, quem roda em qual contrato
 * (alocações) e o catálogo de documentos obrigatórios (CTB, CONTRAN, DETRAN, SEE).
 * PTE: contratações feitas pelo município, rotas do TER/MG e despesas do município.
 */
export type ColecaoFrota =
  | 'veiculos'
  | 'condutores'
  | 'alocacoes'
  | 'exigencias_documentais'
  | 'contratacoes_municipais'
  | 'rotas_pte'
  | 'despesas_pte'

export type Colecao = ColecaoCadastro | ColecaoContrato | ColecaoDocumento | ColecaoFluxo | ColecaoJudicial | ColecaoPte | ColecaoFrota

export const COLECOES_CADASTRO: ColecaoCadastro[] = [
  'sres',
  'municipios',
  'escolas',
  'caixas_escolares',
  'alunos',
  'transportadores',
  'tipos_veiculo',
  'precos_referencia',
  'feriados',
  'usuarios',
]

export const COLECOES_CONTRATO: ColecaoContrato[] = [
  'processos',
  'instrumentos',
  'aditivos',
  'parcelas',
  'fiscalizacoes',
  'ocorrencias',
  'prestacoes_contas',
]

export const COLECOES_MODULOS: (ColecaoDocumento | ColecaoFluxo | ColecaoJudicial | ColecaoPte | ColecaoFrota)[] = [
  'tipos_documento',
  'documentos',
  'documento_versoes',
  'etapas_modelo',
  'checklist_modelo',
  'processo_etapas',
  'demandas',
  'demanda_alunos',
  'caracterizacoes',
  'caracterizacoes_saude',
  'responsaveis_legais',
  'autorizacoes_subsecretario',
  'pafs',
  'ciclos_pte',
  'adesoes_pte',
  'pte_alunos',
  'simade_registros',
  'divergencias',
  'calculos_repasse',
  'demandas_extraordinarias',
  'veiculos',
  'condutores',
  'alocacoes',
  'exigencias_documentais',
  'contratacoes_municipais',
  'rotas_pte',
  'despesas_pte',
]

export const COLECOES: Colecao[] = [...COLECOES_CADASTRO, ...COLECOES_CONTRATO, ...COLECOES_MODULOS]

/** Coleções "filhas" de um instrumento (ligadas por instrumento_id). */
export const FILHAS_INSTRUMENTO: ColecaoContrato[] = [
  'aditivos',
  'parcelas',
  'fiscalizacoes',
  'ocorrencias',
  'prestacoes_contas',
]

export type Papel = 'admin' | 'analista_central' | 'subsecretario' | 'diretor_sre' | 'analista_sre'

export interface Registro {
  id: string
  criado_em: string
  criado_por: string | null
  atualizado_em: string
  atualizado_por: string | null
  [campo: string]: unknown
}

export interface Usuario extends Registro {
  nome: string
  email: string
  papel: Papel
  sre_id: string | null
  ativo: boolean
}

export type Operacao = 'INSERT' | 'UPDATE' | 'DELETE'

export interface EntradaAuditoria {
  id: string
  colecao: Colecao
  registro_id: string
  operacao: Operacao
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  usuario_id: string
  usuario_nome: string
  em: string
}

/** Registro de quem visualizou/baixou documento ou dado pessoal sensível (LGPD). */
export interface EntradaAcesso {
  id: string
  acao: 'visualizar' | 'baixar' | 'zip' | 'dados_sensiveis'
  descricao: string
  processo_id: string | null
  documento_versao_id: string | null
  usuario_id: string
  usuario_nome: string
  em: string
}

export interface Base {
  versao: number
  colecoes: Record<Colecao, Registro[]>
  auditoria: EntradaAuditoria[]
  acessos: EntradaAcesso[]
}

/** Busca um registro por id — usada pelas regras e permissões para seguir chaves estrangeiras. */
export type Consulta = (colecao: Colecao, id: unknown) => Registro | undefined
