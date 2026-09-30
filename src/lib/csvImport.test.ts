import { describe, expect, it } from 'vitest'
import { lerCsv, numeroBr } from './csvImport'

describe('importação CSV', () => {
  it('lê CSV do Excel com ; , aspas, acentos no cabeçalho e BOM', () => {
    const t = '\uFEFFMatrícula SIMADE;Nome;Km ida\r\n123;"Silva; João";2,5\r\n456;Ana;10\r\n'
    expect(lerCsv(t)).toEqual([
      { matricula_simade: '123', nome: 'Silva; João', km_ida: '2,5' },
      { matricula_simade: '456', nome: 'Ana', km_ida: '10' },
    ])
  })
  it('converte números brasileiros', () => {
    expect(numeroBr('1.234,56')).toBe(1234.56)
    expect(numeroBr('2.5')).toBe(2.5)
  })
})
