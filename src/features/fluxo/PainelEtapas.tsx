import { AlertTriangle, Check, CheckCircle2, Circle, CircleDot, FileWarning, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Semaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import type { Referencias } from '@/features/cadastros/exibicao'
import { UploadDocumento } from '@/features/documentos/UploadDocumento'
import { ErroPermissao, ErroRegra, salvar } from '@/lib/dados/repositorio'
import { concluirEtapa, feriadosDe } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import { CONDICOES } from '@/lib/fluxo/checklist'
import { avaliarEtapa, etapaAtual, montarDadosProcesso } from '@/lib/fluxo/processo'
import { calcularSemaforo, duracaoDiasUteis } from '@/lib/fluxo/sla'
import { formatarData } from '@/lib/formatacao'
import { ehDiretorOuCentral, podeEditar as podeEditarRegistro } from '@/lib/permissoes'

interface Props {
  processoId: string
  modulo: 'JUDICIAL' | 'PTE'
  dados: Referencias
  aoAlterar: () => Promise<void>
  alunos?: { id: string; nome: string }[]
}

export function PainelEtapas({ processoId, modulo, dados, aoAlterar, alunos }: Props) {
  const usuario = useUsuario()
  const hoje = hojeIso()
  const lista = (c: Colecao) => dados[c] ?? []
  const feriados = feriadosDe(lista)
  const [justificando, setJustificando] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [upload, setUpload] = useState<{ tipo_documento_id: string; etapa_codigo: string } | null>(null)

  const modelos = lista('etapas_modelo').filter((m) => m.modulo === modulo).sort((a, b) => Number(a.ordem) - Number(b.ordem))
  const d = useMemo(() => montarDadosProcesso((c) => dados[c] ?? [], processoId), [dados, processoId])
  const { instancia, modelo } = etapaAtual(d, modelos)
  const avaliacao = instancia && modelo ? avaliarEtapa(d, modelo, lista('checklist_modelo'), lista('tipos_documento')) : null
  const instanciaDe = (m: Registro) => d.etapas.find((e) => e.etapa_modelo_id === m.id)
  const consulta = (c: Colecao, id: unknown) => dados[c]?.find((r) => r.id === id)
  const podeAtuar = !!instancia && podeEditarRegistro(usuario, 'processo_etapas', instancia, consulta)
  const nomeUsuario = (id: unknown) => String(dados.usuarios?.find((u) => u.id === id)?.nome ?? '—')
  const encerrado = d.demanda ? d.demanda.situacao !== 'ativa' : d.adesao?.status === 'encerrado'
  const semaforo = calcularSemaforo(
    { prazoJudicial: d.demanda?.prazo_judicial as string, inicioTransporte: d.demanda?.data_inicio_transporte as string, prazoEtapa: instancia?.prazo_sla as string, encerrado },
    hoje,
    feriados,
  )

  async function concluir(comJustificativa?: string) {
    setErro(null)
    try {
      await concluirEtapa(usuario, instancia!.id, comJustificativa)
      setJustificando(false)
      setJustificativa('')
      await aoAlterar()
    } catch (e) {
      if (e instanceof ErroRegra || e instanceof ErroPermissao) setErro(e.message)
      else throw e
    }
  }

  async function trocarResponsavel(id: string) {
    await salvar('processo_etapas', { id: instancia!.id, responsavel_id: id || null }, usuario)
    await aoAlterar()
  }

  const docsFaltando = avaliacao?.faltantes.length ?? 0
  const dadosFaltando = avaliacao?.pendencias.length ?? 0
  const responsaveis = (dados.usuarios ?? []).filter((u) => u.ativo && (!u.sre_id || u.sre_id === d.processo?.sre_id))

  return (
    <div className="space-y-4">
      {/* Sequência de etapas */}
      <ol className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
        {modelos.map((m) => {
          const e = instanciaDe(m)
          const status = e?.status ?? 'nao_iniciada'
          const Icone = status === 'concluida' ? CheckCircle2 : status === 'em_andamento' ? CircleDot : Circle
          const cor = status === 'concluida' ? 'text-green-600' : status === 'em_andamento' ? 'text-marca-600' : 'text-slate-300'
          return (
            <li key={m.id} className={`min-w-28 flex-1 rounded-md px-2 py-1.5 ${status === 'em_andamento' ? 'bg-marca-50 ring-1 ring-marca-100' : ''}`}>
              <div className="flex items-center gap-1.5">
                <Icone size={16} className={cor} />
                <span className="text-xs font-semibold text-slate-500">{String(m.ordem)}</span>
              </div>
              <p className="mt-0.5 text-xs leading-tight text-slate-800">{String(m.nome)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {status === 'concluida' ? `✓ ${formatarData(e!.concluida_em)}` : status === 'em_andamento' ? (e!.prazo_sla ? `prazo ${formatarData(e!.prazo_sla)}` : 'contínua') : ''}
              </p>
            </li>
          )
        })}
      </ol>

      {/* Etapa atual */}
      {instancia && modelo ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase">Etapa atual · {String(modelo.codigo)}</p>
              <h3 className="text-base font-semibold text-slate-900">
                {String(modelo.ordem)}. {String(modelo.nome)}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Iniciada em {formatarData(instancia.iniciada_em)} · {duracaoDiasUteis(String(instancia.iniciada_em), null, hoje, feriados)} dia(s) útil(eis) ·{' '}
                SLA {modelo.sla_dias_uteis ? `${modelo.sla_dias_uteis} dias úteis (prazo ${formatarData(instancia.prazo_sla)})` : 'não se aplica (etapa contínua)'}
              </p>
            </div>
            <Semaforo semaforo={semaforo} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="resp" className="text-slate-600">Responsável:</label>
            {podeAtuar ? (
              <select id="resp" className="campo w-auto" value={String(instancia.responsavel_id ?? '')} onChange={(e) => trocarResponsavel(e.target.value)}>
                <option value="">— não definido —</option>
                {responsaveis.map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
              </select>
            ) : (
              <span>{nomeUsuario(instancia.responsavel_id)}</span>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">Checklist de documentos</h4>
              {avaliacao!.checklist.length === 0 && <p className="text-sm text-slate-500">Nenhum documento obrigatório nesta etapa.</p>}
              <ul className="space-y-1.5">
                {avaliacao!.checklist.map((item) => (
                  <li key={item.tipo_documento_id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="flex items-start gap-2">
                      {item.atendido ? (
                        <Check size={16} className="mt-0.5 shrink-0 text-green-600" />
                      ) : item.exigido ? (
                        <FileWarning size={16} className="mt-0.5 shrink-0 text-red-500" />
                      ) : (
                        <Circle size={14} className="mt-0.5 shrink-0 text-slate-300" />
                      )}
                      <span className={item.exigido || item.atendido ? '' : 'text-slate-400'}>
                        {item.nome}
                        {item.condicao !== 'sempre' && <span className="block text-xs text-slate-500">{CONDICOES[item.condicao]}{!item.exigido && ' — não se aplica a este caso'}</span>}
                        {item.quantidade > 1 && <span className="text-xs text-slate-500"> ({item.quantidade})</span>}
                      </span>
                    </span>
                    {podeAtuar && !item.atendido && (
                      <button onClick={() => setUpload({ tipo_documento_id: item.tipo_documento_id, etapa_codigo: String(modelo.codigo) })} className="inline-flex shrink-0 items-center gap-1 text-xs text-marca-700 hover:underline">
                        <Upload size={12} /> Enviar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">Requisitos para concluir</h4>
              {dadosFaltando === 0 ? (
                <p className="flex items-center gap-2 text-sm text-green-700"><Check size={16} /> Dados completos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {avaliacao!.pendencias.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {p}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          {podeAtuar && (
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              {docsFaltando > 0 && dadosFaltando === 0 && ehDiretorOuCentral(usuario) && (
                <Botao variante="secundario" onClick={() => setJustificando(true)}>Concluir com justificativa ({docsFaltando} doc. faltando)</Botao>
              )}
              <Botao onClick={() => concluir()} disabled={docsFaltando > 0 || dadosFaltando > 0} title={docsFaltando || dadosFaltando ? 'Há pendências' : undefined}>
                <CheckCircle2 size={16} /> Concluir etapa
              </Botao>
            </div>
          )}
          {podeAtuar && docsFaltando > 0 && dadosFaltando === 0 && !ehDiretorOuCentral(usuario) && (
            <p className="mt-2 text-right text-xs text-slate-500">Para avançar sem todos os documentos, peça ao Diretor DAFI ou ao órgão central (com justificativa).</p>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Todas as etapas foram concluídas.</p>
      )}

      {/* Histórico: tempo por etapa × SLA */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Etapa</th>
              <th className="px-3 py-2 font-medium">Início</th>
              <th className="px-3 py-2 font-medium">Conclusão</th>
              <th className="px-3 py-2 font-medium">Dias úteis</th>
              <th className="px-3 py-2 font-medium">SLA</th>
              <th className="px-3 py-2 font-medium">Responsável</th>
              <th className="px-3 py-2 font-medium">Observação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {modelos.filter(instanciaDe).map((m) => {
              const e = instanciaDe(m)!
              const dur = duracaoDiasUteis(String(e.iniciada_em), (e.concluida_em as string) ?? null, hoje, feriados)
              const sla = m.sla_dias_uteis as number | null
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2">{String(m.codigo)} – {String(m.nome)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatarData(e.iniciada_em)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.concluida_em ? formatarData(e.concluida_em) : 'em andamento'}</td>
                  <td className={`px-3 py-2 tabular-nums ${sla && dur > sla ? 'font-medium text-red-600' : ''}`}>{dur}</td>
                  <td className="px-3 py-2 tabular-nums">{sla ?? '—'}</td>
                  <td className="px-3 py-2">{nomeUsuario(e.responsavel_id)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {e.justificativa_avanco ? `Avançou sem: ${e.documentos_dispensados}. Justificativa: ${e.justificativa_avanco} (${nomeUsuario(e.dispensa_autorizada_por)})` : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal titulo="Concluir etapa com checklist incompleto" aberto={justificando} aoFechar={() => setJustificando(false)} largura="md">
        <p className="text-sm text-slate-700">Documentos faltando: <strong>{avaliacao?.faltantes.map((f) => f.nome).join(', ')}</strong>.</p>
        <p className="mt-2 text-sm text-slate-600">A justificativa fica registrada com seu nome e aparece no histórico da etapa.</p>
        <textarea className="campo mt-3" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} aria-label="Justificativa" placeholder="Por que avançar sem estes documentos?" />
        {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setJustificando(false)}>Cancelar</Botao>
          <Botao onClick={() => concluir(justificativa)} disabled={justificativa.trim().length < 10}>Concluir etapa</Botao>
        </div>
      </Modal>

      {upload && (
        <UploadDocumento
          aberto
          aoFechar={() => setUpload(null)}
          aoEnviar={aoAlterar}
          processoId={processoId}
          tipos={dados.tipos_documento ?? []}
          etapas={modelos.map((m) => ({ codigo: String(m.codigo), nome: String(m.nome) }))}
          alunos={alunos}
          inicial={upload}
        />
      )}
    </div>
  )
}
