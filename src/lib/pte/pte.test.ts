import { describe, expect, it } from 'vitest'
import type { Registro } from '../dados/tipos'
import { calcularRepasse, conciliar } from './pte'

const r = (c: Record<string, unknown>) => ({ id: crypto.randomUUID(), ...c }) as Registro

const simade = [
  r({ cod_simade: '1', escola_inep: '31000001', situacao: 'ativo' }),
  r({ cod_simade: '2', escola_inep: '31000001', situacao: 'transferido' }),
  r({ cod_simade: '3', escola_inep: '31000002', situacao: 'ativo' }),
  r({ cod_simade: '5', escola_inep: '31000001', situacao: 'ativo' }),
]
const informados = [
  r({ cod_simade: '1', nome: 'A', escola_inep: '31000001', km_ida: 10 }),
  r({ cod_simade: '2', nome: 'B', escola_inep: '31000001', km_ida: 5 }),
  r({ cod_simade: '3', nome: 'C', escola_inep: '31000001', km_ida: 8 }),
  r({ cod_simade: '4', nome: 'D', escola_inep: '31000001', km_ida: 3 }),
  r({ cod_simade: '5', nome: 'E', escola_inep: '31000001', km_ida: 2 }),
]

describe('conciliação TER × SIMADE', () => {
  it('aponta inativo, escola divergente, não encontrado e duplicado em outro município', () => {
    const d = conciliar(informados, simade, [{ aluno: r({ cod_simade: '5' }), municipio: 'Outro' }])
    expect(d.map((x) => `${x.cod_simade}:${x.tipo}`).sort()).toEqual([
      '2:inativo_simade',
      '3:escola_divergente',
      '4:nao_encontrado_simade',
      '5:duplicado_outro_municipio',
    ])
  })
})

describe('cálculo do repasse', () => {
  it('conta só alunos válidos e soma parcela por aluno + km', () => {
    const abertas = new Set(['2', '4'])
    const c = calcularRepasse(informados, abertas, { valor_por_aluno: 1000, valor_por_km: 2, dias_letivos: 200 })
    // válidos: 1, 3, 5 → 3 alunos; km/dia = (10+8+2)×2 = 40
    expect(c.qtd_alunos_validos).toBe(3)
    expect(c.km_diario_total).toBe(40)
    expect(c.valor_calculado).toBe(3 * 1000 + 40 * 2 * 200)
  })
})
