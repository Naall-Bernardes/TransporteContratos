// Documentos de um processo (demanda, adesão ou contrato): lista, versões, envio, ZIP.

import { ChevronDown, ChevronRight, Download, Eye, FileArchive, History, Upload } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import type { Referencias } from '@/features/cadastros/exibicao'
import type { Registro } from '@/lib/dados/tipos'
import { acessarVersao, baixarZip, type MetadadosDocumento } from '@/lib/documentos/servicoDocumentos'
import { formatarData, formatarDataHora } from '@/lib/formatacao'
import { UploadDocumento } from './UploadDocumento'

interface Props {
  processoId: string
  codigoProcesso: string
  dados: Referencias
  podeEnviar: boolean
  aoAlterar: () => Promise<void>
  /** Mostra só os documentos que satisfazem o filtro (ex.: do instrumento). */
  filtro?: (d: Registro) => boolean
  vinculos?: Partial<MetadadosDocumento>
  etapas?: { codigo: string; nome: string }[]
  alunos?: { id: string; nome: string }[]
}

export const tamanho = (b: unknown) => `${(Number(b) / 1048576).toFixed(Number(b) > 1048576 ? 1 : 2)} MB`

export function PainelDocumentos({ processoId, codigoProcesso, dados, podeEnviar, aoAlterar, filtro, vinculos, etapas, alunos }: Props) {
  const usuario = useUsuario()
  const [upload, setUpload] = useState<{ novaVersaoDe?: Registro } | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState('')

  const documentos = (dados.documentos ?? [])
    .filter((d) => d.processo_id === processoId && (!filtro || filtro(d)))
    .filter((d) => !filtroTipo || d.tipo_documento_id === filtroTipo)
    .sort((a, b) => String(b.data_documento).localeCompare(String(a.data_documento)))
  const versoes = (docId: string) => (dados.documento_versoes ?? []).filter((v) => v.documento_id === docId).sort((a, b) => Number(b.versao) - Number(a.versao))
  const tipoNome = (id: unknown) => String(dados.tipos_documento?.find((t) => t.id === id)?.nome ?? '—')
  const usuarioNome = (id: unknown) => String(dados.usuarios?.find((u) => u.id === id)?.nome ?? '—')
  const alunoNome = (id: unknown) => String(dados.alunos?.find((a) => a.id === id)?.nome ?? '')
  const tiposUsados = [...new Set((dados.documentos ?? []).filter((d) => d.processo_id === processoId).map((d) => String(d.tipo_documento_id)))]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select className="campo w-auto" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            {tiposUsados.map((t) => <option key={t} value={t}>{tipoNome(t)}</option>)}
          </select>
          <span className="text-xs text-slate-500">{documentos.length} documento(s) · acesso registrado (LGPD)</span>
        </div>
        <div className="flex gap-2">
          <Botao variante="secundario" disabled={documentos.length === 0} onClick={() => baixarZip(usuario, documentos, `${codigoProcesso}_documentos.zip`, processoId)}>
            <FileArchive size={16} /> Baixar todos (ZIP)
          </Botao>
          {podeEnviar && (
            <Botao onClick={() => setUpload({})}>
              <Upload size={16} /> Enviar documento
            </Botao>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="w-8" />
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Nº SEI</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Etapa</th>
              <th className="px-3 py-2 font-medium">Versão</th>
              <th className="px-3 py-2 font-medium">Enviado por</th>
              <th className="px-3 py-2" aria-label="Ações" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documentos.map((d) => {
              const vs = versoes(d.id)
              const atual = vs[0]
              const expandido = aberto === d.id
              return (
                <Fragment key={d.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="pl-2">
                      {vs.length > 1 && (
                        <button onClick={() => setAberto(expandido ? null : d.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Ver versões">
                          {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {tipoNome(d.tipo_documento_id)}
                      {Boolean(d.aluno_id) && <span className="block text-xs text-slate-500">{alunoNome(d.aluno_id)}</span>}
                      {Boolean(d.observacao) && <span className="block text-xs text-slate-500">{String(d.observacao)}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{String(d.numero_sei ?? '—')}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatarData(d.data_documento)}</td>
                    <td className="px-3 py-2">{String(d.etapa_codigo ?? '—')}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      v{String(d.versao_atual)} {atual && <span className="text-xs text-slate-500">· {tamanho(atual.tamanho_bytes)}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {usuarioNome(atual?.criado_por)}
                      <span className="block text-slate-500">{atual && formatarDataHora(String(atual.criado_em))}</span>
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      {atual && (
                        <>
                          <button onClick={() => acessarVersao(usuario, atual, 'visualizar')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700" title="Visualizar" aria-label="Visualizar">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => acessarVersao(usuario, atual, 'baixar')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700" title="Baixar" aria-label="Baixar">
                            <Download size={16} />
                          </button>
                        </>
                      )}
                      {podeEnviar && (
                        <button onClick={() => setUpload({ novaVersaoDe: d })} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700" title="Enviar nova versão" aria-label="Nova versão">
                          <History size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandido &&
                    vs.slice(1).map((v) => (
                      <tr key={v.id} className="bg-slate-50 text-xs text-slate-600">
                        <td />
                        <td className="px-3 py-1.5" colSpan={4}>
                          Versão {String(v.versao)} (anterior, preservada) · {String(v.nome_arquivo)} · {tamanho(v.tamanho_bytes)}
                        </td>
                        <td className="px-3 py-1.5">v{String(v.versao)}</td>
                        <td className="px-3 py-1.5">{usuarioNome(v.criado_por)}</td>
                        <td className="px-2 py-1 text-right">
                          <button onClick={() => acessarVersao(usuario, v, 'visualizar')} className="rounded p-1 hover:bg-slate-200" aria-label="Visualizar versão"><Eye size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  {expandido && vs[0]?.motivo ? (
                    <tr className="bg-slate-50 text-xs text-slate-600"><td /><td colSpan={7} className="px-3 pb-2">Motivo da versão atual: {String(vs[0].motivo)}</td></tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {documentos.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum documento.</p>}
      </div>

      {upload && (
        <UploadDocumento
          aberto
          aoFechar={() => setUpload(null)}
          aoEnviar={aoAlterar}
          processoId={processoId}
          tipos={dados.tipos_documento ?? []}
          etapas={etapas}
          alunos={alunos}
          vinculos={vinculos}
          novaVersaoDe={upload.novaVersaoDe}
        />
      )}
    </div>
  )
}
