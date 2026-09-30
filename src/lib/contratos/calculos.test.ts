import { describe, expect, it } from 'vitest'
import type { Registro } from '../dados/tipos'
import { gerarCodigoUnico } from '../codigoUnico'
import { calcularSituacao, diasCorridos, montarLinhaDoTempo, situacaoPrazoPrestacao } from './calculos'

const r = (campos: Record<string, unknown>) => ({ id: crypto.randomUUID(), ...campos }) as Registro

const contrato = r({
  tipo: 'contrato_caixa',
  status: 'vigente',
  data_assinatura: '2026-02-01',
  vigencia_inicio: '2026-02-01',
  vigencia_fim: '2026-12-31',
  valor_global: 100_000,
})

describe('situação do instrumento', () => {
  it('sem aditivos: vigência e valor originais, saldo = valor − pago', () => {
    const s = calcularSituacao(contrato, [], [r({ valor_pago: 25_000 }), r({ valor_pago: null })], '2026-06-01')
    expect(s.vigencia_fim_atual).toBe('2026-12-31')
    expect(s.valor_atual).toBe(100_000)
    expect(s.saldo).toBe(75_000)
    expect(s.pct_executado).toBe(25)
    expect(s.faixa).toBe('vigente')
  })

  it('aditivos recalculam vigência (último de prazo) e valor (acréscimos − supressões)', () => {
    const aditivos = [
      r({ numero: 2, data_assinatura: '2026-11-01', altera_prazo: true, nova_vigencia_fim: '2027-06-30', altera_valor: true, valor_variacao: -5_000 }),
      r({ numero: 1, data_assinatura: '2026-05-01', altera_prazo: true, nova_vigencia_fim: '2027-03-31', altera_valor: true, valor_variacao: 20_000 }),
    ]
    const s = calcularSituacao(contrato, aditivos, [], '2026-06-01')
    expect(s.vigencia_fim_atual).toBe('2027-06-30')
    expect(s.valor_atual).toBe(115_000)
    expect(s.pct_acrescimos).toBe(20)
    expect(s.pct_supressoes).toBe(5)
  })

  it('faixas de alerta 90/60/30 e vencido', () => {
    const faixa = (hoje: string) => calcularSituacao(contrato, [], [], hoje).faixa
    expect(faixa('2026-10-01')).toBe('vigente') // faltam 91 dias
    expect(faixa('2026-10-03')).toBe('ate_90')
    expect(faixa('2026-11-15')).toBe('ate_60')
    expect(faixa('2026-12-10')).toBe('ate_30')
    expect(faixa('2027-01-01')).toBe('vencido')
    expect(calcularSituacao({ ...contrato, status: 'encerrado' }, [], [], '2027-01-01').faixa).toBe('encerrado')
  })

  it('dias corridos', () => {
    expect(diasCorridos('2026-10-01', '2026-12-31')).toBe(91)
    expect(diasCorridos('2026-12-31', '2026-12-30')).toBe(-1)
  })
})

describe('prazo da prestação de contas', () => {
  it('classifica entregue, no prazo, a vencer (15 dias) e vencida', () => {
    expect(situacaoPrazoPrestacao(r({ data_limite: '2026-10-30', data_entrega: '2026-10-01' }), '2026-11-10')).toBe('entregue')
    expect(situacaoPrazoPrestacao(r({ data_limite: '2026-12-30' }), '2026-10-01')).toBe('no_prazo')
    expect(situacaoPrazoPrestacao(r({ data_limite: '2026-10-10' }), '2026-10-01')).toBe('a_vencer')
    expect(situacaoPrazoPrestacao(r({ data_limite: '2026-09-30' }), '2026-10-01')).toBe('vencida')
  })
})

describe('linha do tempo', () => {
  it('ordena eventos de todas as fontes cronologicamente', () => {
    const eventos = montarLinhaDoTempo({
      instrumento: contrato,
      aditivos: [r({ numero: 1, data_assinatura: '2026-05-01', altera_prazo: true, nova_vigencia_fim: '2027-03-31' })],
      parcelas: [r({ numero: 1, valor_pago: 8000, data_pagamento: '2026-03-10' })],
      fiscalizacoes: [],
      ocorrencias: [r({ data: '2026-04-02', titulo: 'Atraso', notificacao_data: '2026-04-03' })],
      prestacoes: [],
    })
    expect(eventos.map((e) => e.data)).toEqual(['2026-02-01', '2026-02-01', '2026-03-10', '2026-04-02', '2026-04-03', '2026-05-01'])
  })
})

describe('código único', () => {
  it('gera sequencial por ano e SRE / município', () => {
    const existentes = ['JUD-2026-UDI-0001', 'JUD-2026-UDI-0007', 'JUD-2026-MOC-0003', 'JUD-2025-UDI-0009']
    expect(gerarCodigoUnico('JUDICIAL', 2026, 'UDI', existentes)).toBe('JUD-2026-UDI-0008')
    expect(gerarCodigoUnico('JUDICIAL', 2026, 'ALM', existentes)).toBe('JUD-2026-ALM-0001')
    expect(gerarCodigoUnico('PTE', 2026, '3170206', ['PTE-2026-3170206-001'])).toBe('PTE-2026-3170206-002')
  })
})
