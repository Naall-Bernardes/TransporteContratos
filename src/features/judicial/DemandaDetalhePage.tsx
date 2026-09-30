import { ArrowLeft, CheckCircle2, Circle, CircleDot, ExternalLink, Files, FileText, History, LayoutList, Mail, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Cartao } from '@/components/comum/Cartao'
import { Semaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { valorExibido } from '@/features/cadastros/exibicao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { SecaoRegistros } from '@/features/contratos/SecaoRegistros'
import { PainelDocumentos } from '@/features/documentos/PainelDocumentos'
import { EtapaDetalhe, HistoricoEtapas } from '@/features/fluxo/Etapas'
import { ALOCACAO } from '@/features/frota/configuracoes'
import { PainelConformidade } from '@/features/frota/PainelConformidade'
import { ErroPermissao, ErroRegra, salvar } from '@/lib/dados/repositorio'
import { feriadosDe, incluirAluno } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { etapaAtual, montarDadosProcesso } from '@/lib/fluxo/processo'
import { calcularSemaforo } from '@/lib/fluxo/sla'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { podeEditar as podeEditarRegistro } from '@/lib/permissoes'
import { AutorizacaoSubsecretario, RegistroPaf } from './Autorizacao'
import { ContratoEtapa } from './ContratoEtapa'
import { ROTULO_SITUACAO_OFICIO, situacaoOficio } from '@/lib/judicial/oficios'
import { DEMANDA, EXECUCAO, ORIGENS, STATUS_CARACTERIZACAO, TIPOS_OFICIO } from './configuracoes'

/** Item do submenu da demanda. */
function ItemSecao({ id, atual, ir, icone, children }: { id: string; atual: string; ir: (id: string) => void; icone: ReactNode; children: ReactNode }) {
  return (
    <button
      onClick={() => ir(id)}
      className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left ${atual === id ? 'bg-marca-50 font-medium text-marca-800 ring-1 ring-marca-100' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      <span className="mt-0.5 shrink-0">{icone}</span>
      {children}
    </button>
  )
}

export function DemandaDetalhePage() {
  const { id } = useParams()
  const usuario = useUsuario()
  const { dados, carregando, recarregar } = useTodos()
  const [params, setParams] = useSearchParams()
  const [editando, setEditando] = useState<'dados' | 'execucao' | null>(null)
  const [alunoNovo, setAlunoNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const hoje = hojeIso()

  const demanda = dados.demandas?.find((d) => d.id === id)
  const d = useMemo(() => (demanda ? montarDadosProcesso((c) => dados[c] ?? [], String(demanda.processo_id)) : null), [dados, demanda])
  if (carregando) return null
  if (!demanda || !d)
    return (
      <p className="text-sm text-slate-600">
        Demanda não encontrada ou sem permissão. <Link to="/judicial" className="text-marca-700 underline">Voltar</Link>
      </p>
    )

  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, rid: unknown) => lista(c).find((r) => r.id === rid)
  const processo = d.processo!
  const pode = podeEditarRegistro(usuario, 'demandas', demanda, achar)
  const modelos = lista('etapas_modelo').filter((m) => m.modulo === 'JUDICIAL')
  const { modelo } = etapaAtual(d, modelos)
  const modelosOrdenados = [...modelos].sort((a, b) => Number(a.ordem) - Number(b.ordem))
  const secao = params.get('secao') ?? (modelo ? String(modelo.codigo) : 'geral')
  const modeloSecao = modelosOrdenados.find((m) => m.codigo === secao)
  const irPara = (id: string) => setParams({ secao: id })
  const semaforo = calcularSemaforo(
    { prazoJudicial: demanda.prazo_judicial as string, inicioTransporte: demanda.data_inicio_transporte as string, prazoEtapa: etapaAtual(d, modelos).instancia?.prazo_sla as string, encerrado: demanda.situacao !== 'ativa' },
    hoje,
    feriadosDe(lista),
  )
  const escola = achar('escolas', demanda.escola_id)
  const alunosDemanda = d.alunosDemanda.map((da) => ({ da, aluno: achar('alunos', da.aluno_id)!, car: d.caracterizacoes.find((c) => c.demanda_aluno_id === da.id) }))
  const contrato = d.instrumentos.find((i) => i.tipo === 'contrato_caixa')
  const oficios = lista('oficios').filter((o) => o.demanda_id === demanda.id).sort((a, b) => String(a.data_recebimento).localeCompare(String(b.data_recebimento)))
  const etapasOpcoes = [...modelos].sort((a, b) => Number(a.ordem) - Number(b.ordem)).map((m) => ({ codigo: String(m.codigo), nome: String(m.nome) }))
  const alunosOpcoes = alunosDemanda.map((a) => ({ id: a.aluno.id, nome: String(a.aluno.nome) }))

  async function acao(fn: () => Promise<unknown>) {
    setErro(null)
    try {
      await fn()
      await recarregar()
    } catch (e) {
      if (e instanceof ErroRegra || e instanceof ErroPermissao) setErro(e.message)
      else throw e
    }
  }

  /** Conteúdo próprio de cada etapa (dados, formulários e registros daquela fase). */
  const conteudoEtapa = (codigo: string): ReactNode => {
    switch (codigo) {
      case 'C01':
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Uma demanda pode ter vários alunos e um aluno pode estar em mais de uma demanda. Cada aluno tem seu formulário de caracterização.</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Aluno</th>
                    <th className="px-3 py-2 font-medium">Matrícula SIMADE</th>
                    <th className="px-3 py-2 font-medium">Incluído em</th>
                    <th className="px-3 py-2 font-medium">Caracterização</th>
                    <th className="px-3 py-2 font-medium">Outras demandas</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alunosDemanda.map(({ da, aluno, car }) => {
                    const outras = lista('demanda_alunos').filter((x) => x.aluno_id === aluno.id && x.demanda_id !== demanda.id && !x.removido_em).length
                    return (
                      <tr key={da.id}>
                        <td className="px-3 py-2">{String(aluno.nome)}</td>
                        <td className="px-3 py-2">{String(aluno.cod_simade)}</td>
                        <td className="px-3 py-2">{formatarData(da.incluido_em)}</td>
                        <td className="px-3 py-2">{STATUS_CARACTERIZACAO.find((s) => s.valor === car?.status)?.rotulo ?? '—'}</td>
                        <td className="px-3 py-2">{outras || '—'}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Link to={`/judicial/${demanda.id}/caracterizacao/${da.id}`} className="inline-flex items-center gap-1 text-marca-700 hover:underline">
                            <FileText size={14} /> Formulário
                          </Link>
                          {pode && (
                            <button
                              onClick={() => acao(() => salvar('demanda_alunos', { id: da.id, removido_em: hoje, motivo: 'Removido da demanda' }, usuario))}
                              className="ml-2 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Retirar da demanda"
                              aria-label="Retirar da demanda"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {alunosDemanda.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum aluno incluído.</p>}
            </div>
            {pode && (
              <div className="flex flex-wrap items-center gap-2">
                <select className="campo w-auto min-w-64" value={alunoNovo} onChange={(e) => setAlunoNovo(e.target.value)} aria-label="Aluno">
                  <option value="">Escolha um aluno cadastrado…</option>
                  {lista('alunos')
                    .filter((a) => a.ativo !== false && !alunosDemanda.some((x) => x.aluno.id === a.id))
                    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
                    .map((a) => <option key={a.id} value={a.id}>{String(a.nome)} ({String(a.cod_simade)})</option>)}
                </select>
                <Botao disabled={!alunoNovo} onClick={() => acao(async () => { await incluirAluno(usuario, demanda.id, alunoNovo); setAlunoNovo('') })}>
                  <Plus size={16} /> Incluir aluno
                </Botao>
                <Link to="/cadastros/alunos" className="text-sm text-marca-700 hover:underline">Cadastrar novo aluno</Link>
              </div>
            )}
          </div>
        )
      case 'C02':
        return <AutorizacaoSubsecretario demanda={demanda} d={d} dados={dados} aoAlterar={recarregar} />
      case 'C03':
        return <RegistroPaf demanda={demanda} d={d} dados={dados} aoAlterar={recarregar} />
      case 'C04':
        return (
          <div className="space-y-4">
            <ContratoEtapa demanda={demanda} processo={processo} d={d} dados={dados} podeEditar={pode} aoAlterar={recarregar} />
            {contrato && (
              <>
                <SecaoRegistros
                  config={ALOCACAO}
                  valoresFixos={{ instrumento_id: contrato.id }}
                  registros={lista('alocacoes').filter((a) => a.instrumento_id === contrato.id)}
                  referencias={dados}
                  podeEditar={pode}
                  aoAlterar={recarregar}
                  padraoNovo={{ inicio: hoje }}
                  cabecalho="Veículo, motorista e monitor que farão o transporte (CTB arts. 136 a 138)."
                />
                <PainelConformidade entidades={d.conformidade} dados={dados} podeEnviar={pode} aoAlterar={recarregar} />
              </>
            )}
          </div>
        )
      case 'C05':
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Início efetivo do transporte</h3>
                  <p className="mt-1">{demanda.data_inicio_transporte ? formatarData(demanda.data_inicio_transporte) : <span className="text-slate-500">não informado</span>}
                    {Boolean(demanda.data_inicio_transporte) && (String(demanda.data_inicio_transporte) <= String(demanda.prazo_judicial)
                      ? <span className="ml-2 text-green-700">dentro do prazo judicial</span>
                      : <span className="ml-2 font-medium text-red-600">após o prazo judicial</span>)}
                  </p>
                </div>
                {pode && <Botao variante="secundario" onClick={() => setEditando('execucao')}>Informar início</Botao>}
              </div>
            </div>
            {contrato && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                <h3 className="font-semibold text-slate-900">Fiscalização da execução</h3>
                <p className="mt-1">
                  {d.fiscalizacoes.length} mês(es) fiscalizado(s) · {d.fiscalizacoes.reduce((t, f) => t + Number(f.dias_rodados || 0), 0)} dias rodados ·{' '}
                  {lista('ocorrencias').filter((o) => o.instrumento_id === contrato.id && o.status !== 'resolvida').length} ocorrência(s) em aberto
                </p>
                <Link to={`/contratos/${contrato.id}`} className="mt-2 inline-flex items-center gap-1 text-marca-700 hover:underline">Registrar fiscalização e ocorrências no contrato <ExternalLink size={14} /></Link>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }


  return (
    <div>
      <Link to="/judicial" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700">
        <ArrowLeft size={16} /> Cumprimento de sentença
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{String(processo.codigo)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {ORIGENS.find((o) => o.valor === demanda.origem)?.rotulo} nº {String(demanda.numero_processo_origem)} · {String(demanda.comarca)} · Processo SEI {String(processo.numero_sei ?? '—')}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-slate-500">Escola:</span> {String(escola?.nome ?? '')} · <span className="text-slate-500">Prazo judicial:</span>{' '}
            <strong>{formatarData(demanda.prazo_judicial)}</strong>
            {Boolean(demanda.multa_diaria) && <span className="text-slate-500"> · multa diária {formatarMoeda(demanda.multa_diaria)}</span>}
            {demanda.situacao !== 'ativa' && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">{String(demanda.situacao).toUpperCase()}</span>}
          </p>
          {modelo && <p className="mt-1 text-sm"><span className="text-slate-500">Etapa atual:</span> {String(modelo.ordem)}. {String(modelo.nome)}</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><Semaforo semaforo={semaforo} /></div>
      </div>

      {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[15rem_1fr]">
        {/* Submenu da demanda: visão geral, as etapas, documentos, ofícios e histórico */}
        <nav className="self-start rounded-lg border border-slate-200 bg-white p-2 text-sm lg:sticky lg:top-4" aria-label="Etapas da demanda">
          <ItemSecao id="geral" atual={secao} ir={irPara} icone={<LayoutList size={15} className="text-slate-500" />}>Visão geral</ItemSecao>
          <p className="mt-2 mb-1 px-2 text-xs font-semibold text-slate-500 uppercase">Etapas</p>
          {modelosOrdenados.map((m) => {
            const e = d.etapas.find((x) => x.etapa_modelo_id === m.id)
            const st = String(e?.status ?? 'nao_iniciada')
            const Icone = st === 'concluida' ? CheckCircle2 : st === 'em_andamento' ? CircleDot : Circle
            const cor = st === 'concluida' ? 'text-green-600' : st === 'em_andamento' ? 'text-marca-600' : 'text-slate-300'
            return (
              <ItemSecao key={m.id} id={String(m.codigo)} atual={secao} ir={irPara} icone={<Icone size={15} className={cor} />}>
                <span className="leading-tight">{String(m.ordem)}. {String(m.nome)}</span>
              </ItemSecao>
            )
          })}
          <p className="mt-2 mb-1 px-2 text-xs font-semibold text-slate-500 uppercase">Processo</p>
          <ItemSecao id="documentos" atual={secao} ir={irPara} icone={<Files size={15} className="text-slate-500" />}>Documentos ({d.documentos.length})</ItemSecao>
          <ItemSecao id="oficios" atual={secao} ir={irPara} icone={<Mail size={15} className="text-slate-500" />}>Ofícios ({oficios.length})</ItemSecao>
          <ItemSecao id="historico" atual={secao} ir={irPara} icone={<History size={15} className="text-slate-500" />}>Histórico das etapas</ItemSecao>
        </nav>

        <div className="min-w-0">
          {secao === 'geral' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Cartao titulo="Etapa atual" valor={modelo ? `${modelo.ordem}. ${modelo.nome}` : 'Concluída'} onClick={modelo ? () => irPara(String(modelo.codigo)) : undefined} />
                <Cartao titulo="Prazo judicial" valor={formatarData(demanda.prazo_judicial)} detalhe={demanda.data_inicio_transporte ? `transporte iniciado em ${formatarData(demanda.data_inicio_transporte)}` : 'transporte não iniciado'} />
                <Cartao titulo="Alunos" valor={alunosDemanda.length} onClick={() => irPara('C01')} />
                <Cartao titulo="Valor autorizado" valor={demanda.valor_total ? formatarMoeda(demanda.valor_total) : '—'} detalhe={d.pafs[0] ? `PAF ${d.pafs[0].numero}` : 'sem PAF'} onClick={() => irPara(d.pafs.length ? 'C03' : 'C02')} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Dados do cumprimento</h3>
                  {pode && <Botao variante="secundario" onClick={() => setEditando('dados')}><Pencil size={16} /> Editar dados</Botao>}
                </div>
                <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  {DEMANDA.campos.filter((c) => !c.visivel || c.visivel(demanda)).map((c) => (
                    <div key={c.nome} className={c.tipo === 'texto_longo' ? 'sm:col-span-2' : ''}>
                      <dt className="text-xs text-slate-500">{c.rotulo}</dt>
                      <dd className="mt-0.5">{c.nome === 'numero_sei' ? String(processo.numero_sei ?? '—') : valorExibido(c, demanda, dados) || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {modeloSecao && (
            <EtapaDetalhe key={String(modeloSecao.id)} processoId={String(processo.id)} modelo={modeloSecao} dados={dados} aoAlterar={recarregar} alunos={alunosOpcoes}>
              {conteudoEtapa(String(modeloSecao.codigo))}
            </EtapaDetalhe>
          )}

          {secao === 'documentos' && (
            <PainelDocumentos processoId={String(processo.id)} codigoProcesso={String(processo.codigo)} dados={dados} podeEnviar={pode} aoAlterar={recarregar} etapas={etapasOpcoes} alunos={alunosOpcoes} />
          )}

          {secao === 'oficios' && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ofício</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Recebido</th>
                    <th className="px-3 py-2 font-medium">Prazo de resposta</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {oficios.map((o) => (
                    <tr key={o.id}>
                      <td className="px-3 py-2">
                        <Link to={`/judicial/oficios/${o.id}`} className="font-medium text-marca-700 hover:underline">{String(achar('processos', o.processo_id)?.codigo ?? '')}</Link>
                        <p className="text-xs text-slate-500">nº {String(o.numero)} · {String(o.orgao_nome ?? '')}</p>
                      </td>
                      <td className="px-3 py-2">{TIPOS_OFICIO.find((t) => t.valor === o.tipo)?.rotulo}</td>
                      <td className="px-3 py-2">{formatarData(o.data_recebimento)}</td>
                      <td className="px-3 py-2">{formatarData(o.prazo_resposta)}</td>
                      <td className="px-3 py-2">{ROTULO_SITUACAO_OFICIO[situacaoOficio(o, lista('oficio_consultas'))]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {oficios.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum ofício vinculado (ou sem permissão para ver).</p>}
            </div>
          )}

          {secao === 'historico' && <HistoricoEtapas processoId={String(processo.id)} modulo="JUDICIAL" dados={dados} />}
        </div>
      </div>

      <Modal
        titulo={{ dados: 'Editar demanda', execucao: 'Início do transporte' }[editando ?? 'dados']}
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
      >
        {editando && (
          <FormularioRegistro
            config={{ dados: { ...DEMANDA, campos: DEMANDA.campos.filter((c) => c.nome !== 'numero_sei') }, execucao: EXECUCAO}[editando]}
            registro={demanda}
            referencias={dados}
            aoCancelar={() => setEditando(null)}
            aoSalvar={async () => {
              setEditando(null)
              await recarregar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}
