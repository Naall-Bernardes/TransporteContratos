import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SeloVigencia } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { valorExibido } from '@/features/cadastros/exibicao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { LIMITE_ACRESCIMOS_PCT } from '@/lib/contratos/alertas'
import { montarLinhaDoTempo, ESTADOS_FINAIS_PRESTACAO } from '@/lib/contratos/calculos'
import type { Registro } from '@/lib/dados/tipos'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { podeEditar as podeEditarRegistro } from '@/lib/permissoes'
import { CONFIGS_CONTRATO, ENCERRAMENTO, INSTRUMENTO, SITUACOES_FINAIS, TIPOS_INSTRUMENTO } from './configuracoes'
import { LinhaDoTempo } from './LinhaDoTempo'
import { PrestacaoContas } from './PrestacaoContas'
import { SecaoRegistros } from './SecaoRegistros'
import { useGestaoContratual } from './useGestaoContratual'
import { PainelDocumentos } from '@/features/documentos/PainelDocumentos'
import { ErroRegra } from '@/lib/dados/repositorio'
import { gerarCronograma, gerarPrestacoesPrevistas, PERIODICIDADES } from '@/lib/dados/servicos'
import { somarMeses } from '@/lib/datas'

type Aba = 'dados' | 'aditivos' | 'financeiro' | 'fiscalizacao' | 'ocorrencias' | 'prestacao' | 'encerramento' | 'documentos' | 'linha'

const proximoNumero = (lista: Registro[]) => lista.reduce((m, r) => Math.max(m, Number(r.numero) || 0), 0) + 1
const somar = (lista: Registro[], campo: string) => lista.reduce((s, r) => s + (Number(r[campo]) || 0), 0)

function Indicador({ rotulo, valor, detalhe, children }: { rotulo: string; valor: string; detalhe?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500 uppercase">{rotulo}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{valor}</p>
      {children}
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  )
}

