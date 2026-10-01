// Abertura da demanda de transporte (primeira tela de Contratações): responde quem deve ser
// atendido, por quê, onde, como e até quando. Os dados de cada aluno já pré-preenchem o
// formulário de caracterização, que a SRE completa depois.

import { diasUteisEntre } from '../diasUteis'

export const TIPOS_DETERMINACAO: Record<string, string> = {
  liminar: 'Liminar',
  tutela_urgencia: 'Tutela de urgência',
  sentenca: 'Sentença',
  acordo: 'Acordo / TAC',
  requisicao_mp: 'Requisição do MP',
  outro: 'Outro',
}

export const SENTIDOS_VIAGEM: Record<string, string> = {
  ida_volta: 'Ida e volta',
  ida: 'Somente ida',
  volta: 'Somente volta',
}

export type Prioridade = 'urgente' | 'alta' | 'normal'

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = { urgente: 'Urgente', alta: 'Alta', normal: 'Normal' }

/** Dias úteis até o prazo que tornam a demanda urgente. */
export const DIAS_URGENCIA = 5

/**
 * Prioridade automática:
 * - Urgente: liminar ou tutela de urgência, prazo em até 5 dias úteis, ou multa diária fixada;
 * - Alta: demais determinações do Judiciário;
 * - Normal: o restante (ex.: requisição do MP com prazo folgado).
 */
export function calcularPrioridade(
  d: { tipo_determinacao?: unknown; prazo_judicial?: unknown; multa_diaria?: unknown; origem?: unknown },
  hoje: string,
  feriados: ReadonlySet<string>,
): Prioridade {
  const prazoCurto = d.prazo_judicial ? diasUteisEntre(hoje, String(d.prazo_judicial), feriados) <= DIAS_URGENCIA : false
  if (d.tipo_determinacao === 'liminar' || d.tipo_determinacao === 'tutela_urgencia' || prazoCurto || Number(d.multa_diaria || 0) > 0) return 'urgente'
  if (d.origem === 'judicial') return 'alta'
  return 'normal'
}

export interface AlunoAbertura {
  /** Aluno já cadastrado; sem ele, `novo` cria o aluno no cadastro. */
  aluno_id?: string
  novo?: { nome: string; cod_simade: string; cpf?: string; data_nascimento: string }
  responsavel_nome: string
  turno: string
  endereco_origem: string
  dias_semana: string[]
  viagem: string
  horario_entrada: string
  horario_saida: string
  veiculo_acessivel: boolean | null
  cadeira_rodas?: boolean
  acompanhante: boolean | null
  outras_condicoes?: string
}

export interface DadosAbertura {
  tipo_determinacao: string
  data_ciencia: string
  prazo_judicial: string
  multa_diaria?: number | null
  multa_valor_maximo?: number | null
  escola_id: string
  data_inicio_prevista: string
  data_termino_prevista?: string | null
  prazo_indeterminado?: boolean
  caixa_escolar_id: string
  responsavel_sre_id: string
  responsavel_central_id?: string | null
  prazo_devolucao_formulario: string
  decisao_resumo: string
  observacoes_internas?: string
  alunos: AlunoAbertura[]
}

const vazio = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

/** Campos obrigatórios da abertura (chaves no formato "campo" ou "alunos.N.campo"). */
export function errosAbertura(d: DadosAbertura): Record<string, string> {
  const e: Record<string, string> = {}
  const obrig = 'Campo obrigatório.'
  for (const c of ['tipo_determinacao', 'data_ciencia', 'prazo_judicial', 'escola_id', 'data_inicio_prevista', 'caixa_escolar_id', 'responsavel_sre_id', 'prazo_devolucao_formulario', 'decisao_resumo'] as const)
    if (vazio(d[c])) e[c] = obrig
  if (!d.prazo_indeterminado && vazio(d.data_termino_prevista)) e.data_termino_prevista = 'Informe o término ou marque "prazo indeterminado".'
  if (d.data_termino_prevista && d.data_inicio_prevista && d.data_termino_prevista < d.data_inicio_prevista) e.data_termino_prevista = 'O término é anterior ao início.'
  if (!vazio(d.multa_valor_maximo) && Number(d.multa_valor_maximo) < Number(d.multa_diaria || 0)) e.multa_valor_maximo = 'O teto não pode ser menor que a multa diária.'
  if (!d.alunos.length) e.alunos = 'Inclua ao menos um aluno.'
  d.alunos.forEach((a, i) => {
    const k = (c: string) => `alunos.${i}.${c}`
    if (!a.aluno_id) {
      if (!a.novo || vazio(a.novo.nome)) e[k('nome')] = 'Escolha um aluno do cadastro ou informe o nome.'
      if (!a.novo || vazio(a.novo.cod_simade)) e[k('cod_simade')] = obrig
      if (!a.novo || vazio(a.novo.data_nascimento)) e[k('data_nascimento')] = obrig
    }
    for (const c of ['responsavel_nome', 'turno', 'endereco_origem', 'dias_semana', 'viagem', 'horario_entrada', 'horario_saida'] as const) if (vazio(a[c])) e[k(c)] = obrig
    if (a.veiculo_acessivel === null || a.veiculo_acessivel === undefined) e[k('veiculo_acessivel')] = 'Responda sim ou não.'
    if (a.acompanhante === null || a.acompanhante === undefined) e[k('acompanhante')] = 'Responda sim ou não.'
    if (a.horario_entrada && a.horario_saida && a.horario_saida <= a.horario_entrada) e[k('horario_saida')] = 'A saída deve ser depois da entrada.'
  })
  const ids = d.alunos.map((a) => a.aluno_id).filter(Boolean)
  if (new Set(ids).size !== ids.length) e.alunos = 'O mesmo aluno foi incluído duas vezes.'
  return e
}
