// Guarda os ARQUIVOS (PDF/imagens) no IndexedDB do navegador — o equivalente ao
// Supabase Storage no modo demonstração. Os METADADOS ficam nas tabelas documentos
// e documento_versoes, como todo o resto.

const BANCO = 'transporte-escolar-arquivos'
const LOJA = 'arquivos'

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function operar<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(LOJA, modo).objectStore(LOJA))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const gravarArquivo = (versaoId: string, arquivo: Blob) => operar('readwrite', (l) => l.put(arquivo, versaoId))
export const lerArquivo = (versaoId: string) => operar<Blob | undefined>('readonly', (l) => l.get(versaoId))
export const limparArquivos = () => operar('readwrite', (l) => l.clear())

export async function hashSha256(arquivo: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * PDF mínimo de uma página com um texto — usado para os documentos fictícios da
 * demonstração (que não têm arquivo real).
 */
export function pdfFicticio(linhas: string[]): Blob {
  const ascii = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()\\]/g, ' ')
  const texto = linhas.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 60 ${760 - i * 22} Td (${ascii(l)}) Tj ET`).join('\n')
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objetos.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}
