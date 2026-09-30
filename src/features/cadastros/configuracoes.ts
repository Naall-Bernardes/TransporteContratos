// Definição das telas de cadastro. Uma tela genérica (CadastroPage) lê esta
// configuração e monta a tabela, a busca, o formulário e a exportação CSV.
// Para incluir um campo novo: acrescente-o aqui e, se for obrigatório/único,
// também em src/lib/dados/regras.ts.

import { ROTULO_PAPEL } from '@/lib/permissoes'
import type { Colecao, Registro } from '@/lib/dados/tipos'

export type TipoCampo =
  | 'texto'
  | 'texto_longo'
  | 'numero'
  | 'moeda'
  | 'data'
  | 'email'
  | 'selecao'
  | 'referencia'
  | 'booleano'
  | 'cpf_cnpj'

export interface Opcao {
  valor: string
  rotulo: string
}

export interface CampoConfig {
  nome: string
  rotulo: string
  tipo: TipoCampo
  opcoes?: Opcao[]
  referencia?: Colecao
  ajuda?: string
  /** Aparece como coluna na listagem. */
  naTabela?: boolean
  /** false = campo calculado pelo sistema (só aparece na tabela). */
  emFormulario?: boolean
  maxLength?: number
  padrao?: unknown
  /** Mostra o campo só em certas condições (ex.: município só para feriado municipal). */
  visivel?: (valores: Record<string, unknown>) => boolean
  /** Obrigatório só em certas condições. */
  obrigatorioSe?: (valores: Record<string, unknown>) => boolean
}

export interface CadastroConfig {
  colecao: Colecao
  titulo: string
  singular: string
  descricao: string
  campos: CampoConfig[]
  ordenarPor: (r: Registro) => string
}

/** Como um registro aparece quando é escolhido em outro cadastro (listas de seleção). */
export const ROTULO_REGISTRO: Record<Colecao, (r: Registro) => string> = {
  sres: (r) => `${r.sigla} – ${r.nome}`,
  municipios: (r) => String(r.nome),
  escolas: (r) => String(r.nome),
  caixas_escolares: (r) => String(r.razao_social),
  alunos: (r) => `${r.nome} (${r.cod_simade})`,
  transportadores: (r) => String(r.razao_social),
  tipos_veiculo: (r) => String(r.nome),
  precos_referencia: (r) => `${r.unidade} – ${r.valor}`,
  feriados: (r) => `${r.data} – ${r.descricao}`,
  usuarios: (r) => String(r.nome),
}

const opcoes = (mapa: Record<string, string>): Opcao[] =>
  Object.entries(mapa).map(([valor, rotulo]) => ({ valor, rotulo }))

export const UNIDADES_PRECO = opcoes({
  km: 'R$ por km rodado',
  km_dia: 'R$ por km/dia (km diário da rota)',
  dia: 'R$ por dia letivo',
  mes_veiculo: 'R$ por mês (veículo)',
})

