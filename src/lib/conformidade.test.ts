import { describe, expect, it } from 'vitest'
import type { Registro } from './dados/tipos'
import { avaliarEntidade } from './conformidade'

const r = (c: Record<string, unknown>) => ({ id: crypto.randomUUID(), ...c }) as Registro

const exigencias = [
  r({ codigo: 'laudo', aplica_a: 'veiculo', condicao: 'rodoviario', tipo_documento_id: 't-laudo', forca: 'lei', validade_meses: 6 }),
  r({ codigo: 'crlv', aplica_a: 'veiculo', condicao: 'rodoviario', tipo_documento_id: 't-crlv', forca: 'lei', validade_meses: null }),
  r({ codigo: 'tie', aplica_a: 'veiculo', condicao: 'aquaviario', tipo_documento_id: 't-tie', forca: 'lei', validade_meses: 0 }),
  r({ codigo: 'seguro', aplica_a: 'veiculo', condicao: 'rodoviario', tipo_documento_id: 't-seguro', forca: 'recomendada', validade_meses: 12 }),
  r({ codigo: 'cnh', aplica_a: 'condutor', condicao: 'motorista', tipo_documento_id: 't-cnh', forca: 'lei', validade_meses: null }),
]

describe('conformidade documental', () => {
  const van = r({ tipo_transporte: 'rodoviario' })
  const hoje = '2026-10-01'

  it('aplica só as exigências do tipo (rodoviário ≠ aquaviário) e da entidade', () => {
    const c = avaliarEntidade('veiculo', van, exigencias, [], hoje)
    expect(c.itens.map((i) => i.exigencia.codigo)).toEqual(['laudo', 'crlv', 'seguro'])
  })

  it('validade pela periodicidade (laudo semestral) ou pela data informada (CRLV)', () => {
    const docs = [
      r({ veiculo_id: van.id, tipo_documento_id: 't-laudo', data_documento: '2026-03-15' }), // vence 15/09 → vencido
      r({ veiculo_id: van.id, tipo_documento_id: 't-crlv', data_documento: '2026-01-10', data_validade: '2026-10-20' }), // a vencer
    ]
    const c = avaliarEntidade('veiculo', van, exigencias, docs, hoje)
    const s = Object.fromEntries(c.itens.map((i) => [i.exigencia.codigo, i.status]))
    expect(s).toEqual({ laudo: 'vencido', crlv: 'a_vencer', seguro: 'ausente' })
  })

  it('pendências obrigatórias ignoram as recomendadas e usam o documento mais recente', () => {
    const docs = [
      r({ veiculo_id: van.id, tipo_documento_id: 't-laudo', data_documento: '2026-03-15' }),
      r({ veiculo_id: van.id, tipo_documento_id: 't-laudo', data_documento: '2026-09-10' }),
      r({ veiculo_id: van.id, tipo_documento_id: 't-crlv', data_documento: '2026-01-10', data_validade: '2027-01-10' }),
    ]
    const c = avaliarEntidade('veiculo', van, exigencias, docs, hoje)
    expect(c.pendentes).toHaveLength(0) // seguro ausente é só recomendação
  })
})
