import { describe, expect, it } from 'vitest'
import { cnpjComDigitos, cpfComDigitos, validarCnpj, validarCpf } from './validacao'

describe('CPF', () => {
  it('aceita CPF válido com ou sem pontuação', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('52998224725')).toBe(true)
  })
  it('recusa dígito errado, tamanho errado e sequência repetida', () => {
    expect(validarCpf('529.982.247-26')).toBe(false)
    expect(validarCpf('5299822472')).toBe(false)
    expect(validarCpf('111.111.111-11')).toBe(false)
  })
  it('gera CPF válido a partir de 9 dígitos', () => {
    expect(validarCpf(cpfComDigitos('123456789'))).toBe(true)
  })
})

describe('CNPJ', () => {
  it('aceita CNPJ numérico válido', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
  })
  it('aceita CNPJ alfanumérico (padrão Receita 2026)', () => {
    expect(validarCnpj('12.ABC.345/01DE-35')).toBe(true)
  })
  it('recusa dígito errado e sequência repetida', () => {
    expect(validarCnpj('11.222.333/0001-82')).toBe(false)
    expect(validarCnpj('00.000.000/0000-00')).toBe(false)
  })
  it('gera CNPJ válido a partir de 12 caracteres', () => {
    expect(validarCnpj(cnpjComDigitos('99887766000' + '1'))).toBe(true)
  })
})
