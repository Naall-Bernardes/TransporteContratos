// Tramitação do ofício como um "chamado": o órgão central envia à regional, a regional preenche
// as informações e anexa documentos, o chamado volta ao central, que conclui ou devolve pedindo
// complemento. Todo o vaivém fica no histórico.

import { CheckCircle2, CornerUpLeft, FileText, Inbox, Send, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { PainelDocumentos } from '@/features/documentos/PainelDocumentos'
import { ErroPermissao, ErroRegra, ErroValidacao } from '@/lib/dados/repositorio'
import { consultarSre, feriadosDe, registrarRespostaOficio, responderConsulta } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import { prazoDaEtapa } from '@/lib/fluxo/sla'
import { formatarData } from '@/lib/formatacao'
import { PRAZO_PADRAO_SRE, situacaoOficio } from '@/lib/judicial/oficios'
import { ehCentral, podeEditar } from '@/lib/permissoes'

interface Props {
  oficio: Registro
  processo?: Registro
  dados: Partial<Record<Colecao, Registro[]>>
  aoAlterar: () => Promise<void> | void
}

interface Evento {
  data: string
  ordem: number
  icone: ReactNode
  titulo: string
  por?: string
  texto?: string
  detalhe?: string
  documentos?: Registro[]
  cor: string
}

const mensagem = (e: unknown) => {
  if (e instanceof ErroValidacao) return Object.values(e.erros).join(' ')
  if (e instanceof ErroRegra || e instanceof ErroPermissao) return e.message
  throw e
}

export function TramitacaoOficio({ oficio, processo, dados, aoAlterar }: Props) {
  const usuario = useUsuario()
  const hoje = hojeIso()
  const central = ehCentral(usuario)
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, rid: unknown) => lista(c).find((r) => r.id === rid)
  const nome = (id: unknown) => String(achar('usuarios', id)?.nome ?? '')
  const feriados = feriadosDe(lista)
  const consultas = lista('oficio_consultas').filter((c) => c.oficio_id === oficio.id).sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)))
  const situacao = situacaoOficio(oficio, consultas)
  const pendente = consultas.find((c) => c.status === 'pendente')
  const ultima = consultas.at(-1)
  const docsDe = (consultaId: unknown) => lista('documentos').filter((d) => d.consulta_id === consultaId)
  const escola = achar('escolas', oficio.escola_id)
  const sigla = (id: unknown) => String(achar('sres', id)?.sigla ?? '')
  const podeInformar = Boolean(pendente && podeEditar(usuario, 'oficio_consultas', pendente, (c, rid) => achar(c, rid)))

  const [acao, setAcao] = useState<'enviar' | 'concluir' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sreEnvio, setSreEnvio] = useState('')
  const [pergunta, setPergunta] = useState('')
  const [prazo, setPrazo] = useState('')
  const [informacao, setInformacao] = useState('')
  const [resposta, setResposta] = useState({ resposta_numero: '', resposta_data: hoje, resposta_resumo: '' })
  const sreEscolhida = sreEnvio || String(oficio.sre_id ?? escola?.sre_id ?? '')
  const prazoEscolhido = prazo || String(prazoDaEtapa(hoje, PRAZO_PADRAO_SRE, feriados))

  async function tentar(fn: () => Promise<unknown>, depois?: () => void) {
    setErro(null)
    try {
      await fn()
      depois?.()
      setAcao(null)
      await aoAlterar()
    } catch (e) {
      setErro(mensagem(e))
    }
  }

  // ---------- Histórico ----------
  const eventos: Evento[] = [
    { data: String(oficio.data_recebimento), ordem: 0, icone: <Inbox size={14} />, titulo: 'Ofício recebido e cadastrado no órgão central', por: nome(oficio.criado_por), texto: String(oficio.assunto ?? ''), cor: 'bg-slate-400' },
  ]
  consultas.forEach((c, i) => {
    eventos.push({
      data: String(c.solicitada_em),
      ordem: 1 + i * 2,
      icone: i === 0 ? <Send size={14} /> : <Undo2 size={14} />,
      titulo: i === 0 ? `Enviado à regional ${sigla(oficio.sre_id)}` : `Devolvido à regional ${sigla(oficio.sre_id)} pedindo complemento`,
      por: nome(c.solicitada_por),
      texto: String(c.pergunta ?? ''),
      detalhe: `Prazo da regional: ${formatarData(c.prazo)}`,
      cor: 'bg-amber-500',
    })
    if (c.status === 'respondida')
      eventos.push({
        data: String(c.respondida_em),
        ordem: 2 + i * 2,
        icone: <CornerUpLeft size={14} />,
        titulo: 'Regional respondeu — voltou ao órgão central',
        por: nome(c.respondida_por),
        texto: String(c.resposta ?? ''),
        documentos: docsDe(c.id),
        cor: 'bg-sky-500',
      })
  })
  if (oficio.resposta_data)
    eventos.push({
      data: String(oficio.resposta_data),
      ordem: 999,
      icone: <CheckCircle2 size={14} />,
      titulo: `Concluído — resposta enviada ao órgão (ofício ${oficio.resposta_numero})`,
      por: nome(oficio.atualizado_por),
      texto: String(oficio.resposta_resumo ?? ''),
      cor: 'bg-green-600',
    })
  eventos.sort((a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem)

  // ---------- Com quem está ----------
  const faixa = (cor: string, texto: ReactNode, botoes?: ReactNode) => (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 ${cor}`}>
      <p>{texto}</p>
      {botoes && <div className="flex flex-wrap gap-2">{botoes}</div>}
    </div>
  )
  const botoesCentral = (rotuloEnviar: string) => (
    <>
      <Botao variante="secundario" onClick={() => setAcao(acao === 'enviar' ? null : 'enviar')}><Send size={16} /> {rotuloEnviar}</Botao>
      <Botao onClick={() => setAcao(acao === 'concluir' ? null : 'concluir')}><CheckCircle2 size={16} /> Concluir ofício</Botao>
    </>
  )

  let status: ReactNode
  if (situacao === 'respondido') status = faixa('bg-green-50 text-green-900', <>Ofício <strong>concluído</strong> em {formatarData(oficio.resposta_data)}.</>)
  else if (situacao === 'aguardando_sre')
    status = podeInformar
      ? faixa('bg-amber-50 text-amber-900', <>Ofício encaminhado à <strong>sua regional</strong>. Preencha as informações e anexe os documentos até <strong>{formatarData(pendente!.prazo)}</strong>.</>)
      : faixa('bg-amber-50 text-amber-900', <>Com a <strong>regional {sigla(oficio.sre_id)}</strong> — prazo {formatarData(pendente!.prazo)}. Volta ao órgão central quando ela responder.</>)
  else if (situacao === 'informacao_recebida')
    status = central
      ? faixa('bg-sky-50 text-sky-900', <>A regional <strong>respondeu em {formatarData(ultima?.respondida_em)}</strong>. Analise: conclua o ofício ou devolva pedindo complemento.</>, botoesCentral('Devolver à regional'))
      : faixa('bg-sky-50 text-sky-900', <>Informação enviada ao órgão central em {formatarData(ultima?.respondida_em)}.</>)
  else
    status = central
      ? faixa('bg-slate-50 text-slate-800', <>Com o <strong>órgão central</strong>. Envie à regional para ela preencher as informações ou conclua direto.</>, botoesCentral('Enviar à regional'))
      : faixa('bg-slate-50 text-slate-800', <>Com o órgão central.</>)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="mb-3 font-semibold text-slate-900">Tramitação</h2>
      {status}
      {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-red-700">{erro}</p>}

      {/* Central: enviar / devolver à regional */}
      {central && acao === 'enviar' && !pendente && situacao !== 'respondido' && (
        <div className="mt-3 space-y-2 rounded-md border border-slate-200 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-slate-600">Regional (SRE)</span>
              <select className="campo mt-1" value={sreEscolhida} disabled={Boolean(oficio.sre_id)} onChange={(e) => setSreEnvio(e.target.value)}>
                <option value="">Escolha…</option>
                {lista('sres').map((s) => <option key={s.id} value={s.id}>{String(s.sigla)} — {String(s.nome)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Prazo da regional ({PRAZO_PADRAO_SRE} dias úteis)</span>
              <input className="campo mt-1" type="date" value={prazoEscolhido} onChange={(e) => setPrazo(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-slate-600">{consultas.length ? 'O que falta a regional complementar' : 'O que a regional deve informar'}</span>
            <textarea className="campo mt-1" rows={3} value={pergunta} onChange={(e) => setPergunta(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setAcao(null)}>Cancelar</Botao>
            <Botao disabled={!pergunta.trim() || !sreEscolhida} onClick={() => tentar(() => consultarSre(usuario, String(oficio.id), { sre_id: sreEscolhida, pergunta, prazo: prazoEscolhido }), () => setPergunta(''))}>
              <Send size={16} /> Enviar à regional
            </Botao>
          </div>
        </div>
      )}

      {/* Central: concluir */}
      {central && acao === 'concluir' && !pendente && situacao !== 'respondido' && (
        <div className="mt-3 space-y-2 rounded-md border border-slate-200 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-slate-600">Nº do ofício de resposta *</span>
              <input className="campo mt-1" value={resposta.resposta_numero} onChange={(e) => setResposta({ ...resposta, resposta_numero: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Data da resposta *</span>
              <input className="campo mt-1" type="date" max={hoje} value={resposta.resposta_data} onChange={(e) => setResposta({ ...resposta, resposta_data: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-slate-600">Resumo da resposta</span>
            <textarea className="campo mt-1" rows={2} value={resposta.resposta_resumo} onChange={(e) => setResposta({ ...resposta, resposta_resumo: e.target.value })} />
          </label>
          <p className="text-xs text-slate-500">Anexe o ofício de resposta em "Documentos", abaixo.</p>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setAcao(null)}>Cancelar</Botao>
            <Botao disabled={!resposta.resposta_numero.trim() || !resposta.resposta_data} onClick={() => tentar(() => registrarRespostaOficio(usuario, String(oficio.id), resposta))}>
              <CheckCircle2 size={16} /> Concluir ofício
            </Botao>
          </div>
        </div>
      )}

      {/* Regional: preencher e devolver ao central */}
      {podeInformar && pendente && (
        <div className="mt-3 space-y-3 rounded-md border border-amber-200 p-3">
          <div>
            <p className="text-xs text-slate-500">Pedido do órgão central ({formatarData(pendente.solicitada_em)}):</p>
            <p className="mt-0.5 font-medium">{String(pendente.pergunta ?? '')}</p>
          </div>
          <label className="block">
            <span className="text-xs text-slate-600">Informações da regional *</span>
            <textarea className="campo mt-1" rows={5} value={informacao} onChange={(e) => setInformacao(e.target.value)} />
          </label>
          {processo && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Documentos desta resposta</p>
              <PainelDocumentos
                processoId={String(processo.id)}
                codigoProcesso={String(processo.codigo)}
                dados={dados}
                podeEnviar
                aoAlterar={async () => { await aoAlterar() }}
                filtro={(doc) => doc.consulta_id === pendente.id}
                vinculos={{ consulta_id: String(pendente.id) }}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Botao disabled={!informacao.trim()} onClick={() => tentar(() => responderConsulta(usuario, String(pendente.id), informacao), () => setInformacao(''))}>
              <Send size={16} /> Enviar ao órgão central
            </Botao>
          </div>
        </div>
      )}

      {/* Histórico */}
      <h3 className="mt-5 mb-2 text-xs font-semibold text-slate-500 uppercase">Histórico</h3>
      <ol className="relative space-y-4 border-l border-slate-200 pl-5">
        {eventos.map((e, i) => (
          <li key={i} className="relative">
            <span className={`absolute top-0.5 -left-[1.95rem] flex h-5 w-5 items-center justify-center rounded-full text-white ${e.cor}`}>{e.icone}</span>
            <p className="font-medium text-slate-900">{e.titulo}</p>
            <p className="text-xs text-slate-500">{formatarData(e.data)}{e.por ? ` · ${e.por}` : ''}{e.detalhe ? ` · ${e.detalhe}` : ''}</p>
            {e.texto && <p className="mt-1 whitespace-pre-line text-slate-700">{e.texto}</p>}
            {e.documentos && e.documentos.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {e.documentos.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-1">
                    <FileText size={12} /> {String(achar('tipos_documento', doc.tipo_documento_id)?.nome ?? 'Documento')}
                    {doc.numero_sei ? ` · ${doc.numero_sei}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
