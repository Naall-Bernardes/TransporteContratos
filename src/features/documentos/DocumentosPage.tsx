// Busca no repositório de documentos: por código único, nº SEI, aluno, escola,
// município, tipo e período. Resultado pode ser baixado em ZIP.

import { Download, Eye, FileArchive, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { acessarVersao, baixarZip } from '@/lib/documentos/servicoDocumentos'
import { formatarData } from '@/lib/formatacao'
import { tamanho } from './PainelDocumentos'

export function DocumentosPage() {
  const usuario = useUsuario()
  const { dados } = useTodos()
  const [f, setF] = useState({ codigo: '', sei: '', aluno: '', escola: '', municipio: '', tipo: '', de: '', ate: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const linhas = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
    const contem = (a: unknown, b: string) => !b || String(a ?? '').toLocaleLowerCase('pt-BR').includes(b.toLocaleLowerCase('pt-BR'))
    return lista('documentos')
      .map((doc) => {
        const processo = achar('processos', doc.processo_id)
        const demanda = lista('demandas').find((x) => x.processo_id === doc.processo_id)
        const adesao = lista('adesoes_pte').find((x) => x.processo_id === doc.processo_id)
        const escola = achar('escolas', demanda?.escola_id)
        const municipio = achar('municipios', escola?.municipio_id ?? adesao?.municipio_id ?? processo?.municipio_id)
        const alunos = demanda
          ? lista('demanda_alunos').filter((x) => x.demanda_id === demanda.id).map((x) => String(achar('alunos', x.aluno_id)?.nome ?? ''))
          : []
        const alunoDoc = doc.aluno_id ? String(achar('alunos', doc.aluno_id)?.nome ?? '') : ''
        const versao = lista('documento_versoes').find((v) => v.documento_id === doc.id && v.versao === doc.versao_atual)
        const link = demanda ? `/judicial/${demanda.id}` : adesao ? `/pte/adesoes/${adesao.id}` : doc.instrumento_id ? `/contratos/${doc.instrumento_id}` : null
        return { doc, processo, escola, municipio, alunos: alunoDoc ? [alunoDoc] : alunos, versao, tipo: String(achar('tipos_documento', doc.tipo_documento_id)?.nome ?? ''), link }
      })
      .filter((l) => contem(l.processo?.codigo, f.codigo))
      .filter((l) => !f.sei || contem(l.doc.numero_sei, f.sei) || contem(l.processo?.numero_sei, f.sei))
      .filter((l) => !f.aluno || l.alunos.some((a) => contem(a, f.aluno)))
      .filter((l) => contem(l.escola?.nome, f.escola))
      .filter((l) => contem(l.municipio?.nome, f.municipio))
      .filter((l) => !f.tipo || l.doc.tipo_documento_id === f.tipo)
      .filter((l) => (!f.de || String(l.doc.data_documento) >= f.de) && (!f.ate || String(l.doc.data_documento) <= f.ate))
      .sort((a, b) => String(b.doc.data_documento).localeCompare(String(a.doc.data_documento)))
  }, [dados, f])

  const filtrando = Object.values(f).some(Boolean)

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Repositório de documentos</h1>
      <p className="mt-1 text-sm text-slate-600">Todos os documentos ficam vinculados a um processo (código único). Armazenamento privado, links temporários e registro de cada visualização/download (LGPD).</p>

      <div className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="campo" placeholder="Código único (JUD-/PTE-)" value={f.codigo} onChange={set('codigo')} aria-label="Código único" />
        <input className="campo" placeholder="Nº SEI" value={f.sei} onChange={set('sei')} aria-label="Nº SEI" />
        <input className="campo" placeholder="Aluno" value={f.aluno} onChange={set('aluno')} aria-label="Aluno" />
        <input className="campo" placeholder="Escola" value={f.escola} onChange={set('escola')} aria-label="Escola" />
        <input className="campo" placeholder="Município" value={f.municipio} onChange={set('municipio')} aria-label="Município" />
        <select className="campo" value={f.tipo} onChange={set('tipo')} aria-label="Tipo de documento">
          <option value="">Todos os tipos</option>
          {[...(dados.tipos_documento ?? [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map((t) => <option key={t.id} value={t.id}>{String(t.nome)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">De <input type="date" className="campo" value={f.de} onChange={set('de')} /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600">Até <input type="date" className="campo" value={f.ate} onChange={set('ate')} /></label>
      </div>

      <div className="mt-3 mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600"><Search size={14} className="mr-1 inline" />{linhas.length} documento(s){filtrando ? ' encontrados' : ''}</p>
        <Botao variante="secundario" disabled={!linhas.length || linhas.length > 300} onClick={() => baixarZip(usuario, linhas.map((l) => l.doc as Registro), `documentos_${hojeIso()}.zip`, null)}>
          <FileArchive size={16} /> Baixar resultado (ZIP)
        </Botao>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Processo</th>
              <th className="px-3 py-2 font-medium">Documento</th>
              <th className="px-3 py-2 font-medium">Nº SEI</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Escola / município</th>
              <th className="px-3 py-2 font-medium">Versão</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.slice(0, 300).map((l) => (
              <tr key={l.doc.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{l.link ? <Link to={l.link} className="text-marca-700 hover:underline">{String(l.processo?.codigo)}</Link> : String(l.processo?.codigo ?? '')}</td>
                <td className="px-3 py-2">{l.tipo}{l.alunos.length > 0 && <span className="block text-xs text-slate-500">{l.alunos.join(', ')}</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{String(l.doc.numero_sei ?? '—')}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatarData(l.doc.data_documento)}</td>
                <td className="px-3 py-2">{String(l.escola?.nome ?? '—')}<span className="block text-xs text-slate-500">{String(l.municipio?.nome ?? '')}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">v{String(l.doc.versao_atual)} {l.versao && <span className="text-xs text-slate-500">· {tamanho(l.versao.tamanho_bytes)}</span>}</td>
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  {l.versao && (
                    <>
                      <button onClick={() => acessarVersao(usuario, l.versao!, 'visualizar')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700" aria-label="Visualizar" title="Visualizar"><Eye size={16} /></button>
                      <button onClick={() => acessarVersao(usuario, l.versao!, 'baixar')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700" aria-label="Baixar" title="Baixar"><Download size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhum documento encontrado.</p>}
        {linhas.length > 300 && <p className="px-3 py-2 text-xs text-slate-500">Mostrando os 300 mais recentes — refine a busca.</p>}
      </div>
    </div>
  )
}
