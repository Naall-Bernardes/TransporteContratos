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
  subsecretario: 'Subsecretário(a)',
  diretor_sre: 'Diretor DAFI (SRE)',
  analista_sre: 'Analista SRE',
  municipio: 'Município (prefeitura)',
}

export const ehCentral = (u: Usuario) => u.papel === 'admin' || u.papel === 'analista_central'
export const ehDiretorOuCentral = (u: Usuario) => ehCentral(u) || u.papel === 'diretor_sre'
/** Quem enxerga todas as regionais (órgão central e subsecretário). */
export const veTodasSres = (u: Usuario) => ehCentral(u) || u.papel === 'subsecretario'
/** Usuário da prefeitura: vê e preenche só os dados do PTE do seu município. */
export const ehMunicipio = (u: Usuario) => u.papel === 'municipio'
/** Só o subsecretário autoriza a liberação do recurso. */
export const podeAutorizarLiberacao = (u: Usuario) => u.papel === 'subsecretario'

/** Tabelas com o campo sre_id no próprio registro. */
const SRE_DIRETA: Colecao[] = ['escolas', 'precos_referencia', 'usuarios', 'processos', 'instrumentos', 'demandas', 'adesoes_pte', 'oficios']

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
  oficio_consultas: ['oficio_id', 'oficios'],
  demanda_alunos: ['demanda_id', 'demandas'],
  caracterizacoes: ['demanda_id', 'demandas'],
  caracterizacoes_saude: ['caracterizacao_id', 'caracterizacoes'],
  responsaveis_legais: ['caracterizacao_id', 'caracterizacoes'],
  cotacoes: ['demanda_id', 'demandas'],
  autorizacoes_subsecretario: ['demanda_id', 'demandas'],
  pafs: ['demanda_id', 'demandas'],
  pte_alunos: ['adesao_id', 'adesoes_pte'],
  divergencias: ['adesao_id', 'adesoes_pte'],
  calculos_repasse: ['adesao_id', 'adesoes_pte'],
  demandas_extraordinarias: ['adesao_id', 'adesoes_pte'],
  contratacoes_municipais: ['adesao_id', 'adesoes_pte'],
  rotas_pte: ['adesao_id', 'adesoes_pte'],
  despesas_pte: ['adesao_id', 'adesoes_pte'],
}

/** Configurações de sistema: só o administrador altera. */
const SOMENTE_ADMIN: Colecao[] = ['usuarios', 'tipos_documento', 'etapas_modelo', 'checklist_modelo', 'exigencias_documentais']

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
  'pafs',
  'oficios',
]

export function podeEditarColecao(u: Usuario, colecao: Colecao): boolean {
  if (ehMunicipio(u)) return EDITA_MUNICIPIO.includes(colecao)
  // A decisão de liberação é exclusiva do subsecretário
  if (colecao === 'autorizacoes_subsecretario') return u.papel === 'subsecretario'
  // O subsecretário decide; ao aprovar/devolver, o sistema atualiza a demanda e as etapas
  if (u.papel === 'subsecretario') return colecao === 'demandas' || colecao === 'processo_etapas'
  if (u.papel === 'admin') return true
  if (SOMENTE_ADMIN.includes(colecao)) return false
  if (u.papel === 'analista_central') return true
  return !SOMENTE_CENTRAL.includes(colecao)
}

/** O que o município preenche: contratos, frota, rotas, alunos, despesas, documentos e a prestação de contas. */
const EDITA_MUNICIPIO: Colecao[] = [
  'contratacoes_municipais', 'alocacoes', 'rotas_pte', 'pte_alunos', 'despesas_pte',
  'veiculos', 'condutores', 'transportadores', 'documentos', 'documento_versoes', 'prestacoes_contas',
]

/** Tabelas do PTE que pertencem a um município diretamente (campo municipio_id). */
const MUNICIPIO_DIRETO: Colecao[] = ['adesoes_pte']
/** Tabelas que herdam o município do registro pai. */
const PAI_MUNICIPIO: Partial<Record<Colecao, [string, Colecao]>> = {
  contratacoes_municipais: ['adesao_id', 'adesoes_pte'],
  rotas_pte: ['adesao_id', 'adesoes_pte'],
  pte_alunos: ['adesao_id', 'adesoes_pte'],
  despesas_pte: ['adesao_id', 'adesoes_pte'],
  divergencias: ['adesao_id', 'adesoes_pte'],
  calculos_repasse: ['adesao_id', 'adesoes_pte'],
  demandas_extraordinarias: ['adesao_id', 'adesoes_pte'],
  alocacoes: ['contratacao_id', 'contratacoes_municipais'],
  parcelas: ['instrumento_id', 'instrumentos'],
  prestacoes_contas: ['instrumento_id', 'instrumentos'],
  aditivos: ['instrumento_id', 'instrumentos'],
  fiscalizacoes: ['instrumento_id', 'instrumentos'],
  ocorrencias: ['instrumento_id', 'instrumentos'],
  documentos: ['processo_id', 'processos'],
  documento_versoes: ['documento_id', 'documentos'],
  processo_etapas: ['processo_id', 'processos'],
}
/** Fora do alcance do município (Judicial/MP, ofícios, contratos das Caixas Escolares). */
const NAO_MUNICIPAL = '__nao_municipal__'
const SEM_DONO = '__geral__'

