// Código único que amarra todos os artefatos de uma demanda/instrumento.
//   Judicial: JUD-2026-UDI-0001  (ano + sigla da SRE + sequencial de 4 dígitos por ano e SRE)
//   PTE:      PTE-2026-3170206-001 (ano + código IBGE do município + sequencial de 3 dígitos)

export type Modulo = 'JUDICIAL' | 'PTE'

export function gerarCodigoUnico(modulo: Modulo, ano: number, chave: string, existentes: string[]): string {
  const prefixo = `${modulo === 'JUDICIAL' ? 'JUD' : 'PTE'}-${ano}-${chave}-`
  const digitos = modulo === 'JUDICIAL' ? 4 : 3
  const maior = existentes
    .filter((c) => c.startsWith(prefixo))
    .map((c) => Number(c.slice(prefixo.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0)
  return prefixo + String(maior + 1).padStart(digitos, '0')
}
