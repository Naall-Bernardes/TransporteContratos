// Validação de documentos brasileiros.
// CNPJ aceita o formato alfanumérico da Receita Federal (em vigor desde jul/2026):
// 12 caracteres [A-Z0-9] + 2 dígitos verificadores numéricos.

export const somenteDigitos = (valor: string) => valor.replace(/\D/g, '')

/** Remove pontuação e deixa em maiúsculas (serve para CPF e CNPJ, inclusive alfanumérico). */
export const normalizarDocumento = (valor: string) => valor.toUpperCase().replace(/[^A-Z0-9]/g, '')

function digitoCpf(base: string): number {
  const soma = [...base].reduce((s, c, i) => s + Number(c) * (base.length + 1 - i), 0)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

/** Recebe os 9 primeiros dígitos e devolve o CPF completo com os verificadores. */
export function cpfComDigitos(noveDigitos: string): string {
  const d1 = digitoCpf(noveDigitos)
  const d2 = digitoCpf(noveDigitos + d1)
  return `${noveDigitos}${d1}${d2}`
}

export function validarCpf(valor: string): boolean {
  const cpf = somenteDigitos(valor)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  return cpfComDigitos(cpf.slice(0, 9)) === cpf
}

const PESOS_CNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function digitoCnpj(base: string): number {
  const pesos = PESOS_CNPJ.slice(PESOS_CNPJ.length - base.length)
  // Regra da Receita: valor do caractere = código ASCII − 48 (0–9 continuam 0–9; A = 17, B = 18…)
  const soma = [...base].reduce((s, c, i) => s + (c.charCodeAt(0) - 48) * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** Recebe os 12 primeiros caracteres e devolve o CNPJ completo com os verificadores. */
export function cnpjComDigitos(dozeCaracteres: string): string {
  const d1 = digitoCnpj(dozeCaracteres)
  const d2 = digitoCnpj(dozeCaracteres + d1)
  return `${dozeCaracteres}${d1}${d2}`
}

export function validarCnpj(valor: string): boolean {
  const cnpj = normalizarDocumento(valor)
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false
  return cnpjComDigitos(cnpj.slice(0, 12)) === cnpj
}