const TURNOS = opcoes({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' })

const ATIVO: CampoConfig = { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano', padrao: true, naTabela: true }

export const CADASTROS: Record<Colecao, CadastroConfig> = {
  sres: {
    colecao: 'sres',
    titulo: 'Superintendências Regionais de Ensino',
    singular: 'SRE',
    descricao: 'A sigla de 3 caracteres compõe o código único das demandas (ex.: JUD-2026-UDI-0001).',
    ordenarPor: (r) => String(r.sigla),
    campos: [
      { nome: 'sigla', rotulo: 'Sigla', tipo: 'texto', maxLength: 3, naTabela: true, ajuda: '3 letras e/ou números. Ex.: UDI, MT1' },
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
      { nome: 'municipio_sede_id', rotulo: 'Município-sede', tipo: 'referencia', referencia: 'municipios', naTabela: true },
    ],
  },

  municipios: {
    colecao: 'municipios',
    titulo: 'Municípios',
    singular: 'município',
    descricao: 'Municípios mineiros e a SRE que os jurisdiciona.',
    ordenarPor: (r) => String(r.nome),
    campos: [
      { nome: 'cod_ibge', rotulo: 'Código IBGE', tipo: 'texto', maxLength: 7, naTabela: true },
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
      { nome: 'sre_id', rotulo: 'SRE', tipo: 'referencia', referencia: 'sres', naTabela: true },
    ],
  },

  escolas: {
    colecao: 'escolas',
    titulo: 'Escolas estaduais',
    singular: 'escola',
    descricao: 'A SRE da escola é preenchida automaticamente a partir do município.',
    ordenarPor: (r) => String(r.nome),
    campos: [
      { nome: 'cod_inep', rotulo: 'Código INEP', tipo: 'texto', maxLength: 8, naTabela: true },
      { nome: 'cod_see', rotulo: 'Código SEE', tipo: 'texto', naTabela: true },
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
      { nome: 'municipio_id', rotulo: 'Município', tipo: 'referencia', referencia: 'municipios', naTabela: true },
      { nome: 'sre_id', rotulo: 'SRE', tipo: 'referencia', referencia: 'sres', naTabela: true, emFormulario: false },
      { nome: 'endereco', rotulo: 'Endereço', tipo: 'texto' },
      ATIVO,
    ],
  },

  caixas_escolares: {
    colecao: 'caixas_escolares',
    titulo: 'Caixas Escolares',
    singular: 'Caixa Escolar',
    descricao: 'Recebem o recurso e contratam o transporte nas demandas judiciais.',
    ordenarPor: (r) => String(r.razao_social),
    campos: [
      { nome: 'cnpj', rotulo: 'CNPJ', tipo: 'cpf_cnpj', naTabela: true },
      { nome: 'razao_social', rotulo: 'Razão social', tipo: 'texto', naTabela: true },
      { nome: 'escola_id', rotulo: 'Escola', tipo: 'referencia', referencia: 'escolas', naTabela: true },
      { nome: 'presidente_nome', rotulo: 'Presidente', tipo: 'texto' },
      { nome: 'banco', rotulo: 'Banco', tipo: 'texto' },
      { nome: 'agencia', rotulo: 'Agência', tipo: 'texto' },
      { nome: 'conta', rotulo: 'Conta', tipo: 'texto' },
      ATIVO,
    ],
  },

  alunos: {
    colecao: 'alunos',
    titulo: 'Alunos',
    singular: 'aluno',
    descricao:
      'Dados mínimos (LGPD). CPF e dados de saúde não ficam aqui: CPF fica só no documento anexado e saúde na caracterização, com acesso restrito.',
    ordenarPor: (r) => String(r.nome),
    campos: [
      { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', naTabela: true },
      { nome: 'cod_simade', rotulo: 'Matrícula SIMADE', tipo: 'texto', naTabela: true },
      { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'data', naTabela: true },
      { nome: 'escola_atual_id', rotulo: 'Escola atual', tipo: 'referencia', referencia: 'escolas', naTabela: true },
      { nome: 'serie', rotulo: 'Turma / ano', tipo: 'texto' },
      { nome: 'turno', rotulo: 'Turno', tipo: 'selecao', opcoes: TURNOS, naTabela: true },
      ATIVO,
    ],
  },

  transportadores: {
    colecao: 'transportadores',
    titulo: 'Transportadores',
    singular: 'transportador',
    descricao: 'Pessoas físicas ou jurídicas contratadas pelas Caixas Escolares.',
    ordenarPor: (r) => String(r.razao_social),
    campos: [
      { nome: 'tipo_pessoa', rotulo: 'Tipo', tipo: 'selecao', opcoes: opcoes({ PJ: 'Pessoa jurídica', PF: 'Pessoa física' }), padrao: 'PJ', naTabela: true },
      { nome: 'cpf_cnpj', rotulo: 'CPF / CNPJ', tipo: 'cpf_cnpj', naTabela: true },
      { nome: 'razao_social', rotulo: 'Nome / razão social', tipo: 'texto', naTabela: true },
      { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto', naTabela: true },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email' },
      ATIVO,
    ],
  },

  tipos_veiculo: {
    colecao: 'tipos_veiculo',
    titulo: 'Tipos de veículo',
    singular: 'tipo de veículo',
    descricao: 'Lista inicial espelha o item 7.1 do formulário de caracterização.',
    ordenarPor: (r) => String(r.nome),
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
      { nome: 'capacidade', rotulo: 'Capacidade (passageiros)', tipo: 'numero', naTabela: true },
      { nome: 'adaptado_pcd', rotulo: 'Adaptado para PcD', tipo: 'booleano', padrao: false, naTabela: true },
      ATIVO,
    ],
  },

  precos_referencia: {
    colecao: 'precos_referencia',
    titulo: 'Preços de referência',
    singular: 'preço de referência',
    descricao: 'Por SRE, tipo de veículo e unidade. Não pode haver dois preços vigentes no mesmo período para a mesma combinação.',
    ordenarPor: (r) => `${r.sre_id}${r.tipo_veiculo_id}${r.vigencia_inicio}`,
    campos: [
      { nome: 'sre_id', rotulo: 'SRE', tipo: 'referencia', referencia: 'sres', naTabela: true },
      { nome: 'tipo_veiculo_id', rotulo: 'Tipo de veículo', tipo: 'referencia', referencia: 'tipos_veiculo', naTabela: true },
      { nome: 'unidade', rotulo: 'Unidade', tipo: 'selecao', opcoes: UNIDADES_PRECO, naTabela: true },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'moeda', naTabela: true },
      { nome: 'vigencia_inicio', rotulo: 'Início da vigência', tipo: 'data', naTabela: true },
      { nome: 'vigencia_fim', rotulo: 'Fim da vigência', tipo: 'data', naTabela: true, ajuda: 'Em branco = sem data de término.' },
      { nome: 'fonte', rotulo: 'Fonte / ato normativo', tipo: 'texto' },
    ],
  },

  feriados: {
    colecao: 'feriados',
    titulo: 'Feriados',
    singular: 'feriado',
    descricao: 'Usados na contagem dos prazos (SLA) em dias úteis.',
    ordenarPor: (r) => String(r.data),
    campos: [
      { nome: 'data', rotulo: 'Data', tipo: 'data', naTabela: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', naTabela: true },
      {
        nome: 'abrangencia',
        rotulo: 'Abrangência',
        tipo: 'selecao',
        opcoes: opcoes({ nacional: 'Nacional', estadual: 'Estadual', municipal: 'Municipal' }),
        padrao: 'nacional',
        naTabela: true,
      },
      {
        nome: 'municipio_id',
        rotulo: 'Município',
        tipo: 'referencia',
        referencia: 'municipios',
        naTabela: true,
        visivel: (v) => v.abrangencia === 'municipal',
        obrigatorioSe: (v) => v.abrangencia === 'municipal',
      },
    ],
  },

  usuarios: {
    colecao: 'usuarios',
    titulo: 'Usuários',
    singular: 'usuário',
    descricao: 'Perfis de acesso. Usuários de SRE só enxergam e editam dados da própria regional.',
    ordenarPor: (r) => String(r.nome),
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
      { nome: 'email', rotulo: 'E-mail', tipo: 'email', naTabela: true },
      { nome: 'papel', rotulo: 'Perfil', tipo: 'selecao', opcoes: opcoes(ROTULO_PAPEL), padrao: 'analista_sre', naTabela: true },
      {
        nome: 'sre_id',
        rotulo: 'SRE',
        tipo: 'referencia',
        referencia: 'sres',
        naTabela: true,
        visivel: (v) => v.papel === 'diretor_sre' || v.papel === 'analista_sre',
        obrigatorioSe: (v) => v.papel === 'diretor_sre' || v.papel === 'analista_sre',
      },
      ATIVO,
    ],
  },
}

/** Menu lateral: ordem e agrupamento dos cadastros. */
export const MENU_CADASTROS: Colecao[] = [
  'sres',
  'municipios',
  'escolas',
  'caixas_escolares',
  'alunos',
  'transportadores',
  'tipos_veiculo',
  'precos_referencia',
  'feriados',
]
