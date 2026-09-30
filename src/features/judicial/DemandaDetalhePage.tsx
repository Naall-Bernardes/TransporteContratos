import { ArrowLeft, ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Abas } from '@/components/comum/Abas'
import { Semaforo } from '@/components/comum/Semaforo'
import { SeloVigencia } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { valorExibido } from '@/features/cadastros/exibicao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { INSTRUMENTO } from '@/features/contratos/configuracoes'
import { SecaoRegistros } from '@/features/contratos/SecaoRegistros'
import { PainelDocumentos } from '@/features/documentos/PainelDocumentos'
import { PainelEtapas } from '@/features/fluxo/PainelEtapas'
import { calcularSituacao } from '@/lib/contratos/calculos'
import { ErroPermissao, ErroRegra, salvar } from '@/lib/dados/repositorio'
import { feriadosDe, incluirAluno, registrarRelatorioCumprimento } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { etapaAtual, montarDadosProcesso } from '@/lib/fluxo/processo'
import { calcularSemaforo } from '@/lib/fluxo/sla'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { podeEditar as podeEditarRegistro } from '@/lib/permissoes'
import { AUTORIZACAO, COTACAO, DEMANDA, EXECUCAO, LIBERACAO, ORIGENS, STATUS_CARACTERIZACAO, UNIDADES_PRECO, VALOR } from './configuracoes'

type IdAba = 'fluxo' | 'dados' | 'alunos' | 'valor' | 'financeiro' | 'contrato' | 'documentos' | 'cumprimento'

