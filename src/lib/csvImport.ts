// Leitura de CSV exportado do Excel (separador ";" ou ",", com ou sem aspas, com ou sem BOM).

export function lerCsv(texto: string): Record<string, string>[] {
  const limpo = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!limpo) return []
  const primeira = limpo.split('\n')[0]
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) {
      linha.push(campo)
      campo = ''
    } else if (c === '\n') {
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else campo += c
  }
  linha.push(campo)
  linhas.push(linha)
  const normalizar = (t: string) => t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')
  const cabecalho = linhas[0].map(normalizar)
  return linhas.slice(1).filter((l) => l.some((v) => v.trim())).map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, (l[i] ?? '').trim()])))
}

/** Converte número no formato brasileiro ("2,5" ou "1.234,56") ou internacional. */
export function numeroBr(v: string | undefined): number {
  if (!v) return NaN
  const s = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v
  return Number(s)
}
