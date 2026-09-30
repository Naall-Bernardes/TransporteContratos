import { ArrowLeft, ExternalLink, Link2, Pencil, Play, Send } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Semaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { valorExibido } from '@/features/cadastros/exibicao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { PainelDocumentos } from '@/features/documentos/PainelDocumentos'
import { ErroPermissao, ErroRegra, ErroValidacao, salvar } from '@/lib/dados/repositorio'
import { consultarSre, feriadosDe, iniciarCumprimento, registrarRespostaOficio, responderConsulta } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { etapaAtual, montarDadosProcesso } from '@/lib/fluxo/processo'
import { calcularSemaforo, prazoDaEtapa } from '@/lib/fluxo/sla'
import { formatarData } from '@/lib/formatacao'
import { PRAZO_PADRAO_SRE, ROTULO_SITUACAO_OFICIO, situacaoOficio } from '@/lib/judicial/oficios'
import { ehCentral, podeEditar } from '@/lib/permissoes'
import { INICIO_CUMPRIMENTO, OFICIO } from './configuracoes'

function Bloco({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  )
}

const mensagem = (e: unknown) => {
  if (e instanceof ErroValidacao) return Object.values(e.erros).join(' ')
  if (e instanceof ErroRegra || e instanceof ErroPermissao) return e.message
  throw e
}

