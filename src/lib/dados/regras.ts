// Regras de integridade dos cadastros — o equivalente às restrições do banco
// (NOT NULL, UNIQUE, CHECK, FOREIGN KEY). Rodam sempre antes de gravar,
// independentemente do que a tela validou.

import { normalizarDocumento, somenteDigitos, validarCnpj, validarCpf } from '../validacao'
import { hojeIso } from '../diasUteis'
import { normalizarContrato, validarContrato, type ContextoValidacao } from './regrasContratos'
import {
  normalizarModulo,
  OBRIGATORIOS_MODULOS,
  REFERENCIAS_MODULOS,
  UNICOS_MODULOS,
  validarModulo,
  type ColecaoModulo,
} from './regrasModulos'
import { COLECOES_CONTRATO, COLECOES_MODULOS, type Colecao, type ColecaoContrato, type Consulta, type Registro } from './tipos'

type Campos = Record<string, unknown>
type Erros = Record<string, string>

/** Campos sempre obrigatórios (NOT NULL). Obrigatoriedades condicionais ficam em `validar`. */
export const OBRIGATORIOS: Record<Colecao, string[]> = {
  sres: ['sigla', 'nome'],
  municipios: ['cod_ibge', 'nome', 'sre_id'],
  escolas: ['cod_inep', 'nome', 'municipio_id'],
  caixas_escolares: ['cnpj', 'razao_social', 'escola_id'],
  alunos: ['nome', 'cod_simade', 'data_nascimento', 'escola_atual_id'],
  transportadores: ['tipo_pessoa', 'cpf_cnpj', 'razao_social'],
  tipos_veiculo: ['nome'],
  precos_referencia: ['sre_id', 'tipo_veiculo_id', 'unidade', 'valor', 'vigencia_inicio'],
  feriados: ['data', 'descricao', 'abrangencia'],
  usuarios: ['nome', 'email', 'papel'],
  processos: ['codigo', 'modulo', 'ano'],
  instrumentos: [
    'tipo', 'numero', 'objeto', 'numero_sei', 'data_assinatura', 'vigencia_inicio', 'vigencia_fim',
    'valor_global', 'dotacao_orcamentaria', 'gestor_id', 'fiscal_id', 'status',
  ],
  aditivos: ['instrumento_id', 'numero', 'data_assinatura', 'documento_sei'],
  parcelas: ['instrumento_id', 'numero', 'competencia', 'valor_previsto', 'data_prevista'],
  fiscalizacoes: ['instrumento_id', 'competencia', 'dias_rodados', 'alunos_transportados', 'fiscal_id'],
  ocorrencias: ['instrumento_id', 'data', 'tipo', 'gravidade', 'titulo', 'descricao', 'status'],
  prestacoes_contas: ['instrumento_id', 'periodo_referencia', 'data_limite', 'status'],
  ...OBRIGATORIOS_MODULOS,
}

/** Chaves estrangeiras: impedem excluir um registro que ainda é usado por outro. */
export const REFERENCIAS: { origem: Colecao; campo: string; alvo: Colecao }[] = [
  { origem: 'sres', campo: 'municipio_sede_id', alvo: 'municipios' },
  { origem: 'municipios', campo: 'sre_id', alvo: 'sres' },
  { origem: 'escolas', campo: 'municipio_id', alvo: 'municipios' },
  { origem: 'escolas', campo: 'sre_id', alvo: 'sres' },
  { origem: 'caixas_escolares', campo: 'escola_id', alvo: 'escolas' },
  { origem: 'alunos', campo: 'escola_atual_id', alvo: 'escolas' },
  { origem: 'precos_referencia', campo: 'sre_id', alvo: 'sres' },
  { origem: 'precos_referencia', campo: 'tipo_veiculo_id', alvo: 'tipos_veiculo' },
  { origem: 'feriados', campo: 'municipio_id', alvo: 'municipios' },
  { origem: 'usuarios', campo: 'sre_id', alvo: 'sres' },
  { origem: 'usuarios', campo: 'municipio_id', alvo: 'municipios' },
  { origem: 'processos', campo: 'sre_id', alvo: 'sres' },
  { origem: 'processos', campo: 'municipio_id', alvo: 'municipios' },
  { origem: 'instrumentos', campo: 'processo_id', alvo: 'processos' },
  { origem: 'instrumentos', campo: 'caixa_escolar_id', alvo: 'caixas_escolares' },
  { origem: 'instrumentos', campo: 'transportador_id', alvo: 'transportadores' },
  { origem: 'instrumentos', campo: 'municipio_id', alvo: 'municipios' },
  { origem: 'instrumentos', campo: 'gestor_id', alvo: 'usuarios' },
  { origem: 'instrumentos', campo: 'fiscal_id', alvo: 'usuarios' },
  { origem: 'aditivos', campo: 'instrumento_id', alvo: 'instrumentos' },
  { origem: 'parcelas', campo: 'instrumento_id', alvo: 'instrumentos' },
  { origem: 'fiscalizacoes', campo: 'instrumento_id', alvo: 'instrumentos' },
  { origem: 'fiscalizacoes', campo: 'fiscal_id', alvo: 'usuarios' },
  { origem: 'ocorrencias', campo: 'instrumento_id', alvo: 'instrumentos' },
  { origem: 'prestacoes_contas', campo: 'instrumento_id', alvo: 'instrumentos' },
  { origem: 'prestacoes_contas', campo: 'analista_id', alvo: 'usuarios' },
  ...REFERENCIAS_MODULOS,
]

