import { describe, expect, it } from 'vitest'
import type { Registro } from '../dados/tipos'
import { calcularRepasse, conciliar, inconsistenciasRotas } from './pte'

const r = (c: Record<string, unknown>) => ({ id: crypto.randomUUID(), ...c }) as Registro

const simade = [
  r({ cod_simade: '1', escola_inep: '31000001', situacao: 'ativo' }),
  r({ cod_simade: '2', escola_inep: '31000001', situacao: 'transferido' }),
  r({ cod_simade: '3', escola_inep: '31000002', situacao: 'ativo' }),
  r({ cod_simade: '5', escola_inep: '31000001', situacao: 'ativo' }),
]
const alunos = [
  r({ cod_simade: '1', nome: 'A', escola_inep: '31000001', rota_codigo: 'R1' }),
  r({ cod_simade: '2', nome: 'B', escola_inep: '31000001', rota_codigo: 'R1' }),
  r({ cod_simade: '3', nome: 'C', escola_inep: '31000001', rota_codigo: 'R2' }),
  r({ cod_simade: '4', nome: 'D', escola_inep: '31000001', rota_codigo: 'R2' }),
  r({ cod_simade: '5', nome: 'E', escola_inep: '31000001', rota_codigo: 'R2' }),
]

describe('conciliação TER × SIMADE', () => {
  it('aponta inativo, escola divergente, não encontrado e duplicado em outro município', () => {
    const d = conciliar(alunos, simade, [{ aluno: r({ cod_simade: '5' }), municipio: 'Outro' }])
    expect(d.map((x) => `${x.referencia}:${x.tipo}`).sort()).toEqual(['2:inativo_simade', '3:escola_divergente', '4:nao_encontrado_simade', '5:duplicado_outro_municipio'])
  })
})

describe('inconsistências de rotas (art. 13)', () => {
  it('km zero, lotação estourada, custo acima da média, urbana, sem estudante estadual', () => {
    const rotas = [
      r({ codigo: 'R1', km_diario: 0, custo_km: 4, total_passageiros: 10, capacidade: 15 }),
      r({ codigo: 'R2', km_diario: 50, custo_km: 9, total_passageiros: 20, capacidade: 16 }),
      r({ codigo: 'R3', km_diario: 30, custo_km: 4, total_passageiros: 5, urbana: true }),
    ]
    const tipos = inconsistenciasRotas(rotas, alunos, 5).map((x) => `${x.referencia}:${x.tipo}`)
    expect(tipos).toEqual([
      'ROTA R1:rota_km_zero',
      'ROTA R2:passageiros_acima_capacidade',
      'ROTA R2:custo_acima_media',
      'ROTA R3:rota_urbana_ativa',
      'ROTA R3:rota_sem_estudante_estadual',
    ])
  })
})

describe('cálculo do repasse (art. 14)', () => {
  it('por rota: km × custo × dias × proporção de estaduais, menos deduções; exclui divergências abertas', () => {
    const rotas = [
      r({ codigo: 'R1', km_diario: 100, custo_km: 5, total_passageiros: 4 }),
      r({ codigo: 'R2', km_diario: 60, custo_km: 4, total_passageiros: 6 }),
      r({ codigo: 'R3', km_diario: 80, custo_km: 4, total_passageiros: 6, urbana: true }),
    ]
    // aluno 2 com divergência aberta → R1 fica com 1 estadual; R2 tem 3 estaduais
    const c = calcularRepasse(rotas, alunos, new Set(['2']), new Set(), { dias_letivos: 200, pnate_estadual: 1000, saldo_reprogramado: 500 })
    // R1: 100×5×200×1/4 = 25.000 · R2: 60×4×200×3/6 = 24.000 · R3 urbana fora
    expect(c.rotas.map((x) => x.valor)).toEqual([25000, 24000])
    expect(c.valor_bruto).toBe(49000)
    expect(c.valor_calculado).toBe(47500)
    expect(c.qtd_alunos_validos).toBe(4)
  })

  it('rota com inconsistência aberta fica fora do cálculo', () => {
    const rotas = [r({ codigo: 'R1', km_diario: 100, custo_km: 5, total_passageiros: 2 })]
    expect(calcularRepasse(rotas, alunos, new Set(), new Set(['R1']), { dias_letivos: 200 }).valor_calculado).toBe(0)
  })
})
