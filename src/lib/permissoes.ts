// Quem vê e quem edita cada tabela.
// No modo demonstração estas regras rodam no navegador; ao conectar o Supabase
// elas viram políticas de Row Level Security (RLS) no banco.
//
// Princípio: cada registro "pertence" a uma SRE — diretamente (campo sre_id) ou
// herdando do registro pai (ex.: parcela → instrumento → SRE). Registros sem SRE
// (cadastros gerais e configurações) são visíveis a todos.

import type { Colecao, Consulta, Papel, Registro, Usuario } from './dados/tipos'

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  analista_central: 'Analista do órgão central',
  diretor_sre: 'Diretor DAFI (SRE)',
  analista_sre: 'Analista SRE',
}

export const ehCentral = (u: Usuario) => u.papel === 'admin' || u.papel === 'analista_central'
export const ehDiretorOuCentral = (u: Usuario) => ehCentral(u) || u.papel === 'diretor_sre'

/** Tabelas com o campo sre_id no próprio registro. */
const SRE_DIRETA: Colecao[] = ['escolas', 'precos_referencia', 'usuarios', 'processos', 'instrumentos', 'demandas', 'adesoes_pte', 'alertas']

/** Tabelas que herdam a SRE do registro pai: [campo da chave estrangeira, tabela pai]. */
const PAI: Partial<Record<Colecao, [string, Colecao]>> = {
  caixas_escolares: ['escola_id', 'escolas'],
  alunos: ['escola_atual_id', 'escolas'],
  aditivos: ['instrumento_id', 'instrumentos'],
  parcelas: ['instrumento_id', 'instrumentos'],
  fiscalizacoes: ['instrumento_id', 'instrumentos'],
  ocorrencias: ['instrumento_id', 'instrumentos'],
  prestacoes_contas: ['instrumento_id', 'instrumentos'],
  documentos: ['processo_id', 'processos'],
  documento_versoes: ['documento_id', 'documentos'],
  processo_etapas: ['processo_id', 'processos'],
  demanda_alunos: ['demanda_id', 'demandas'],
  caracterizacoes: ['demanda_id', 'demandas'],
  caracterizacoes_saude: ['caracterizacao_id', 'caracterizacoes'],
  responsaveis_legais: ['caracterizacao_id', 'caracterizacoes'],
  cotacoes: ['demanda_id', 'demandas'],
  autorizacoes_financeiras: ['demanda_id', 'demandas'],
  liberacoes_recurso: ['demanda_id', 'demandas'],
  pte_alunos: ['adesao_id', 'adesoes_pte'],
  divergencias: ['adesao_id', 'adesoes_pte'],
  calculos_repasse: ['adesao_id', 'adesoes_pte'],
  demandas_extraordinarias: ['adesao_id', 'adesoes_pte'],
  risco_ocorrencias: ['processo_id', 'processos'],
}

/** Configurações de sistema: só o administrador altera. */
const SOMENTE_ADMIN: Colecao[] = ['usuarios', 'tipos_documento', 'etapas_modelo', 'checklist_modelo']

/** Só o órgão central altera (a SRE apenas consulta). */
const SOMENTE_CENTRAL: Colecao[] = [
  'sres',
  'municipios',
  'escolas',
  'tipos_veiculo',
  'precos_referencia',
  'feriados',
  'ciclos_pte',
  'simade_registros',
  'calculos_repasse',
  'autorizacoes_financeiras',
  'liberacoes_recurso',
  'riscos',
  'alertas',
]

export function podeEditarColecao(u: Usuario, colecao: Colecao): boolean {
  if (u.papel === 'admin') return true
  if (SOMENTE_ADMIN.includes(colecao)) return false
  if (u.papel === 'analista_central') return true
  return !SOMENTE_CENTRAL.includes(colecao)
}

const SEM_SRE = '__sem_sre__'

/** SRE "dona" do registro. `null` = registro geral, visível a todos. */
export function sreDoRegistro(colecao: Colecao, r: Registro | undefined, consulta: Consulta, profundidade = 0): string | null {
  if (!r || profundidade > 6) return SEM_SRE
  if (SRE_DIRETA.includes(colecao)) {
    // processos/instrumentos/demandas sem SRE ficam restritos ao órgão central
    if (colecao === 'usuarios' || colecao === 'alertas') return (r.sre_id as string | null) ?? null
    return (r.sre_id as string | null) ?? SEM_SRE
  }
  const pai = PAI[colecao]
  if (!pai) return null
  const [campo, tabela] = pai
  if (!r[campo]) return colecao === 'risco_ocorrencias' ? null : SEM_SRE
  return sreDoRegistro(tabela, consulta(tabela, r[campo]), consulta, profundidade + 1)
}

export function podeVer(u: Usuario, colecao: Colecao, r: Registro, consulta: Consulta): boolean {
  if (ehCentral(u)) return true
  const sre = sreDoRegistro(colecao, r, consulta)
  return sre === null || sre === u.sre_id
}

export function podeEditar(u: Usuario, colecao: Colecao, r: Registro, consulta: Consulta): boolean {
  if (!podeEditarColecao(u, colecao)) return false
  if (ehCentral(u)) return true
  const sre = sreDoRegistro(colecao, r, consulta)
  return sre === null || sre === u.sre_id
}

export const podeVerAuditoria = ehCentral
