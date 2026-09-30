// PTE/MG — regras da Resolução Conjunta SEE/SEGOV nº 5.267/2026:
// conciliação TER/MG × SIMADE, inconsistências de rotas (art. 13) e cálculo do repasse (art. 14).

import type { Registro } from '../dados/tipos'

export type TipoDivergencia =
  | 'nao_encontrado_simade'
  | 'inativo_simade'
  | 'escola_divergente'
  | 'duplicado_outro_municipio'
  | 'rota_km_zero'
  | 'passageiros_acima_capacidade'
  | 'custo_acima_media'
  | 'rota_urbana_ativa'
  | 'rota_sem_estudante_estadual'
  | 'estaduais_acima_do_total'

export const ROTULO_DIVERGENCIA: Record<TipoDivergencia, string> = {
  nao_encontrado_simade: 'Estudante não encontrado no SIMADE',
  inativo_simade: 'Matrícula inativa/transferida no SIMADE',
  escola_divergente: 'Escola diferente da registrada no SIMADE',
  duplicado_outro_municipio: 'Estudante informado também por outro município',
  rota_km_zero: 'Rota com distância igual a zero (art. 13, II)',
  passageiros_acima_capacidade: 'Passageiros acima da capacidade do veículo (art. 13, IV)',
  custo_acima_media: 'Custo por km muito acima da média (art. 13, III)',
  rota_urbana_ativa: 'Viagem urbana registrada como ativa (art. 13, V)',
  rota_sem_estudante_estadual: 'Rota sem estudante estadual — km sem alunos da rede (art. 13, VI)',
  estaduais_acima_do_total: 'Mais estudantes estaduais que passageiros declarados',
}

export const DIVERGENCIAS_DE_ROTA: TipoDivergencia[] = [
  'rota_km_zero',
  'passageiros_acima_capacidade',
  'custo_acima_media',
  'rota_urbana_ativa',
  'rota_sem_estudante_estadual',
  'estaduais_acima_do_total',
]

export interface DivergenciaEncontrada {
  /** Matrícula SIMADE (estudante) ou "ROTA <código>" (rota). */
  referencia: string
  cod_simade: string | null
  tipo: TipoDivergencia
  descricao: string
}

/** Estudantes: lista TER do município × SIMADE do ciclo × listas de outros municípios. */
export function conciliar(informados: Registro[], simade: Registro[], outrasListas: { aluno: Registro; municipio: string }[]): DivergenciaEncontrada[] {
  const porCodigo = new Map(simade.map((s) => [String(s.cod_simade), s]))
  const d: DivergenciaEncontrada[] = []
  const add = (cod: string, tipo: TipoDivergencia, descricao: string) => d.push({ referencia: cod, cod_simade: cod, tipo, descricao })
  for (const a of informados.filter((x) => x.ativo !== false)) {
    const cod = String(a.cod_simade)
    const s = porCodigo.get(cod)
    if (!s) add(cod, 'nao_encontrado_simade', `${a.nome}: matrícula ${cod} não consta no SIMADE do ciclo.`)
    else {
      if (s.situacao !== 'ativo') add(cod, 'inativo_simade', `${a.nome}: situação no SIMADE = ${s.situacao}.`)
      if (String(s.escola_inep) !== String(a.escola_inep)) add(cod, 'escola_divergente', `${a.nome}: informado na escola ${a.escola_inep}, SIMADE indica ${s.escola_inep}.`)
    }
    const outro = outrasListas.find((o) => String(o.aluno.cod_simade) === cod && o.aluno.ativo !== false)
    if (outro) add(cod, 'duplicado_outro_municipio', `${a.nome}: também informado por ${outro.municipio}.`)
  }
  return d
}

/** Estudantes estaduais por rota (só ativos). */
export function estaduaisPorRota(alunos: Registro[], excluir: Set<string> = new Set()): Map<string, number> {
  const m = new Map<string, number>()
  for (const a of alunos) {
    if (a.ativo === false || !a.rota_codigo || excluir.has(String(a.cod_simade))) continue
    m.set(String(a.rota_codigo), (m.get(String(a.rota_codigo)) ?? 0) + 1)
  }
  return m
}

/** Custo acima deste múltiplo da média do ciclo é "significativamente superior" (art. 13, III). Critério adotado. */
export const FATOR_CUSTO_ACIMA_MEDIA = 1.5

