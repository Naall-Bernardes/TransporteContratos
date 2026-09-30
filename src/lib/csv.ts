// Exportação CSV no padrão do Excel em português: separador ";" e BOM UTF-8
// (sem o BOM o Excel mostra acentos quebrados).

const escapar = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function gerarCsv(cabecalho: string[], linhas: string[][]): string {
  return '\uFEFF' + [cabecalho, ...linhas].map((l) => l.map(escapar).join(';')).join('\r\n')
}

export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
