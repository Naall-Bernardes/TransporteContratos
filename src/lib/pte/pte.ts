// PTE: conciliação da lista informada pelo município (TER/MG) com o SIMADE e cálculo do repasse.

import type { Registro } from '../dados/tipos'

export type TipoDivergencia =
  | 'nao_encontrado_simade'
  | 'inativo_simade'
  | 'escola_divergente'
  | 'duplicado_outro_municipio'

export const ROTULO_DIVERGENCIA: Record<TipoDivergencia, string> = {
  nao_encontrado_simade: 'Não encontrado no SIMADE',
  inativo_simade: 'Matrícula inativa/transferida no SIMADE',
  escola_divergente: 'Escola diferente da registrada no SIMADE',
  duplicado_outro_municipio: 'Informado também por outro município',
}

export interface DivergenciaEncontrada {
  cod_simade: string
  tipo: TipoDivergencia
  descricao: string
}

/**
 * Compara a lista informada pelo município com o SIMADE do ciclo.
 * @param informados alunos da adesão (pte_alunos)
 * @param simade registros SIMADE do ciclo
 * @param outrasListas alunos informados por OUTRAS adesões do mesmo ciclo
 */
export function conciliar(
  informados: Registro[],
  simade: Registro[],
  outrasListas: { aluno: Registro; municipio: string }[],
): DivergenciaEncontrada[] {
  const porCodigo = new Map(simade.map((s) => [String(s.cod_simade), s]))
  const divergencias: DivergenciaEncontrada[] = []

  for (const a of informados.filter((x) => x.ativo !== false)) {
    const cod = String(a.cod_simade)
    const s = porCodigo.get(cod)
    if (!s) {
      divergencias.push({ cod_simade: cod, tipo: 'nao_encontrado_simade', descricao: `${a.nome}: matrícula ${cod} não consta no SIMADE do ciclo.` })
    } else {
      if (s.situacao !== 'ativo')
        divergencias.push({ cod_simade: cod, tipo: 'inativo_simade', descricao: `${a.nome}: situação no SIMADE = ${s.situacao}.` })
      if (String(s.escola_inep) !== String(a.escola_inep))
        divergencias.push({
          cod_simade: cod,
          tipo: 'escola_divergente',
          descricao: `${a.nome}: informado na escola ${a.escola_inep}, SIMADE indica ${s.escola_inep}.`,
        })
    }
    const outro = outrasListas.find((o) => String(o.aluno.cod_simade) === cod && o.aluno.ativo !== false)
    if (outro)
      divergencias.push({ cod_simade: cod, tipo: 'duplicado_outro_municipio', descricao: `${a.nome}: também informado por ${outro.municipio}.` })
  }
  return divergencias
}

export interface ParametrosCalculo {
  valor_por_aluno: number
  valor_por_km: number
  dias_letivos: number
}

export interface ResultadoCalculo {
  qtd_alunos_informados: number
  qtd_alunos_validos: number
  km_diario_total: number
  parcela_alunos: number
  parcela_km: number
  valor_calculado: number
  memoria: string
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Valor do repasse = alunos válidos × valor por aluno
 *                  + km diário (ida e volta) dos alunos válidos × valor por km × dias letivos.
 * Aluno válido = ativo na lista e sem divergência em aberto.
 * (Fórmula provisória — as regras do PTE ainda serão detalhadas; os parâmetros ficam no ciclo.)
 */
export function calcularRepasse(informados: Registro[], divergenciasAbertas: Set<string>, p: ParametrosCalculo): ResultadoCalculo {
  const ativos = informados.filter((a) => a.ativo !== false)
  const validos = ativos.filter((a) => !divergenciasAbertas.has(String(a.cod_simade)))
  const km = validos.reduce((s, a) => s + Number(a.km_ida || 0) * 2, 0)
  const parcelaAlunos = validos.length * p.valor_por_aluno
  const parcelaKm = km * p.valor_por_km * p.dias_letivos
  const total = Math.round((parcelaAlunos + parcelaKm) * 100) / 100
  const memoria = [
    `Alunos informados: ${ativos.length}; válidos (sem divergência aberta): ${validos.length}.`,
    `Parcela por aluno: ${validos.length} × ${brl(p.valor_por_aluno)} = ${brl(parcelaAlunos)}.`,
    `Parcela por km: ${km.toLocaleString('pt-BR')} km/dia (ida e volta) × ${brl(p.valor_por_km)} × ${p.dias_letivos} dias letivos = ${brl(parcelaKm)}.`,
    `Total: ${brl(total)}.`,
  ].join('\n')
  return {
    qtd_alunos_informados: ativos.length,
    qtd_alunos_validos: validos.length,
    km_diario_total: km,
    parcela_alunos: parcelaAlunos,
    parcela_km: parcelaKm,
    valor_calculado: total,
    memoria,
  }
}
