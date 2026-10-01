import { ArrowLeft, ExternalLink, Link2, Pencil, Play } from 'lucide-react'
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
import { feriadosDe } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { etapaAtual, montarDadosProcesso } from '@/lib/fluxo/processo'
import { calcularSemaforo } from '@/lib/fluxo/sla'
import { formatarData } from '@/lib/formatacao'
import { ROTULO_SITUACAO_OFICIO, situacaoOficio } from '@/lib/judicial/oficios'
import { ehCentral, podeEditar } from '@/lib/permissoes'
import { OFICIO } from './configuracoes'
import { TramitacaoOficio } from './TramitacaoOficio'

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
  const [modal, setModal] = useState<'editar' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
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
  const demanda = achar('demandas', oficio.demanda_id)
  const processoDemanda = demanda ? achar('processos', demanda.processo_id) : undefined
  const etapaDemanda = demanda ? etapaAtual(montarDadosProcesso(lista, String(demanda.processo_id), hoje), lista('etapas_modelo').filter((m) => m.modulo === 'JUDICIAL')).modelo : undefined
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

      <div className="mt-5">
        <TramitacaoOficio oficio={oficio} processo={processo} dados={dados} aoAlterar={recarregar} />
      </div>

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
          <Bloco titulo="Contratação">
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
                  <p className="text-slate-600">Esta intimação determina o transporte. Cadastre a demanda de transporte: ela começa no Detalhamento da demanda, com os dados deste ofício.</p>
                  <Botao className="mt-3" onClick={() => navegar(`/judicial/novo/cadastrar?oficio=${oficio.id}`)}><Play size={16} /> Cadastrar demanda de transporte</Botao>
                </div>
              ) : (
                <p className="text-slate-500">Demanda de transporte ainda não cadastrada pelo órgão central.</p>
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

      <Modal titulo="Editar ofício" aberto={modal !== null} aoFechar={() => setModal(null)}>
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
      </Modal>
    </div>
  )
}
