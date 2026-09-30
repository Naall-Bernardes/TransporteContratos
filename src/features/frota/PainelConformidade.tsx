// Situação documental (CTB/DETRAN/SEE) de contratado, veículos e condutores, com envio de documentos.

import { AlertTriangle, Bus, Building2, CheckCircle2, Eye, Upload, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Selo } from '@/components/comum/Selo'
import { useUsuario } from '@/features/auth/Sessao'
import type { Referencias } from '@/features/cadastros/exibicao'
import { UploadDocumento } from '@/features/documentos/UploadDocumento'
import { ROTULO_STATUS_DOC, type ConformidadeEntidade, type ItemConformidade, type StatusDocumento } from '@/lib/conformidade'
import { acessarVersao } from '@/lib/documentos/servicoDocumentos'
import { formatarData } from '@/lib/formatacao'

const COR: Record<StatusDocumento, 'verde' | 'amarelo' | 'vermelho' | 'cinza'> = { em_dia: 'verde', a_vencer: 'amarelo', vencido: 'vermelho', ausente: 'vermelho' }
const ICONE = { veiculo: Bus, condutor: UserRound, contratado: Building2 }
const CAMPO = { veiculo: 'veiculo_id', condutor: 'condutor_id', contratado: 'transportador_id' } as const
const FORCA: Record<string, string> = { lei: 'Lei', see: 'Norma SEE', recomendada: 'Recomendada' }

interface Props {
  entidades: ConformidadeEntidade[]
  dados: Referencias
  podeEnviar: boolean
  aoAlterar: () => Promise<void>
  /** Mostra também itens em dia (default: sim). */
  mostrarEmDia?: boolean
}

export function PainelConformidade({ entidades, dados, podeEnviar, aoAlterar, mostrarEmDia = true }: Props) {
  const usuario = useUsuario()
  const [envio, setEnvio] = useState<{ entidade: ConformidadeEntidade; item: ItemConformidade } | null>(null)
  const versaoDe = (doc: ItemConformidade['documento']) =>
    doc && dados.documento_versoes?.find((v) => v.documento_id === doc.id && v.versao === doc.versao_atual)

  if (entidades.length === 0)
    return <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">Nenhum veículo, condutor ou contratado vinculado.</p>

  return (
    <div className="space-y-3">
      {entidades.map((e) => {
        const Icone = ICONE[e.entidade]
        const itens = mostrarEmDia ? e.itens : e.itens.filter((i) => i.status !== 'em_dia')
        const aVencer = e.itens.filter((i) => i.status === 'a_vencer').length
        return (
          <section key={`${e.entidade}-${e.registro.id}`} className="rounded-lg border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icone size={16} className="text-slate-500" /> {e.rotulo || String(e.registro.nome ?? e.registro.razao_social ?? '')}
                <span className="text-xs font-normal text-slate-500">{e.entidade === 'contratado' ? 'contratado (habilitação)' : e.entidade}</span>
              </h3>
              {e.pendentes.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700"><AlertTriangle size={14} /> {e.pendentes.length} obrigatório(s) pendente(s)</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                  <CheckCircle2 size={14} /> Documentação obrigatória em dia{aVencer ? ` · ${aVencer} a vencer` : ''}
                </span>
              )}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {itens.map((i) => {
                    const versao = versaoDe(i.documento)
                    return (
                      <tr key={String(i.exigencia.id)} className={i.obrigatoria && (i.status === 'vencido' || i.status === 'ausente') ? 'bg-red-50/60' : ''}>
                        <td className="px-4 py-1.5">
                          {String(i.exigencia.nome)}
                          <span className="block text-xs text-slate-500">{FORCA[String(i.exigencia.forca)]} · {String(i.exigencia.base_legal ?? '')}</span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap"><Selo cor={i.obrigatoria ? COR[i.status] : i.status === 'em_dia' ? 'verde' : 'cinza'}>{ROTULO_STATUS_DOC[i.status]}</Selo></td>
                        <td className="px-3 py-1.5 text-xs whitespace-nowrap text-slate-600">
                          {i.validade ? `válido até ${formatarData(i.validade)}` : i.documento ? 'sem vencimento' : ''}
                        </td>
                        <td className="px-3 py-1 text-right whitespace-nowrap">
                          {versao && (
                            <button onClick={() => acessarVersao(usuario, versao, 'visualizar')} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700" title="Ver documento" aria-label="Ver documento">
                              <Eye size={15} />
                            </button>
                          )}
                          {podeEnviar && (
                            <button onClick={() => setEnvio({ entidade: e, item: i })} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-marca-700 hover:bg-marca-50" title="Enviar documento">
                              <Upload size={13} /> {i.documento ? 'Atualizar' : 'Enviar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {envio && (
        <UploadDocumento
          aberto
          aoFechar={() => setEnvio(null)}
          aoEnviar={aoAlterar}
          processoId={null}
          tipos={dados.tipos_documento ?? []}
          vinculos={{ [CAMPO[envio.entidade.entidade]]: envio.entidade.registro.id }}
          inicial={{ tipo_documento_id: String(envio.item.exigencia.tipo_documento_id) }}
          pedirValidade={envio.item.exigencia.validade_meses === null || envio.item.exigencia.validade_meses === undefined || envio.item.exigencia.validade_meses === ''}
          orientacao={`${envio.entidade.rotulo} — ${envio.item.exigencia.nome}. Base: ${envio.item.exigencia.base_legal ?? '-'}.${envio.item.exigencia.validade_meses ? ` Vale por ${envio.item.exigencia.validade_meses} meses a partir da data do documento.` : ''}`}
        />
      )}
    </div>
  )
}
