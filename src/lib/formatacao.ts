const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR')

export const formatarMoeda = (v: unknown) => (v === null || v === undefined ? '' : moeda.format(Number(v)))
export const formatarNumero = (v: unknown) => (v === null || v === undefined ? '' : numero.format(Number(v)))

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' (sem passar por Date, para não sofrer com fuso horário). */
export function formatarData(iso: unknown): string {
  if (!iso) return ''
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Formata CPF (11 caracteres) ou CNPJ (14, inclusive alfanumérico). */
export function formatarCpfCnpj(v: unknown): string {
  const s = String(v ?? '')
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (s.length === 14) return s.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
  return s
}
