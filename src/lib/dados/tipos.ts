// Tipos da camada de dados. Espelham as tabelas previstas em docs/01-proposta-modelo-de-dados.md.

export type Colecao =
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

export const COLECOES: Colecao[] = [
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

export type Papel = 'admin' | 'analista_central' | 'diretor_sre' | 'analista_sre'

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

export interface Base {
  versao: number
  colecoes: Record<Colecao, Registro[]>
  auditoria: EntradaAuditoria[]
}

/** Busca um registro por id — usada pelas regras e permissões para seguir chaves estrangeiras. */
export type Consulta = (colecao: Colecao, id: unknown) => Registro | undefined
