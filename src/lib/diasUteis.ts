// Contagem de prazos em dias úteis.
// Datas sempre no formato ISO 'AAAA-MM-DD' e calculadas em UTC, para não haver
// erro de um dia por causa de fuso horário.
// Convenção de prazo: exclui o dia do início e inclui o dia do fim.

function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

const paraIso = (data: Date) => data.toISOString().slice(0, 10)

function proximoDia(iso: string, passo = 1): string {
  const data = paraData(iso)
  data.setUTCDate(data.getUTCDate() + passo)
  return paraIso(data)
}

export function ehDiaUtil(iso: string, feriados: ReadonlySet<string>): boolean {
  const diaSemana = paraData(iso).getUTCDay()
  return diaSemana !== 0 && diaSemana !== 6 && !feriados.has(iso)
}

/** Data em que se completam `dias` dias úteis contados a partir de `inicio`. */
export function somarDiasUteis(inicio: string, dias: number, feriados: ReadonlySet<string>): string {
  let atual = inicio
  let contados = 0
  while (contados < dias) {
    atual = proximoDia(atual)
    if (ehDiaUtil(atual, feriados)) contados++
  }
  return atual
}

/** Dias úteis entre duas datas. Negativo quando `fim` é anterior a `inicio` (prazo vencido). */
export function diasUteisEntre(inicio: string, fim: string, feriados: ReadonlySet<string>): number {
  if (inicio === fim) return 0
  const sinal = fim > inicio ? 1 : -1
  let atual = inicio
  let contados = 0
  while (atual !== fim) {
    atual = proximoDia(atual, sinal)
    const conta = sinal === 1 ? atual : proximoDia(atual, 1)
    if (ehDiaUtil(conta, feriados)) contados++
  }
  return contados * sinal
}

export const hojeIso = () => {
  const agora = new Date()
  return paraIso(new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())))
}
