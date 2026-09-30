import { opcoes, type CadastroConfig } from '@/features/cadastros/configuracoes'
import { ROTULO_DIVERGENCIA } from '@/lib/pte/pte'

export const STATUS_CICLO = opcoes({
  planejamento: 'Planejamento',
  adesao: 'Adesão aberta',
  calculo: 'Em cálculo',
  aprovado: 'Aprovado',
  encerrado: 'Encerrado',
})

export const STATUS_ADESAO = opcoes({
  aderido: 'Aderido / cadastro da demanda',
  definicao_repasse: 'Definição e repasse',
  execucao: 'Execução e monitoramento',
  prestacao: 'Prestação de contas',
  encerrado: 'Encerrado',
})

export const CICLO: CadastroConfig = {
  colecao: 'ciclos_pte',
  titulo: 'Ciclos do PTE',
  singular: 'ciclo',
  descricao: '',
  ordenarPor: (r) => String(r.ano),
  campos: [
    { secao: 'Ciclo', nome: 'ano', rotulo: 'Ano', tipo: 'numero' },
    { secao: 'Ciclo', nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: STATUS_CICLO, padrao: 'planejamento' },
    { secao: 'Parâmetros de cálculo (provisórios)', nome: 'valor_por_aluno', rotulo: 'Valor por aluno/ano (R$)', tipo: 'moeda' },
    { secao: 'Parâmetros de cálculo (provisórios)', nome: 'valor_por_km', rotulo: 'Valor por km (R$)', tipo: 'moeda' },
    { secao: 'Parâmetros de cálculo (provisórios)', nome: 'dias_letivos', rotulo: 'Dias letivos', tipo: 'numero' },
    { secao: 'Parâmetros de cálculo (provisórios)', nome: 'num_parcelas', rotulo: 'Nº de parcelas de repasse', tipo: 'numero' },
    { secao: 'Cronograma', nome: 'data_abertura', rotulo: 'Abertura do ciclo', tipo: 'data' },
    { secao: 'Cronograma', nome: 'data_fim_adesao', rotulo: 'Fim das adesões', tipo: 'data' },
    { secao: 'Cronograma', nome: 'vigencia_inicio', rotulo: 'Início da execução', tipo: 'data' },
    { secao: 'Cronograma', nome: 'vigencia_fim', rotulo: 'Fim da execução', tipo: 'data' },
    { secao: 'Cronograma', nome: 'observacao', rotulo: 'Observação', tipo: 'texto_longo' },
  ],
}

export const ADESAO: CadastroConfig = {
  colecao: 'adesoes_pte',
  titulo: 'Adesão',
  singular: 'adesão',
  descricao: '',
  ordenarPor: () => '',
  campos: [
    { nome: 'municipio_id', rotulo: 'Município', tipo: 'referencia', referencia: 'municipios' },
    { nome: 'data_adesao', rotulo: 'Data da adesão', tipo: 'data' },
    { nome: 'numero_sei', rotulo: 'Nº do processo SEI', tipo: 'texto' },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'texto_longo' },
  ],
}