export function OficioDetalhePage() {
  const { id } = useParams()
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, carregando, recarregar } = useTodos()
  const hoje = hojeIso()
  const central = ehCentral(usuario)
  const [modal, setModal] = useState<'editar' | 'cumprimento' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pergunta, setPergunta] = useState('')
  const [sreConsulta, setSreConsulta] = useState('')
  const [prazoSre, setPrazoSre] = useState('')
  const [informacao, setInformacao] = useState('')
  const [resposta, setResposta] = useState({ resposta_numero: '', resposta_data: hoje, resposta_resumo: '' })
  const [vincular, setVincular] = useState('')

  if (carregando) return null
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, rid: unknown) => lista(c).find((r) => r.id === rid)
  const oficio = lista('oficios').find((o) => o.id === id)
  if (!oficio)
    return (
      <p className="text-sm text-slate-600">
        Ofício não encontrado ou sem permissão. <Link to="/oficios" className="text-marca-700 underline">Voltar</Link>
      </p>
    )

  const feriados = feriadosDe(lista)
  const processo = achar('processos', oficio.processo_id)
  const consultas = lista('oficio_consultas').filter((c) => c.oficio_id === oficio.id).sort((a, b) => String(a.solicitada_em).localeCompare(String(b.solicitada_em)))
  const situacao = situacaoOficio(oficio, consultas)
  const respondido = situacao === 'respondido'
  const pendente = consultas.find((c) => c.status === 'pendente')
  const semaforo = calcularSemaforo({ prazoEtapa: oficio.prazo_resposta as string, encerrado: respondido }, hoje, feriados)
  const escola = achar('escolas', oficio.escola_id)
  const demanda = achar('demandas', oficio.demanda_id)
  const processoDemanda = demanda ? achar('processos', demanda.processo_id) : undefined
  const etapaDemanda = demanda ? etapaAtual(montarDadosProcesso(lista, String(demanda.processo_id), hoje), lista('etapas_modelo').filter((m) => m.modulo === 'JUDICIAL')).modelo : undefined
  const sreEscolhida = sreConsulta || String(oficio.sre_id ?? escola?.sre_id ?? '')
  const prazoEscolhido = prazoSre || String(prazoDaEtapa(hoje, PRAZO_PADRAO_SRE, feriados))
  const podeInformar = pendente && podeEditar(usuario, 'oficio_consultas', pendente, (c, rid) => achar(c, rid))

  async function tentar(fn: () => Promise<unknown>, depois?: () => void) {
    setErro(null)
    try {
      await fn()
      depois?.()
      await recarregar()
    } catch (e) {
      setErro(mensagem(e))
    }
  }

  return (
    <div>
      <Link to="/oficios" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700">
        <ArrowLeft size={16} /> Ofícios
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{String(processo?.codigo ?? '')} · Ofício nº {String(oficio.numero)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {valorExibido(OFICIO.campos.find((c) => c.nome === 'orgao_tipo')!, oficio, dados)} · {String(oficio.orgao_nome ?? '')}
            {oficio.comarca ? ` · ${oficio.comarca}` : ''} · SEI {String(oficio.numero_sei || processo?.numero_sei || '—')}
          </p>
          <p className="mt-1 text-sm">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">{ROTULO_SITUACAO_OFICIO[situacao]}</span>
            <span className="ml-2 text-slate-500">Prazo de resposta:</span> <strong>{formatarData(oficio.prazo_resposta)}</strong>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Responsável por responder:</span>
            {central && !respondido ? (
              <select
                className="campo w-auto py-1"
                value={String(oficio.responsavel_id ?? '')}
                onChange={(e) => tentar(() => salvar('oficios', { id: oficio.id, responsavel_id: e.target.value || null }, usuario))}
                aria-label="Atribuir responsável"
              >
                <option value="">Atribuir…</option>
                {lista('usuarios').filter((u) => u.ativo !== false && (u.papel === 'analista_central' || u.papel === 'admin')).map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
              </select>
            ) : (
              <strong>{String(achar('usuarios', oficio.responsavel_id)?.nome ?? '—')}</strong>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><Semaforo semaforo={semaforo} /></div>
      </div>

      {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Bloco titulo="Dados do ofício" acao={central && !respondido && <Botao variante="secundario" onClick={() => setModal('editar')}><Pencil size={16} /> Editar</Botao>}>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {OFICIO.campos.filter((c) => c.emFormulario !== false).map((c) => (
              <div key={c.nome} className={c.tipo === 'texto_longo' ? 'sm:col-span-2' : ''}>
                <dt className="text-xs text-slate-500">{c.rotulo}</dt>
                <dd className="mt-0.5">{valorExibido(c, oficio, dados) || '—'}</dd>
              </div>
            ))}
          </dl>
        </Bloco>

        <div className="space-y-4">
          <Bloco titulo="Informação da SRE">
            {consultas.length === 0 && <p className="text-slate-500">Nenhum pedido de informação à SRE.</p>}
            <ul className="space-y-3">
              {consultas.map((c) => (
                <li key={c.id} className={`rounded-md border px-3 py-2 ${c.status === 'pendente' ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                  <p className="text-xs text-slate-500">
                    Pedido em {formatarData(c.solicitada_em)} à SRE {String(achar('sres', oficio.sre_id)?.sigla ?? '')} · prazo {formatarData(c.prazo)}
                  </p>
                  <p className="mt-0.5">{String(c.pergunta ?? '')}</p>
                  {c.status === 'respondida' ? (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <p className="text-xs text-slate-500">Resposta de {String(achar('usuarios', c.respondida_por)?.nome ?? '')} em {formatarData(c.respondida_em)}</p>
                      <p className="mt-0.5 whitespace-pre-line">{String(c.resposta ?? '')}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-amber-800">Aguardando a SRE.</p>
                  )}
                </li>
              ))}
            </ul>

            {podeInformar && (
              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className="text-xs text-slate-600">Informação solicitada</span>
                  <textarea className="campo mt-1" rows={4} value={informacao} onChange={(e) => setInformacao(e.target.value)} />
                </label>
                <p className="text-xs text-slate-500">Anexe documentos de apoio em "Documentos" (tipo "Informação da SRE").</p>
                <Botao disabled={!informacao.trim()} onClick={() => tentar(() => responderConsulta(usuario, pendente!.id, informacao), () => setInformacao(''))}>
                  <Send size={16} /> Enviar informação ao órgão central
                </Botao>
              </div>
            )}

            {central && !respondido && !pendente && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Pedir informação à SRE</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-slate-600">SRE</span>
                    <select className="campo mt-1" value={sreEscolhida} disabled={Boolean(oficio.sre_id)} onChange={(e) => setSreConsulta(e.target.value)}>
                      <option value="">Escolha…</option>
                      {lista('sres').map((s) => <option key={s.id} value={s.id}>{String(s.sigla)} — {String(s.nome)}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-600">Prazo da SRE ({PRAZO_PADRAO_SRE} dias úteis)</span>
                    <input className="campo mt-1" type="date" value={prazoEscolhido} onChange={(e) => setPrazoSre(e.target.value)} />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-slate-600">O que a SRE deve informar</span>
                  <textarea className="campo mt-1" rows={3} value={pergunta} onChange={(e) => setPergunta(e.target.value)} />
                </label>
                <Botao disabled={!pergunta.trim() || !sreEscolhida} onClick={() => tentar(() => consultarSre(usuario, oficio.id, { sre_id: sreEscolhida, pergunta, prazo: prazoEscolhido }), () => setPergunta(''))}>
                  <Send size={16} /> Encaminhar à SRE
                </Botao>
              </div>
            )}
          </Bloco>

          <Bloco titulo="Resposta ao órgão">
            {respondido ? (
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Nº do ofício de resposta</dt><dd>{String(oficio.resposta_numero)}</dd></div>
                <div><dt className="text-xs text-slate-500">Data</dt><dd>{formatarData(oficio.resposta_data)}</dd></div>
                {Boolean(oficio.resposta_resumo) && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Resumo</dt><dd>{String(oficio.resposta_resumo)}</dd></div>}
              </dl>
            ) : central ? (
              <div className="space-y-2">
                {pendente && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Aguardando a informação da SRE para responder.</p>}
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
                <p className="text-xs text-slate-500">Anexe o ofício de resposta em "Documentos".</p>
                <Botao disabled={Boolean(pendente) || !resposta.resposta_numero.trim() || !resposta.resposta_data} onClick={() => tentar(() => registrarRespostaOficio(usuario, oficio.id, resposta))}>
                  Registrar resposta
                </Botao>
              </div>
            ) : (
              <p className="text-slate-500">A resposta é registrada pelo órgão central.</p>
            )}
          </Bloco>

          <Bloco titulo="Contratação (Judicial/MP)">
            {demanda ? (
              <div>
                <Link to={`/judicial/${demanda.id}`} className="inline-flex items-center gap-1 font-medium text-marca-700 hover:underline">
                  {String(processoDemanda?.codigo ?? '')} <ExternalLink size={14} />
                </Link>
                <p className="mt-1 text-slate-600">
                  Etapa atual: {etapaDemanda ? `${etapaDemanda.ordem}. ${etapaDemanda.nome}` : 'concluído'} · prazo judicial {formatarData(demanda.prazo_judicial)}
                </p>
                {central && oficio.tipo !== 'intimacao_cumprimento' && (
                  <button className="mt-2 text-xs text-slate-500 hover:text-red-600 hover:underline" onClick={() => tentar(() => salvar('oficios', { id: oficio.id, demanda_id: null }, usuario))}>Desvincular</button>
                )}
              </div>
            ) : oficio.tipo === 'intimacao_cumprimento' ? (
              central ? (
                <div>
                  <p className="text-slate-600">Esta intimação determina o transporte. Inicie a contratação: ela começa na Caracterização, com os dados deste ofício.</p>
                  <Botao className="mt-3" onClick={() => setModal('cumprimento')}><Play size={16} /> Iniciar contratação</Botao>
                </div>
              ) : (
                <p className="text-slate-500">Contratação ainda não iniciada pelo órgão central.</p>
              )
            ) : central ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="text-xs text-slate-600">Vincular a uma contratação existente (reiteração, cobrança, pedido de comprovação)</span>
                  <select className="campo mt-1 w-auto min-w-72" value={vincular} onChange={(e) => setVincular(e.target.value)}>
                    <option value="">Escolha a contratação…</option>
                    {lista('demandas').map((dm) => (
                      <option key={dm.id} value={dm.id}>
                        {String(achar('processos', dm.processo_id)?.codigo ?? '')} — {String(dm.numero_processo_origem)} · {String(achar('escolas', dm.escola_id)?.nome ?? '')}
                      </option>
                    ))}
                  </select>
                </label>
                <Botao variante="secundario" disabled={!vincular} onClick={() => tentar(() => salvar('oficios', { id: oficio.id, demanda_id: vincular }, usuario), () => setVincular(''))}>
                  <Link2 size={16} /> Vincular
                </Botao>
              </div>
            ) : (
              <p className="text-slate-500">Não vinculado a contratação.</p>
            )}
          </Bloco>
        </div>
      </div>

      {processo && (
        <div className="mt-4">
          <PainelDocumentos
            processoId={String(processo.id)}
            codigoProcesso={String(processo.codigo)}
            dados={dados}
            podeEnviar={central || Boolean(podeInformar)}
            aoAlterar={recarregar}
          />
        </div>
      )}

      <Modal titulo={modal === 'editar' ? 'Editar ofício' : 'Iniciar contratação'} aberto={modal !== null} aoFechar={() => setModal(null)}>
        {modal === 'editar' && (
          <FormularioRegistro
            config={OFICIO}
            registro={oficio}
            referencias={dados}
            aoCancelar={() => setModal(null)}
            aoSalvar={async () => {
              setModal(null)
              await recarregar()
            }}
          />
        )}
        {modal === 'cumprimento' && (
          <FormularioRegistro
            config={INICIO_CUMPRIMENTO}
            registro={null}
            referencias={dados}
            valoresPadrao={{
              escola_id: oficio.escola_id,
              caixa_escolar_id: lista('caixas_escolares').find((c) => c.escola_id === oficio.escola_id)?.id,
              prazo_judicial: oficio.prazo_resposta,
              prazo_devolucao_formulario: prazoDaEtapa(hoje, 10, feriados),
              decisao_resumo: oficio.assunto,
            }}
            acao={(v) => iniciarCumprimento(usuario, oficio.id, v)}
            rotuloSalvar="Iniciar contratação"
            aoCancelar={() => setModal(null)}
            aoSalvar={async (r) => {
              setModal(null)
              await recarregar()
              navegar(`/judicial/${r.id}`)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