export function ContratoDetalhePage() {
  const { id } = useParams()
  const usuario = useUsuario()
  const { dados, itens, carregando, recarregar, hoje, doInstrumento } = useGestaoContratual()
  const [aba, setAba] = useState<Aba>('dados')
  const [editando, setEditando] = useState<'dados' | 'encerramento' | null>(null)
  const [cronograma, setCronograma] = useState<{ qtd: number; primeira_data: string; intervalo_meses: number; valor_parcela: string } | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const item = itens.find((i) => i.instrumento.id === id)
  if (carregando) return null
  if (!item)
    return (
      <div>
        <p className="text-sm text-slate-600">Instrumento não encontrado ou sem permissão de acesso.</p>
        <Link to="/contratos" className="mt-2 inline-block text-sm text-marca-700 underline">Voltar à lista</Link>
      </div>
    )

  const { instrumento: inst, situacao: s, alertas } = item
  const consulta = (c: 'aditivos' | 'parcelas' | 'fiscalizacoes' | 'ocorrencias' | 'prestacoes_contas') => doInstrumento(c, inst.id)
  const aditivos = consulta('aditivos')
  const parcelas = consulta('parcelas')
  const fiscalizacoes = consulta('fiscalizacoes')
  const ocorrencias = consulta('ocorrencias')
  const prestacoes = consulta('prestacoes_contas')
  const encerrado = s.faixa === 'encerrado'
  const termo = inst.tipo === 'termo_pte'
  const consultaGeral = (c: Parameters<typeof podeEditarRegistro>[1], rid: unknown) => dados[c]?.find((r) => r.id === rid)
  const podeEditar = podeEditarRegistro(usuario, 'instrumentos', inst, consultaGeral) && (!encerrado || usuario.papel === 'admin')
  const podeLancar = podeEditar && !encerrado

  const ABAS: { id: Aba; rotulo: string; qtd?: number }[] = [
    { id: 'dados', rotulo: 'Dados' },
    { id: 'aditivos', rotulo: 'Aditivos', qtd: aditivos.length },
    { id: 'financeiro', rotulo: termo ? 'Repasses' : 'Pagamentos', qtd: parcelas.length },
    { id: 'fiscalizacao', rotulo: 'Fiscalização', qtd: fiscalizacoes.length },
    { id: 'ocorrencias', rotulo: 'Ocorrências', qtd: ocorrencias.length },
    { id: 'prestacao', rotulo: 'Prestação de contas', qtd: prestacoes.length },
    { id: 'encerramento', rotulo: 'Encerramento' },
    { id: 'documentos', rotulo: 'Documentos', qtd: (dados.documentos ?? []).filter((x) => x.instrumento_id === inst.id).length },
    { id: 'linha', rotulo: 'Linha do tempo' },
  ]

  const secao = (colecao: 'aditivos' | 'parcelas' | 'fiscalizacoes' | 'ocorrencias', registros: Registro[], extra: Partial<Parameters<typeof SecaoRegistros>[0]> = {}) => (
    <SecaoRegistros
      config={colecao === 'parcelas' ? { ...CONFIGS_CONTRATO.parcelas, singular: termo ? 'repasse' : 'pagamento' } : CONFIGS_CONTRATO[colecao]}
      valoresFixos={{ instrumento_id: inst.id }}
      registros={registros}
      referencias={dados}
      podeEditar={podeLancar}
      aoAlterar={recarregar}
      {...extra}
    />
  )

  // Pendências verificadas automaticamente antes do encerramento
  const pendencias = [
    s.dias_para_vencer > 0 && `A vigência só termina em ${formatarData(s.vigencia_fim_atual)} — encerramento antecipado (avalie se é rescisão).`,
    s.saldo > 0 && `Saldo não executado de ${formatarMoeda(s.saldo)}.`,
    parcelas.some((p) => !p.valor_pago) && `${parcelas.filter((p) => !p.valor_pago).length} parcela(s) prevista(s) sem pagamento.`,
    prestacoes.some((p) => !ESTADOS_FINAIS_PRESTACAO.includes(String(p.status))) && 'Há prestação de contas ainda não decidida.',
    prestacoes.length === 0 && 'Nenhuma prestação de contas registrada.',
    ocorrencias.some((o) => o.status !== 'resolvida') && 'Há ocorrências não resolvidas.',
  ].filter(Boolean) as string[]

  return (
    <div>
      <Link to="/contratos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700">
        <ArrowLeft size={16} /> Gestão contratual
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{String(item.processo?.codigo ?? '')}</h1>
            <SeloVigencia faixa={s.faixa} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {TIPOS_INSTRUMENTO.find((t) => t.valor === inst.tipo)?.rotulo} nº {String(inst.numero)} · Processo SEI {String(inst.numero_sei)} · SRE {item.sigla_sre}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-slate-500">{termo ? 'Concedente' : 'Contratante'}:</span> {item.contratante} ·{' '}
            <span className="text-slate-500">{termo ? 'Convenente' : 'Contratado'}:</span> {item.contratado}
          </p>
          {(() => {
            const dem = dados.demandas?.find((x) => x.processo_id === inst.processo_id)
            const ades = dados.adesoes_pte?.find((x) => x.processo_id === inst.processo_id)
            if (dem) return <Link to={`/judicial/${dem.id}`} className="mt-1 inline-block text-sm text-marca-700 hover:underline">Ver demanda judicial de origem →</Link>
            if (ades) return <Link to={`/pte/adesoes/${ades.id}`} className="mt-1 inline-block text-sm text-marca-700 hover:underline">Ver adesão PTE de origem →</Link>
            return null
          })()}
        </div>
        {podeEditar && (
          <Botao variante="secundario" onClick={() => setEditando('dados')}>
            <Pencil size={16} /> Editar dados
          </Botao>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          rotulo="Vigência atual"
          valor={`${formatarData(inst.vigencia_inicio)} a ${formatarData(s.vigencia_fim_atual)}`}
          detalhe={encerrado ? `Encerrado em ${formatarData(inst.encerrado_em)}` : s.dias_para_vencer >= 0 ? `Faltam ${s.dias_para_vencer} dias` : `Vencido há ${-s.dias_para_vencer} dias`}
        />
        <Indicador
          rotulo="Valor atual"
          valor={formatarMoeda(s.valor_atual)}
          detalhe={
            <>
              Original {formatarMoeda(s.valor_original)}
              {s.qtd_aditivos > 0 && (
                <span className={s.pct_acrescimos > LIMITE_ACRESCIMOS_PCT ? 'font-medium text-orange-600' : ''}>
                  {' '}· acréscimos {s.pct_acrescimos.toFixed(1)}%{s.pct_supressoes > 0 && ` · supressões ${s.pct_supressoes.toFixed(1)}%`}
                </span>
              )}
            </>
          }
        />
        <Indicador rotulo="Executado" valor={formatarMoeda(s.valor_executado)} detalhe={`${s.pct_executado.toFixed(1)}% do valor atual`}>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-marca-600" style={{ width: `${Math.min(100, s.pct_executado)}%` }} />
          </div>
        </Indicador>
        <Indicador rotulo="Saldo contratual" valor={formatarMoeda(s.saldo)} detalhe={`${s.qtd_aditivos} aditivo(s)`} />
      </div>

      {alertas.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {alertas.map((a) => (
            <li
              key={a.texto}
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${a.nivel === 'critico' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}
            >
              {a.nivel === 'critico' ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
              {a.texto}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 overflow-x-auto overflow-y-hidden border-b border-slate-200">
        <nav className="flex gap-1" aria-label="Seções do instrumento">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${aba === a.id ? 'border-marca-600 font-medium text-marca-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {a.rotulo}
              {a.qtd !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{a.qtd}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4">
        {aba === 'dados' && (
          <dl className="grid gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
            {INSTRUMENTO.campos
              .filter((c) => !c.visivel || c.visivel(inst))
              .map((c) => (
                <div key={c.nome} className={c.tipo === 'texto_longo' ? 'sm:col-span-2' : ''}>
                  <dt className="text-xs text-slate-500">{c.rotulo}</dt>
                  <dd className="mt-0.5">{valorExibido(c, inst, dados) || '—'}</dd>
                </div>
              ))}
          </dl>
        )}

        {aba === 'aditivos' &&
          secao('aditivos', aditivos, {
            padraoNovo: { numero: proximoNumero(aditivos) },
            cabecalho: (
              <>
                Cada aditivo recalcula automaticamente a vigência e o valor do instrumento. Não é aceito aditivo assinado depois do fim da vigência.
                {s.qtd_aditivos > 0 && (
                  <span className={`mt-1 block ${s.pct_acrescimos > LIMITE_ACRESCIMOS_PCT ? 'font-medium text-orange-600' : ''}`}>
                    Acréscimos acumulados: {s.pct_acrescimos.toFixed(1)}% do valor original (referência usual: até {LIMITE_ACRESCIMOS_PCT}%).
                  </span>
                )}
              </>
            ),
          })}

        {aba === 'financeiro' &&
          secao('parcelas', parcelas, {
            padraoNovo: { numero: proximoNumero(parcelas) },
            acoesCabecalho: podeLancar ? (
              <Botao variante="secundario" onClick={() => { setErroAcao(null); setCronograma({ qtd: 12, primeira_data: somarMeses(String(inst.vigencia_inicio), 1), intervalo_meses: 1, valor_parcela: '' }) }}>
                Gerar cronograma
              </Botao>
            ) : undefined,
            cabecalho: `Parcelas previstas e ${termo ? 'repasses' : 'pagamentos'} efetivados. O total pago não pode ultrapassar o valor atual do instrumento.`,
            destacarLinha: (p) => (!p.valor_pago && String(p.data_prevista) < hoje ? 'bg-red-50' : undefined),
            rodape: () => (
              <tr>
                {CONFIGS_CONTRATO.parcelas.campos
                  .filter((c) => c.naTabela)
                  .map((c, i) => (
                    <td key={c.nome} className={`px-3 py-2 ${c.tipo === 'moeda' ? 'text-right whitespace-nowrap tabular-nums' : ''}`}>
                      {i === 0 ? 'Total' : c.nome === 'valor_previsto' ? formatarMoeda(somar(parcelas, 'valor_previsto')) : c.nome === 'valor_pago' ? formatarMoeda(somar(parcelas, 'valor_pago')) : ''}
                    </td>
                  ))}
                {podeLancar && <td />}
              </tr>
            ),
          })}

        {aba === 'fiscalizacao' &&
          secao('fiscalizacoes', fiscalizacoes, {
            padraoNovo: { competencia: hoje.slice(0, 7), fiscal_id: inst.fiscal_id, data_registro: hoje, conformidade: 'conforme' },
            cabecalho:
              fiscalizacoes.length > 0
                ? `${fiscalizacoes.length} mês(es) fiscalizado(s) · ${somar(fiscalizacoes, 'dias_rodados')} dias rodados · ${somar(fiscalizacoes, 'km_rodados').toLocaleString('pt-BR')} km · média de ${(somar(fiscalizacoes, 'alunos_transportados') / fiscalizacoes.length).toFixed(1)} alunos/mês`
                : 'Registre mensalmente dias rodados, alunos transportados e km.',
            destacarLinha: (f) => (f.conformidade === 'nao_conforme' ? 'bg-red-50' : f.conformidade === 'ressalvas' ? 'bg-amber-50' : undefined),
          })}

        {aba === 'ocorrencias' &&
          secao('ocorrencias', ocorrencias, {
            padraoNovo: { data: hoje, status: 'aberta', gravidade: 'media' },
            cabecalho: 'Registre falhas na execução e as notificações enviadas ao contratado, com o prazo de resposta.',
            destacarLinha: (o) => (o.status !== 'resolvida' && o.gravidade === 'alta' ? 'bg-red-50' : undefined),
          })}

        {aba === 'documentos' && item.processo && (
          <PainelDocumentos
            processoId={String(item.processo.id)}
            codigoProcesso={String(item.processo.codigo)}
            dados={dados}
            podeEnviar={podeEditar}
            aoAlterar={recarregar}
            filtro={(x) => x.instrumento_id === inst.id}
            vinculos={{ instrumento_id: inst.id }}
          />
        )}

        {aba === 'prestacao' && podeLancar && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
            <span>
              Periodicidade: <strong>{PERIODICIDADES[String(inst.periodicidade_prestacao ?? 'final')]?.rotulo}</strong> · prazo de {String(inst.prazo_prestacao_dias ?? 30)} dias após cada período
            </span>
            <Botao
              variante="secundario"
              onClick={async () => {
                setErroAcao(null)
                const n = await gerarPrestacoesPrevistas(usuario, inst.id)
                setErroAcao(n ? null : 'Nenhuma prestação nova: todos os períodos já estão previstos.')
                await recarregar()
              }}
            >
              Gerar prestações previstas
            </Botao>
          </div>
        )}
        {aba === 'prestacao' && erroAcao && <p className="mb-3 text-sm text-slate-600">{erroAcao}</p>}
        {aba === 'prestacao' && (
          <PrestacaoContas instrumentoId={inst.id} prestacoes={prestacoes} referencias={dados} podeEditar={podeEditar} hoje={hoje} aoAlterar={recarregar} />
        )}

        {aba === 'encerramento' &&
          (encerrado ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-slate-900">
                <CheckCircle2 size={18} className="text-green-600" /> Instrumento encerrado em {formatarData(inst.encerrado_em)}
              </p>
              <p className="mt-2"><span className="text-slate-500">Situação final:</span> {SITUACOES_FINAIS.find((o) => o.valor === inst.situacao_final)?.rotulo}</p>
              <p><span className="text-slate-500">Termo de encerramento (SEI):</span> {String(inst.termo_encerramento_sei ?? '—')}</p>
              {Boolean(inst.pendencias_encerramento) && <p><span className="text-slate-500">Pendências:</span> {String(inst.pendencias_encerramento)}</p>}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h3 className="font-medium text-slate-900">Verificação antes do encerramento</h3>
              {pendencias.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-green-700"><CheckCircle2 size={16} /> Nenhuma pendência encontrada.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">
                  {pendencias.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
              <p className="mt-3 text-slate-600">
                Após o encerramento o instrumento fica bloqueado para novos lançamentos. Se houver pendências, escolha “Concluído com pendências” e descreva-as.
              </p>
              {podeEditar && (
                <Botao className="mt-3" onClick={() => setEditando('encerramento')}>
                  Encerrar instrumento
                </Botao>
              )}
            </div>
          ))}

        {aba === 'linha' && (
          <LinhaDoTempo eventos={montarLinhaDoTempo({ instrumento: inst, aditivos, parcelas, fiscalizacoes, ocorrencias, prestacoes })} hoje={hoje} />
        )}
      </div>

      <Modal titulo="Gerar cronograma de parcelas" aberto={cronograma !== null} aoFechar={() => setCronograma(null)} largura="md">
        {cronograma && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p className="text-slate-600 sm:col-span-2">
              Distribui o valor ainda não previsto ({formatarMoeda(s.valor_atual - somar(parcelas, 'valor_previsto'))}) em parcelas iguais, a partir da data escolhida.
            </p>
            <label className="block">Nº de parcelas<input type="number" min={1} max={60} className="campo mt-1" value={cronograma.qtd} onChange={(e) => setCronograma({ ...cronograma, qtd: Number(e.target.value) })} /></label>
            <label className="block">Intervalo (meses)<input type="number" min={1} max={12} className="campo mt-1" value={cronograma.intervalo_meses} onChange={(e) => setCronograma({ ...cronograma, intervalo_meses: Number(e.target.value) })} /></label>
            <label className="block">1ª parcela em<input type="date" className="campo mt-1" value={cronograma.primeira_data} onChange={(e) => setCronograma({ ...cronograma, primeira_data: e.target.value })} /></label>
            <label className="block">Valor fixo por parcela (opcional)<input type="number" step="0.01" className="campo mt-1" value={cronograma.valor_parcela} onChange={(e) => setCronograma({ ...cronograma, valor_parcela: e.target.value })} /></label>
            {erroAcao && <p className="rounded-md bg-red-50 px-3 py-2 text-red-700 sm:col-span-2">{erroAcao}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Botao variante="secundario" onClick={() => setCronograma(null)}>Cancelar</Botao>
              <Botao
                onClick={async () => {
                  try {
                    await gerarCronograma(usuario, inst.id, { qtd: cronograma.qtd, primeira_data: cronograma.primeira_data, intervalo_meses: cronograma.intervalo_meses, valor_parcela: Number(cronograma.valor_parcela) || undefined })
                    setCronograma(null)
                    await recarregar()
                  } catch (e) {
                    if (e instanceof ErroRegra) setErroAcao(e.message)
                    else throw e
                  }
                }}
              >
                Gerar parcelas
              </Botao>
            </div>
          </div>
        )}
      </Modal>

      <Modal titulo={editando === 'encerramento' ? 'Encerrar instrumento' : 'Editar dados do instrumento'} aberto={editando !== null} aoFechar={() => setEditando(null)}>
        {editando && (
          <FormularioRegistro
            config={editando === 'encerramento' ? ENCERRAMENTO : INSTRUMENTO}
            registro={inst}
            referencias={dados}
            valoresPadrao={editando === 'encerramento' ? { encerrado_em: hoje } : undefined}
            rotuloSalvar={editando === 'encerramento' ? 'Encerrar' : 'Salvar'}
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