export const PTE_ALUNO: CadastroConfig = {
  colecao: 'pte_alunos',
  titulo: 'Alunos informados (TER/MG)',
  singular: 'aluno',
  descricao: '',
  ordenarPor: (r) => String(r.nome),
  campos: [
    { nome: 'cod_simade', rotulo: 'Matrícula SIMADE', tipo: 'texto', naTabela: true },
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
    { nome: 'escola_inep', rotulo: 'Escola (INEP)', tipo: 'texto', naTabela: true },
    { nome: 'km_ida', rotulo: 'Km (só ida)', tipo: 'numero', naTabela: true },
    { nome: 'zona', rotulo: 'Zona', tipo: 'selecao', opcoes: opcoes({ rural: 'Rural', urbana: 'Urbana' }), naTabela: true },
    { nome: 'turno', rotulo: 'Turno', tipo: 'selecao', opcoes: opcoes({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' }), naTabela: true },
    { nome: 'origem', rotulo: 'Origem', tipo: 'selecao', opcoes: opcoes({ TER: 'Lista TER', manual: 'Manual', extraordinaria: 'Inclusão extraordinária' }), padrao: 'manual', naTabela: true },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano', padrao: true, naTabela: true },
  ],
}

export const DIVERGENCIA: CadastroConfig = {
  colecao: 'divergencias',
  titulo: 'Divergências TER × SIMADE',
  singular: 'divergência',
  descricao: '',
  ordenarPor: (r) => `${r.status === 'aberta' ? 0 : 1}${r.cod_simade}`,
  campos: [
    { nome: 'cod_simade', rotulo: 'Matrícula', tipo: 'texto', naTabela: true, emFormulario: false },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'selecao', opcoes: opcoes(ROTULO_DIVERGENCIA), naTabela: true, emFormulario: false },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', naTabela: true, emFormulario: false },
    { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: opcoes({ aberta: 'Aberta', justificada: 'Justificada', corrigida: 'Corrigida' }), naTabela: true },
    { nome: 'resolucao', rotulo: 'Justificativa / resolução', tipo: 'texto_longo', naTabela: true, obrigatorioSe: (v) => v.status === 'justificada' },
  ],
}

export const DEMANDA_EXTRA: CadastroConfig = {
  colecao: 'demandas_extraordinarias',
  titulo: 'Demandas extraordinárias',
  singular: 'demanda extraordinária',
  descricao: 'Inclusão de aluno no meio do ano ou pedido de reanálise do repasse.',
  ordenarPor: (r) => String(r.data_solicitacao),
  campos: [
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'selecao', opcoes: opcoes({ inclusao_aluno: 'Inclusão de aluno', reanalise_repasse: 'Reanálise do repasse' }), naTabela: true },
    { nome: 'data_solicitacao', rotulo: 'Solicitada em', tipo: 'data', naTabela: true },
    { nome: 'qtd_alunos', rotulo: 'Nº de alunos', tipo: 'numero', naTabela: true, visivel: (v) => v.tipo === 'inclusao_aluno' },
    { nome: 'valor_impacto', rotulo: 'Impacto no repasse (R$)', tipo: 'moeda', naTabela: true },
    { nome: 'justificativa', rotulo: 'Justificativa do município', tipo: 'texto_longo' },
    { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: opcoes({ solicitada: 'Solicitada', deferida: 'Deferida', indeferida: 'Indeferida' }), padrao: 'solicitada', naTabela: true },
    { nome: 'data_decisao', rotulo: 'Decisão em', tipo: 'data', visivel: (v) => v.status !== 'solicitada', obrigatorioSe: (v) => v.status !== 'solicitada' },
    { nome: 'parecer', rotulo: 'Parecer', tipo: 'texto_longo', visivel: (v) => v.status !== 'solicitada', obrigatorioSe: (v) => v.status !== 'solicitada' },
  ],
}

export const GERAR_TERMO: CadastroConfig = {
  colecao: 'instrumentos',
  titulo: 'Gerar termo',
  singular: 'termo',
  descricao: '',
  ordenarPor: () => '',
  campos: [
    { nome: 'numero', rotulo: 'Nº do termo', tipo: 'texto', obrigatorioSe: () => true },
    { nome: 'numero_sei', rotulo: 'Nº do processo SEI', tipo: 'texto', obrigatorioSe: () => true },
    { nome: 'data_assinatura', rotulo: 'Data de assinatura', tipo: 'data', obrigatorioSe: () => true },
    { nome: 'dotacao_orcamentaria', rotulo: 'Dotação orçamentária', tipo: 'texto', obrigatorioSe: () => true },
    { nome: 'gestor_id', rotulo: 'Gestor', tipo: 'referencia', referencia: 'usuarios', obrigatorioSe: () => true },
    { nome: 'fiscal_id', rotulo: 'Fiscal', tipo: 'referencia', referencia: 'usuarios', obrigatorioSe: () => true },
  ],
}