/**
 * Campos únicos (UNIQUE). Cada item pode ser uma combinação de campos; a checagem só roda
 * quando o primeiro campo está preenchido (a mensagem aparece nesse campo).
 */
const UNICOS: Partial<Record<Colecao, { campos: string[]; mensagem: string }[]>> = {
  sres: [{ campos: ['sigla'], mensagem: 'Já existe SRE com esta sigla.' }],
  municipios: [{ campos: ['cod_ibge'], mensagem: 'Já existe município com este código IBGE.' }],
  escolas: [{ campos: ['cod_inep'], mensagem: 'Já existe escola com este código INEP.' }],
  caixas_escolares: [{ campos: ['cnpj'], mensagem: 'Já existe Caixa Escolar com este CNPJ.' }],
  alunos: [{ campos: ['cod_simade'], mensagem: 'Já existe aluno com esta matrícula SIMADE.' }],
  transportadores: [{ campos: ['cpf_cnpj'], mensagem: 'Já existe transportador com este CPF/CNPJ.' }],
  tipos_veiculo: [{ campos: ['nome'], mensagem: 'Já existe tipo de veículo com este nome.' }],
  feriados: [
    { campos: ['data', 'abrangencia', 'municipio_id'], mensagem: 'Feriado já cadastrado nesta data.' },
  ],
  usuarios: [{ campos: ['email'], mensagem: 'Já existe usuário com este e-mail.' }],
  processos: [{ campos: ['codigo'], mensagem: 'Código único já utilizado.' }],
  instrumentos: [
    {
      campos: ['numero', 'tipo', 'caixa_escolar_id', 'municipio_id'],
      mensagem: 'Já existe instrumento com este número para o mesmo contratante.',
    },
  ],
  aditivos: [{ campos: ['numero', 'instrumento_id'], mensagem: 'Já existe aditivo com este número.' }],
  parcelas: [{ campos: ['numero', 'instrumento_id'], mensagem: 'Já existe parcela com este número.' }],
  fiscalizacoes: [
    { campos: ['competencia', 'instrumento_id'], mensagem: 'Já existe registro de fiscalização nesta competência.' },
  ],
  prestacoes_contas: [
    { campos: ['periodo_referencia', 'instrumento_id'], mensagem: 'Já existe prestação de contas para este período.' },
  ],
  ...UNICOS_MODULOS,
}

const ehContrato = (c: Colecao): c is ColecaoContrato => (COLECOES_CONTRATO as Colecao[]).includes(c)
const ehModulo = (c: Colecao): c is ColecaoModulo => (COLECOES_MODULOS as Colecao[]).includes(c)

const vazio = (v: unknown) =>
  v === null || v === undefined || v === '' || Number.isNaN(v) || (Array.isArray(v) && v.length === 0)

/** Limpa e padroniza os dados antes de validar (maiúsculas, só dígitos, campos derivados). */
export function normalizar(colecao: Colecao, dados: Campos, consulta: Consulta): Campos {
  const d: Campos = {}
  for (const [k, v] of Object.entries(dados)) {
    const limpo = typeof v === 'string' ? v.trim() : v
    d[k] = vazio(limpo) ? null : limpo
  }

  switch (colecao) {
    case 'sres':
      if (d.sigla) d.sigla = String(d.sigla).toUpperCase()
      break
    case 'municipios':
      if (d.cod_ibge) d.cod_ibge = somenteDigitos(String(d.cod_ibge))
      break
    case 'escolas':
      if (d.cod_inep) d.cod_inep = somenteDigitos(String(d.cod_inep))
      // A SRE da escola é sempre a do município (evita cadastro inconsistente).
      d.sre_id = (consulta('municipios', d.municipio_id)?.sre_id as string | undefined) ?? null
      break
    case 'caixas_escolares':
      if (d.cnpj) d.cnpj = normalizarDocumento(String(d.cnpj))
      break
    case 'transportadores':
      if (d.cpf_cnpj) d.cpf_cnpj = normalizarDocumento(String(d.cpf_cnpj))
      break
    case 'feriados':
      if (d.abrangencia !== 'municipal') d.municipio_id = null
      break
    case 'usuarios':
      if (d.email) d.email = String(d.email).toLowerCase()
      if (d.papel === 'admin' || d.papel === 'analista_central' || d.papel === 'subsecretario' || d.papel === 'municipio') d.sre_id = null
      if ('papel' in d && d.papel !== 'municipio') d.municipio_id = null
      break
  }
  if (ehContrato(colecao)) return normalizarContrato(colecao, d, consulta)
  if (ehModulo(colecao)) return normalizarModulo(colecao, d, consulta)
  return d
}