export function DemandaDetalhePage() {
  const { id } = useParams()
  const usuario = useUsuario()
  const { dados, carregando, recarregar } = useTodos()
  const [aba, setAba] = useState<IdAba>('fluxo')
  const [editando, setEditando] = useState<'dados' | 'valor' | 'execucao' | 'contrato' | null>(null)
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
  const podeFinanceiro = podeEditarRegistro(usuario, 'autorizacoes_financeiras', { ...demanda, demanda_id: demanda.id } as Registro, achar)
  const modelos = lista('etapas_modelo').filter((m) => m.modulo === 'JUDICIAL')
  const { modelo } = etapaAtual(d, modelos)
  const semaforo = calcularSemaforo(
    { prazoJudicial: demanda.prazo_judicial as string, inicioTransporte: demanda.data_inicio_transporte as string, prazoEtapa: etapaAtual(d, modelos).instancia?.prazo_sla as string, encerrado: demanda.situacao !== 'ativa' },
    hoje,
    feriadosDe(lista),
  )
  const escola = achar('escolas', demanda.escola_id)
  const alunosDemanda = d.alunosDemanda.map((da) => ({ da, aluno: achar('alunos', da.aluno_id)!, car: d.caracterizacoes.find((c) => c.demanda_aluno_id === da.id) }))
  const contrato = d.instrumentos.find((i) => i.tipo === 'contrato_caixa')
  const menorCotacao = d.cotacoes.length ? d.cotacoes.reduce((m, c) => (Number(c.valor_mensal) < Number(m.valor_mensal) ? c : m)) : null
  const precosVigentes = lista('precos_referencia').filter((p) => p.sre_id === demanda.sre_id && String(p.vigencia_inicio) <= hoje && (!p.vigencia_fim || String(p.vigencia_fim) >= hoje))
  const etapasOpcoes = modelos.sort((a, b) => Number(a.ordem) - Number(b.ordem)).map((m) => ({ codigo: String(m.codigo), nome: String(m.nome) }))
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

  const ABAS = [
    { id: 'fluxo' as const, rotulo: 'Fluxo e etapas' },
    { id: 'dados' as const, rotulo: 'Decisão / dados' },
    { id: 'alunos' as const, rotulo: 'Alunos e caracterização', qtd: alunosDemanda.length },
    { id: 'valor' as const, rotulo: 'Valor', qtd: d.cotacoes.length },
    { id: 'financeiro' as const, rotulo: 'OP / PAF / liberação', qtd: d.autorizacoes.length + d.liberacoes.length },
    { id: 'contrato' as const, rotulo: 'Contratação e execução' },
    { id: 'documentos' as const, rotulo: 'Documentos', qtd: d.documentos.length },
    { id: 'cumprimento' as const, rotulo: 'Cumprimento' },
  ]

  return (
    <div>
      <Link to="/judicial" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700">
        <ArrowLeft size={16} /> Demandas judiciais
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

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="mt-4">
        {aba === 'fluxo' && <PainelEtapas processoId={String(processo.id)} modulo="JUDICIAL" dados={dados} aoAlterar={recarregar} alunos={alunosOpcoes} />}

        {aba === 'dados' && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex justify-end">{pode && <Botao variante="secundario" onClick={() => setEditando('dados')}><Pencil size={16} /> Editar</Botao>}</div>
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {DEMANDA.campos.filter((c) => !c.visivel || c.visivel(demanda)).map((c) => (
                <div key={c.nome} className={c.tipo === 'texto_longo' ? 'sm:col-span-2' : ''}>
                  <dt className="text-xs text-slate-500">{c.rotulo}</dt>
                  <dd className="mt-0.5">{c.nome === 'numero_sei' ? String(processo.numero_sei ?? '—') : valorExibido(c, demanda, dados) || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {aba === 'alunos' && (
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
        )}

        {aba === 'valor' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Valor definido</h3>
                  {demanda.valor_mensal ? (
                    <p className="mt-1">
                      {formatarMoeda(demanda.valor_mensal)}/mês × {String(demanda.meses_previstos)} meses = <strong>{formatarMoeda(demanda.valor_total)}</strong>
                      <span className="text-slate-500"> · {demanda.metodo_valor === 'tres_cotacoes' ? 'três cotações' : 'preço de referência'}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-500">Ainda não definido.</p>
                  )}
                  {menorCotacao && (
                    <p className="mt-1 text-green-700">
                      Menor cotação: {String(menorCotacao.fornecedor)} — {formatarMoeda(menorCotacao.valor_mensal)}/mês
                      {Boolean(demanda.valor_mensal) && Number(demanda.valor_mensal) > Number(menorCotacao.valor_mensal) && <span className="ml-1 font-medium text-orange-600">(valor definido está acima da menor cotação)</span>}
                    </p>
                  )}
                </div>
                {pode && <Botao variante="secundario" onClick={() => setEditando('valor')}><Pencil size={16} /> Definir valor</Botao>}
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Preços de referência vigentes na SRE</p>
                {precosVigentes.length === 0 ? (
                  <p className="text-slate-500">Nenhum.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {precosVigentes.map((p) => (
                      <li key={p.id}>
                        {String(achar('tipos_veiculo', p.tipo_veiculo_id)?.nome)} — {formatarMoeda(p.valor)} ({UNIDADES_PRECO.find((u) => u.valor === p.unidade)?.rotulo})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <SecaoRegistros
              config={COTACAO}
              valoresFixos={{ demanda_id: demanda.id }}
              registros={d.cotacoes}
              referencias={dados}
              podeEditar={pode}
              aoAlterar={recarregar}
              cabecalho="Registre ao menos três cotações. O sistema destaca a menor."
              destacarLinha={(c) => (c.id === menorCotacao?.id ? 'bg-green-50' : undefined)}
              padraoNovo={{ data: hoje }}
            />
          </div>
        )}

        {aba === 'financeiro' && (
          <div className="space-y-6">
            <SecaoRegistros config={AUTORIZACAO} valoresFixos={{ demanda_id: demanda.id }} registros={d.autorizacoes} referencias={dados} podeEditar={podeFinanceiro} aoAlterar={recarregar} padraoNovo={{ data: hoje, valor: demanda.valor_total }} />
            <SecaoRegistros config={LIBERACAO} valoresFixos={{ demanda_id: demanda.id }} registros={d.liberacoes} referencias={dados} podeEditar={podeFinanceiro} aoAlterar={recarregar} padraoNovo={{ data: hoje, valor: demanda.valor_total }} />
            {!podeFinanceiro && <p className="text-xs text-slate-500">OP, PAF e liberação são lançados pelo órgão central.</p>}
          </div>
        )}

        {aba === 'contrato' && (
          <div className="space-y-4">
            {contrato ? (
              (() => {
                const s = calcularSituacao(contrato, lista('aditivos').filter((a) => a.instrumento_id === contrato.id), lista('parcelas').filter((p) => p.instrumento_id === contrato.id), hoje)
                return (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">Contrato nº {String(contrato.numero)} <SeloVigencia faixa={s.faixa} /></h3>
                      <Link to={`/contratos/${contrato.id}`} className="inline-flex items-center gap-1 text-marca-700 hover:underline">Abrir gestão do contrato <ExternalLink size={14} /></Link>
                    </div>
                    <p className="mt-2">Contratado: {String(achar('transportadores', contrato.transportador_id)?.razao_social ?? '')}</p>
                    <p>Vigência: {formatarData(contrato.vigencia_inicio)} a {formatarData(s.vigencia_fim_atual)} · Valor {formatarMoeda(s.valor_atual)} · Executado {s.pct_executado.toFixed(0)}% · Saldo {formatarMoeda(s.saldo)}</p>
                    <p className="mt-1 text-slate-500">Fiscalização, ocorrências, pagamentos e prestação de contas ficam na gestão do contrato.</p>
                  </div>
                )
              })()
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm">
                <p className="text-slate-600">Nenhum contrato registrado. Após a contratação pela Caixa Escolar, registre-o aqui — ele fica ligado a esta demanda pelo mesmo código único.</p>
                {pode && <Botao className="mt-3" onClick={() => setEditando('contrato')}><Plus size={16} /> Registrar contrato</Botao>}
              </div>
            )}
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
          </div>
        )}

        {aba === 'documentos' && (
          <PainelDocumentos processoId={String(processo.id)} codigoProcesso={String(processo.codigo)} dados={dados} podeEnviar={pode} aoAlterar={recarregar} etapas={etapasOpcoes} alunos={alunosOpcoes} />
        )}

        {aba === 'cumprimento' && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <h3 className="font-semibold text-slate-900">Relatório de comprovação do cumprimento</h3>
            <p className="mt-1 text-slate-600">Reúne decisão, alunos, cronologia das etapas, contrato, início do transporte, fiscalização, prestação de contas e a lista de evidências (documentos com nº SEI), para envio à AGE/Judiciário.</p>
            {Boolean(demanda.relatorio_gerado_em) && <p className="mt-2 text-green-700">Relatório gerado em {formatarData(demanda.relatorio_gerado_em)}.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/judicial/${demanda.id}/relatorio`} target="_blank" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <FileText size={16} /> Visualizar / imprimir relatório
              </Link>
              {pode && <Botao onClick={() => acao(() => registrarRelatorioCumprimento(usuario, demanda.id))}>Registrar relatório como gerado</Botao>}
            </div>
            <p className="mt-2 text-xs text-slate-500">Dica: na tela do relatório use "Imprimir → Salvar como PDF" e anexe o PDF em Documentos (tipo "Relatório de cumprimento").</p>
          </div>
        )}
      </div>

      <Modal
        titulo={{ dados: 'Editar demanda', valor: 'Definição do valor', execucao: 'Início do transporte', contrato: 'Registrar contrato da Caixa Escolar' }[editando ?? 'dados']}
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
      >
        {editando && (
          <FormularioRegistro
            config={{ dados: { ...DEMANDA, campos: DEMANDA.campos.filter((c) => c.nome !== 'numero_sei') }, valor: { ...VALOR, campos: VALOR.campos.map((c) => (c.nome === 'cotacao_escolhida_id' ? { ...c, filtroReferencia: (r: Registro) => r.demanda_id === demanda.id } : c.nome === 'preco_referencia_id' ? { ...c, filtroReferencia: (r: Registro) => r.sre_id === demanda.sre_id } : c)) }, execucao: EXECUCAO, contrato: INSTRUMENTO }[editando]}
            registro={editando === 'contrato' ? null : demanda}
            referencias={dados}
            valoresFixos={editando === 'contrato' ? { tipo: 'contrato_caixa', processo_id: processo.id } : undefined}
            valoresPadrao={
              editando === 'contrato'
                ? { tipo: 'contrato_caixa', caixa_escolar_id: demanda.caixa_escolar_id, numero_sei: processo.numero_sei, valor_global: demanda.valor_total, objeto: `Transporte escolar em cumprimento da demanda ${processo.codigo}.`, gestor_id: demanda.responsavel_sre_id, fiscal_id: demanda.responsavel_sre_id, status: 'vigente', periodicidade_prestacao: 'semestral', prazo_prestacao_dias: 30 }
                : editando === 'valor' && !demanda.valor_mensal && menorCotacao
                  ? { valor_mensal: menorCotacao.valor_mensal, cotacao_escolhida_id: menorCotacao.id, metodo_valor: 'tres_cotacoes' }
                  : undefined
            }
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
