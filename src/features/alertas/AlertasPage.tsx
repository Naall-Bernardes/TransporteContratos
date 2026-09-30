import { ChevronDown, ChevronRight, Mail, Send } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { ErroPermissao } from '@/lib/dados/repositorio'
import { processarAlertas } from '@/lib/dados/servicosMonitoramento'
import { useTodos } from '@/lib/dados/useColecao'
import { formatarDataHora } from '@/lib/formatacao'
import { ehCentral } from '@/lib/permissoes'

const TIPOS: Record<string, string> = {
  sla_etapa: 'Prazo de etapa (SLA)',
  prazo_judicial: 'Prazo judicial',
  vigencia: 'Vigência de instrumento',
  prestacao_contas: 'Prestação de contas',
  documentacao: 'Documentação de veículo/condutor/contratado',
  despesa_pte: 'Comprovação de despesa PTE',
}

export function AlertasPage() {
  const usuario = useUsuario()
  const { dados, recarregar } = useTodos()
  const [aberto, setAberto] = useState<string | null>(null)
  const [tipo, setTipo] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const alertas = [...(dados.alertas ?? [])]
    .filter((a) => !tipo || a.tipo === tipo)
    .sort((a, b) => String(b.enviado_em).localeCompare(String(a.enviado_em)) || Number(b.nivel) - Number(a.nivel))

  async function processar() {
    try {
      const n = await processarAlertas(usuario)
      setMsg(n ? `${n} e-mail(s) de alerta gerado(s).` : 'Nenhum alerta novo: os pendentes já tinham sido enviados.')
      await recarregar()
    } catch (e) {
      if (e instanceof ErroPermissao) setMsg(e.message)
      else throw e
    }
  }

  const processoDe = (id: unknown) => dados.processos?.find((p) => p.id === id)
  const linkDe = (processoId: unknown, instrumentoId: unknown) => {
    const dem = dados.demandas?.find((d) => d.processo_id === processoId)
    if (dem) return `/judicial/${dem.id}`
    const ad = dados.adesoes_pte?.find((d) => d.processo_id === processoId)
    if (ad && !instrumentoId) return `/pte/adesoes/${ad.id}`
    return instrumentoId ? `/contratos/${instrumentoId}` : null
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Alertas por e-mail</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Substituem os avisos por WhatsApp. Escalonamento: nível 1 → responsável; nível 2 → + Diretor DAFI da SRE; nível 3 → + órgão central.
            Cada alerta é enviado uma única vez por situação (sem repetição).
          </p>
        </div>
        {ehCentral(usuario) && <Botao onClick={processar}><Send size={16} /> Processar alertas agora</Botao>}
      </div>
      <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Modo demonstração: os e-mails são <strong>simulados</strong> e ficam nesta caixa de saída. Em produção, o processamento roda sozinho todo dia útil às 7h (agendador do banco) e envia pelo servidor de e-mail institucional.
      </div>
      {msg && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      <select className="campo mb-3 w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de alerta">
        <option value="">Todos os tipos</option>
        {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="w-8" />
              <th className="px-3 py-2 font-medium">Enviado em</th>
              <th className="px-3 py-2 font-medium">Assunto</th>
              <th className="px-3 py-2 font-medium">Nível</th>
              <th className="px-3 py-2 font-medium">Destinatários</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alertas.map((a) => {
              const exp = aberto === a.id
              const link = linkDe(a.processo_id, a.instrumento_id)
              return (
                <Fragment key={a.id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setAberto(exp ? null : a.id)}>
                    <td className="pl-3 text-slate-400">{exp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatarDataHora(String(a.enviado_em))}</td>
                    <td className="px-3 py-2"><Mail size={14} className="mr-1 inline text-slate-400" />{String(a.titulo)}</td>
                    <td className={`px-3 py-2 ${Number(a.nivel) >= 3 ? 'font-semibold text-red-600' : Number(a.nivel) === 2 ? 'text-orange-700' : ''}`}>{String(a.nivel)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{(a.destinatarios as string[] | undefined)?.length ?? 0} pessoa(s)</td>
                  </tr>
                  {exp && (
                    <tr className="bg-slate-50">
                      <td />
                      <td colSpan={4} className="px-3 py-3 text-sm">
                        <p className="text-xs text-slate-500">Para: {(a.destinatarios as string[] | undefined)?.join('; ')}</p>
                        <p className="text-xs text-slate-500">Tipo: {TIPOS[String(a.tipo)]} · Processo {String(processoDe(a.processo_id)?.codigo ?? '—')}</p>
                        <pre className="mt-2 font-sans whitespace-pre-wrap text-slate-800">{String(a.mensagem)}</pre>
                        {link && <Link to={link} className="mt-2 inline-block text-marca-700 hover:underline">Abrir no sistema →</Link>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {alertas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhum alerta enviado. {ehCentral(usuario) ? 'Clique em "Processar alertas agora".' : ''}</p>}
      </div>
    </div>
  )
}