/** Município "dono" do registro, para o perfil Município. */
export function municipioDoRegistro(colecao: Colecao, r: Registro | undefined, consulta: Consulta, profundidade = 0): string {
  if (!r || profundidade > 6) return NAO_MUNICIPAL
  if (MUNICIPIO_DIRETO.includes(colecao)) return String(r.municipio_id ?? NAO_MUNICIPAL)
  if (colecao === 'processos') return r.modulo === 'PTE' ? String(r.municipio_id ?? NAO_MUNICIPAL) : NAO_MUNICIPAL
  if (colecao === 'instrumentos') return r.tipo === 'termo_pte' ? String(r.municipio_id ?? NAO_MUNICIPAL) : NAO_MUNICIPAL
  const pai = PAI_MUNICIPIO[colecao]
  if (pai) {
    const [campo, tabela] = pai
    // documento de veículo/condutor/contratado (sem processo) e alocação sem contratação do município
    if (!r[campo]) return colecao === 'documentos' || colecao === 'documento_versoes' ? SEM_DONO : NAO_MUNICIPAL
    return municipioDoRegistro(tabela, consulta(tabela, r[campo]), consulta, profundidade + 1)
  }
  // registros ligados a SRE (Judicial/MP, ofícios, preços…) ficam de fora; cadastros gerais são visíveis
  const sre = sreDoRegistro(colecao, r, consulta)
  if (sre !== null && colecao !== 'usuarios' && colecao !== 'escolas') return NAO_MUNICIPAL
  return SEM_DONO
}

const SEM_SRE = '__sem_sre__'

/** SRE "dona" do registro. `null` = registro geral, visível a todos. */
export function sreDoRegistro(colecao: Colecao, r: Registro | undefined, consulta: Consulta, profundidade = 0): string | null {
  if (!r || profundidade > 6) return SEM_SRE
  if (SRE_DIRETA.includes(colecao)) {
    // processos/instrumentos/demandas sem SRE ficam restritos ao órgão central
    if (colecao === 'usuarios') return (r.sre_id as string | null) ?? null
    return (r.sre_id as string | null) ?? SEM_SRE
  }
  if (colecao === 'alocacoes')
    return r.instrumento_id
      ? sreDoRegistro('instrumentos', consulta('instrumentos', r.instrumento_id), consulta, profundidade + 1)
      : sreDoRegistro('contratacoes_municipais', consulta('contratacoes_municipais', r.contratacao_id), consulta, profundidade + 1)
  const pai = PAI[colecao]
  if (!pai) return null
  const [campo, tabela] = pai
  // documento de veículo/condutor/contratado não tem processo: é cadastro geral
  if (!r[campo]) return colecao === 'documentos' ? null : SEM_SRE
  return sreDoRegistro(tabela, consulta(tabela, r[campo]), consulta, profundidade + 1)
}

export function podeVer(u: Usuario, colecao: Colecao, r: Registro, consulta: Consulta): boolean {
  if (ehMunicipio(u)) {
    const m = municipioDoRegistro(colecao, r, consulta)
    return m === SEM_DONO || m === u.municipio_id
  }
  if (veTodasSres(u)) return true
  const sre = sreDoRegistro(colecao, r, consulta)
  return sre === null || sre === u.sre_id
}

export function podeEditar(u: Usuario, colecao: Colecao, r: Registro, consulta: Consulta): boolean {
  if (!podeEditarColecao(u, colecao)) return false
  if (ehMunicipio(u)) {
    const m = municipioDoRegistro(colecao, r, consulta)
    // cadastros gerais que o município mantém (veículos, condutores, contratados e seus documentos)
    return m === u.municipio_id || (m === SEM_DONO && ['veiculos', 'condutores', 'transportadores', 'documentos', 'documento_versoes'].includes(colecao))
  }
  if (veTodasSres(u)) return true
  const sre = sreDoRegistro(colecao, r, consulta)
  return sre === null || sre === u.sre_id
}

export const podeVerAuditoria = ehCentral