/** Inconsistências das rotas (art. 13, II a VI). `mediaCustoKm` = média do ciclo. */
export function inconsistenciasRotas(rotas: Registro[], alunos: Registro[], mediaCustoKm: number): DivergenciaEncontrada[] {
  const estaduais = estaduaisPorRota(alunos)
  const d: DivergenciaEncontrada[] = []
  for (const r of rotas.filter((x) => x.ativa !== false)) {
    const ref = `ROTA ${r.codigo}`
    const add = (tipo: TipoDivergencia, descricao: string) => d.push({ referencia: ref, cod_simade: null, tipo, descricao: `${ref}: ${descricao}` })
    const qtd = estaduais.get(String(r.codigo)) ?? 0
    if (Number(r.km_diario) === 0) add('rota_km_zero', 'distância informada igual a zero.')
    if (r.capacidade && Number(r.total_passageiros) > Number(r.capacidade)) add('passageiros_acima_capacidade', `${r.total_passageiros} passageiros para capacidade de ${r.capacidade}.`)
    if (mediaCustoKm > 0 && Number(r.custo_km) > mediaCustoKm * FATOR_CUSTO_ACIMA_MEDIA)
      add('custo_acima_media', `R$ ${Number(r.custo_km).toFixed(2)}/km contra média de R$ ${mediaCustoKm.toFixed(2)}/km.`)
    if (r.urbana) add('rota_urbana_ativa', 'rota urbana registrada como ativa.')
    if (qtd === 0) add('rota_sem_estudante_estadual', 'nenhum estudante estadual vinculado à rota.')
    if (qtd > Number(r.total_passageiros)) add('estaduais_acima_do_total', `${qtd} estudantes estaduais vinculados, mas só ${r.total_passageiros} passageiros declarados.`)
  }
  return d
}

export interface ParametrosCalculo {
  dias_letivos: number
  /** Valores do PNATE referentes a estudantes estaduais (art. 28) — deduzidos. */
  pnate_estadual?: number
  /** Saldo em conta em 31/12 do ano anterior a reprogramar (art. 17, p. único) — deduzido. */
  saldo_reprogramado?: number
}

export interface CalculoRota {
  codigo: string
  km_diario: number
  custo_km: number
  estaduais: number
  total_passageiros: number
  proporcao: number
  valor: number
}

export interface ResultadoCalculo {
  qtd_alunos_informados: number
  qtd_alunos_validos: number
  qtd_rotas_consideradas: number
  km_diario_total: number
  valor_bruto: number
  deducoes: number
  valor_calculado: number
  rotas: CalculoRota[]
  memoria: string
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Repasse (art. 14): Σ por rota [ km diário × custo por km × dias letivos × (estudantes estaduais ÷ passageiros) ]
 * − PNATE estadual − saldo reprogramado.
 * Ficam fora: rotas inativas, urbanas ou com inconsistência aberta; estudantes com divergência aberta.
 */
export function calcularRepasse(
  rotas: Registro[],
  alunos: Registro[],
  alunosComDivergencia: Set<string>,
  rotasComDivergencia: Set<string>,
  p: ParametrosCalculo,
): ResultadoCalculo {
  const ativos = alunos.filter((a) => a.ativo !== false)
  const estaduais = estaduaisPorRota(ativos, alunosComDivergencia)
  const consideradas = rotas.filter((r) => r.ativa !== false && !r.urbana && !rotasComDivergencia.has(String(r.codigo)))
  const detalhe: CalculoRota[] = consideradas.map((r) => {
    const qtd = estaduais.get(String(r.codigo)) ?? 0
    const total = Math.max(Number(r.total_passageiros) || 0, qtd)
    const proporcao = total > 0 ? qtd / total : 0
    const valor = Number(r.km_diario) * Number(r.custo_km) * p.dias_letivos * proporcao
    return { codigo: String(r.codigo), km_diario: Number(r.km_diario), custo_km: Number(r.custo_km), estaduais: qtd, total_passageiros: total, proporcao, valor: Math.round(valor * 100) / 100 }
  })
  const bruto = Math.round(detalhe.reduce((t, r) => t + r.valor, 0) * 100) / 100
  const deducoes = (p.pnate_estadual ?? 0) + (p.saldo_reprogramado ?? 0)
  const total = Math.max(0, Math.round((bruto - deducoes) * 100) / 100)
  const validos = ativos.filter((a) => !alunosComDivergencia.has(String(a.cod_simade))).length
  const memoria = [
    `Fórmula (Res. SEE/SEGOV 5.267/2026, art. 14): km/dia × custo/km × ${p.dias_letivos} dias × (estaduais ÷ passageiros), por rota.`,
    ...detalhe.map((r) => `Rota ${r.codigo}: ${r.km_diario} km × ${brl(r.custo_km)} × ${p.dias_letivos} × ${r.estaduais}/${r.total_passageiros} = ${brl(r.valor)}`),
    `Rotas fora do cálculo (inativas, urbanas ou com inconsistência aberta): ${rotas.length - consideradas.length}.`,
    `Valor bruto: ${brl(bruto)}.`,
    `Deduções: PNATE estadual ${brl(p.pnate_estadual ?? 0)} + saldo reprogramado ${brl(p.saldo_reprogramado ?? 0)}.`,
    `Valor do repasse: ${brl(total)}.`,
  ].join('\n')
  return {
    qtd_alunos_informados: ativos.length,
    qtd_alunos_validos: validos,
    qtd_rotas_consideradas: consideradas.length,
    km_diario_total: detalhe.reduce((t, r) => t + r.km_diario, 0),
    valor_bruto: bruto,
    deducoes,
    valor_calculado: total,
    rotas: detalhe,
    memoria,
  }
}
