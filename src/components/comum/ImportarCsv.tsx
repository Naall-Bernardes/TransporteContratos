import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { lerCsv } from '@/lib/csvImport'
import type { ResultadoImportacao } from '@/lib/dados/servicos'

interface Props {
  titulo: string
  /** Texto explicando as colunas esperadas. */
  colunas: string
  importar: (linhas: Record<string, string>[]) => Promise<ResultadoImportacao>
  aoConcluir: () => Promise<void>
}

export function ImportarCsv({ titulo, colunas, importar, aoConcluir }: Props) {
  const [aberto, setAberto] = useState(false)
  const [linhas, setLinhas] = useState<Record<string, string>[] | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)

  async function ler(arquivo: File | undefined) {
    setResultado(null)
    setLinhas(arquivo ? lerCsv(await arquivo.text()) : null)
  }

  async function confirmar() {
    const r = await importar(linhas!)
    setResultado(r)
    setLinhas(null)
    await aoConcluir()
  }

  return (
    <>
      <Botao variante="secundario" onClick={() => { setAberto(true); setLinhas(null); setResultado(null) }}>
        <FileUp size={16} /> {titulo}
      </Botao>
      <Modal titulo={titulo} aberto={aberto} aoFechar={() => setAberto(false)} largura="md">
        <p className="text-sm text-slate-600">Arquivo CSV (no Excel: Salvar como → CSV UTF-8). Colunas: {colunas}.</p>
        <input type="file" accept=".csv,text/csv" className="campo mt-3" onChange={(e) => ler(e.target.files?.[0])} aria-label="Arquivo CSV" />
        {linhas && (
          <div className="mt-3 text-sm">
            <p>{linhas.length} linha(s) encontradas. Colunas lidas: {Object.keys(linhas[0] ?? {}).join(', ') || '—'}</p>
            <div className="mt-3 flex justify-end">
              <Botao onClick={confirmar} disabled={!linhas.length}>Importar {linhas.length} linha(s)</Botao>
            </div>
          </div>
        )}
        {resultado && (
          <div className="mt-3 text-sm">
            <p className="text-green-700">{resultado.incluidos} incluída(s), {resultado.atualizados} atualizada(s).</p>
            {resultado.erros.length > 0 && (
              <ul className="mt-2 max-h-48 list-disc overflow-y-auto pl-5 text-red-700">
                {resultado.erros.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