/** Valida um registro já normalizado. Devolve os erros por campo (vazio = válido; `_geral` = erro sem campo). */
export function validar(colecao: Colecao, r: Registro, existentes: Registro[], ctx: ContextoValidacao): Erros {
  const { consulta } = ctx
  const erros: Erros = {}
  const outros = existentes.filter((e) => e.id !== r.id)

  for (const campo of OBRIGATORIOS[colecao]) {
    if (vazio(r[campo])) erros[campo] = 'Campo obrigatório.'
  }

  for (const u of UNICOS[colecao] ?? []) {
    if (vazio(r[u.campos[0]])) continue
    const repetido = outros.some((e) => u.campos.every((c) => (e[c] ?? null) === (r[c] ?? null)))
    if (repetido) erros[u.campos[0]] = u.mensagem
  }

  for (const ref of REFERENCIAS.filter((x) => x.origem === colecao)) {
    if (!vazio(r[ref.campo]) && !consulta(ref.alvo, r[ref.campo])) {
      erros[ref.campo] = 'Registro relacionado não encontrado.'
    }
  }

  switch (colecao) {
    case 'sres':
      if (r.sigla && !/^[A-Z0-9]{3}$/.test(String(r.sigla)))
        erros.sigla = 'A sigla deve ter exatamente 3 letras e/ou números.'
      break
    case 'municipios':
      if (r.cod_ibge && !/^31\d{5}$/.test(String(r.cod_ibge)))
        erros.cod_ibge = 'Código IBGE de município mineiro tem 7 dígitos e começa com 31.'
      break
    case 'escolas':
      if (r.cod_inep && !/^\d{8}$/.test(String(r.cod_inep))) erros.cod_inep = 'O código INEP tem 8 dígitos.'
      break
    case 'caixas_escolares':
      if (r.cnpj && !validarCnpj(String(r.cnpj))) erros.cnpj = 'CNPJ inválido.'
      break
    case 'alunos':
      if (r.data_nascimento && String(r.data_nascimento) > hojeIso())
        erros.data_nascimento = 'Data de nascimento no futuro.'
      if (r.cpf && !validarCpf(String(r.cpf))) erros.cpf = 'CPF inválido.'
      break
    case 'transportadores': {
      const doc = String(r.cpf_cnpj ?? '')
      if (doc && r.tipo_pessoa === 'PF' && !validarCpf(doc)) erros.cpf_cnpj = 'CPF inválido.'
      if (doc && r.tipo_pessoa === 'PJ' && !validarCnpj(doc)) erros.cpf_cnpj = 'CNPJ inválido.'
      break
    }
    case 'tipos_veiculo':
      if (!vazio(r.capacidade) && Number(r.capacidade) <= 0) erros.capacidade = 'Capacidade deve ser maior que zero.'
      break
    case 'precos_referencia': {
      if (!vazio(r.valor) && Number(r.valor) <= 0) erros.valor = 'O valor deve ser maior que zero.'
      if (r.vigencia_fim && String(r.vigencia_fim) < String(r.vigencia_inicio))
        erros.vigencia_fim = 'O fim da vigência é anterior ao início.'
      // Não pode haver dois preços vigentes ao mesmo tempo para a mesma SRE + veículo + unidade.
      const ini = String(r.vigencia_inicio ?? '')
      const fim = String(r.vigencia_fim ?? '9999-12-31')
      const sobreposto = outros.find(
        (e) =>
          e.sre_id === r.sre_id &&
          e.tipo_veiculo_id === r.tipo_veiculo_id &&
          e.unidade === r.unidade &&
          String(e.vigencia_inicio) <= fim &&
          ini <= String(e.vigencia_fim ?? '9999-12-31'),
      )
      if (ini && sobreposto)
        erros.vigencia_inicio = 'Já existe preço vigente neste período para a mesma SRE, veículo e unidade.'
      break
    }
    case 'feriados':
      if (r.abrangencia === 'municipal' && vazio(r.municipio_id))
        erros.municipio_id = 'Informe o município do feriado municipal.'
      break
    case 'usuarios':
      if ((r.papel === 'diretor_sre' || r.papel === 'analista_sre') && vazio(r.sre_id))
        erros.sre_id = 'Usuário de SRE precisa ter a regional informada.'
      if (r.papel === 'municipio' && vazio(r.municipio_id)) erros.municipio_id = 'Usuário de prefeitura precisa ter o município informado.'
      if (r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(r.email))) erros.email = 'E-mail inválido.'
      break
  }
  if (ehContrato(colecao)) return { ...validarContrato(colecao, r, ctx), ...erros }
  if (ehModulo(colecao)) return { ...validarModulo(colecao, r, ctx), ...erros }
  return erros
}
