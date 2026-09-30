import { ArrowLeft, Calculator, Download, ExternalLink, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Abas } from '@/components/comum/Abas'
import { ImportarCsv } from '@/components/comum/ImportarCsv'
import { Semaforo } from '@/components/comum/Semaforo'
import { SeloVigencia } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { SecaoRegistros } from '@/features/contratos/SecaoRegistros'
import { PainelDocumentos } from '@/features/documentos/PainelDocumentos'
import { PainelEtapas } from '@/features/fluxo/PainelEtapas'
import { calcularSituacao } from '@/lib/contratos/calculos'
import { baixarArquivo, gerarCsv } from '@/lib/csv'
import { numeroBr } from '@/lib/csvImport'
import { ErroPermissao, ErroRegra } from '@/lib/dados/repositorio'
import { calcularAdesao, executarConciliacao, feriadosDe, gerarTermo, importarAlunosTer, importarRotas } from '@/lib/dados/servicos'
import { ALOCACAO, CONTRATACAO_MUNICIPAL, DESPESA_PTE, ROTA_PTE } from '@/features/frota/configuracoes'
import { PainelConformidade } from '@/features/frota/PainelConformidade'
import { conformidadeDoContexto, totalPendencias } from '@/lib/conformidade'
import { estaduaisPorRota } from '@/lib/pte/pte'
import { somarDiasUteis } from '@/lib/diasUteis'
import { ADESAO } from './configuracoes'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { etapaAtual, montarDadosProcesso } from '@/lib/fluxo/processo'
import { calcularSemaforo } from '@/lib/fluxo/sla'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { podeEditar as podeEditarRegistro, ehCentral } from '@/lib/permissoes'
import { ROTULO_DIVERGENCIA, type TipoDivergencia } from '@/lib/pte/pte'
import { DEMANDA_EXTRA, DIVERGENCIA, GERAR_TERMO, PTE_ALUNO, STATUS_ADESAO } from './configuracoes'

type IdAba = 'fluxo' | 'rotas' | 'contratacoes' | 'alunos' | 'conciliacao' | 'calculo' | 'termo' | 'despesas' | 'extraordinarias' | 'documentos'

export function AdesaoPage() {
  const { id } = useParams()
  const usuario = useUsuario()
  const { dados, carregando, recarregar } = useTodos()
  const [aba, setAba] = useState<IdAba>('fluxo')
  const [termo, setTermo] = useState(false)
  const [editandoDeducoes, setEditandoDeducoes] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const hoje = hojeIso()
  const adesao = dados.adesoes_pte?.find((a) => a.id === id)
  const d = useMemo(() => (adesao ? montarDadosProcesso((c) => dados[c] ?? [], String(adesao.processo_id)) : null), [dados, adesao])

  if (carregando) return null
  if (!adesao || !d) return <p className="text-sm text-slate-600">Adesão não encontrada ou sem permissão. <Link to="/pte" className="text-marca-700 underline">Voltar</Link></p>

  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, rid: unknown) => lista(c).find((r) => r.id === rid)
  const municipio = achar('municipios', adesao.municipio_id)
  const ciclo = d.ciclo!
  const processo = d.processo!
  const pode = podeEditarRegistro(usuario, 'adesoes_pte', adesao, achar)
  const travado = !!ciclo.aprovado_em
  const inst = d.instrumentos[0]
  const calculos = [...d.calculos].sort((a, b) => Number(b.versao) - Number(a.versao))
  const abertas = d.divergencias.filter((x) => x.status === 'aberta')
  const modelos = lista('etapas_modelo').filter((m) => m.modulo === 'PTE')
  const { instancia } = etapaAtual(d, modelos)
  const semaforo = calcularSemaforo({ prazoEtapa: instancia?.prazo_sla as string, encerrado: adesao.status === 'encerrado' }, hoje, feriadosDe(lista))

  async function executar(fn: () => Promise<unknown>, ok: string) {
    setMsg(null)
    try {
      await fn()
      setMsg({ tipo: 'ok', texto: ok })
      await recarregar()
    } catch (e) {
      if (e instanceof ErroRegra || e instanceof ErroPermissao) setMsg({ tipo: 'erro', texto: e.message })
      else throw e
    }
  }

  function exportarAlunos() {
    const csv = gerarCsv(
      ['matricula', 'nome', 'inep', 'km_ida', 'zona', 'turno', 'origem', 'divergencia'],
      d!.pteAlunos.map((a) => [String(a.cod_simade), String(a.nome), String(a.escola_inep), String(a.km_ida).replace('.', ','), String(a.zona ?? ''), String(a.turno ?? ''), String(a.origem ?? ''), abertas.filter((x) => x.cod_simade === a.cod_simade).map((x) => ROTULO_DIVERGENCIA[x.tipo as TipoDivergencia]).join(' | ')]),
    )
    baixarArquivo(`alunos_pte_${municipio?.cod_ibge}_${ciclo.ano}.csv`, csv)
  }

  const ABAS = [
    { id: 'fluxo' as const, rotulo: 'Fluxo e etapas' },
    { id: 'rotas' as const, rotulo: 'Rotas (TER/MG)', qtd: d.rotas.length },
    { id: 'contratacoes' as const, rotulo: 'Contratações e frota', qtd: d.contratacoes.length, alerta: totalPendencias(d.conformidade) > 0 },
    { id: 'alunos' as const, rotulo: 'Alunos (TER)', qtd: d.pteAlunos.length },
    { id: 'conciliacao' as const, rotulo: 'Conciliação SIMADE', qtd: abertas.length, alerta: abertas.length > 0 },
    { id: 'calculo' as const, rotulo: 'Cálculo', qtd: calculos.length },
    { id: 'termo' as const, rotulo: 'Termo e repasses' },
    { id: 'despesas' as const, rotulo: 'Despesas do município', qtd: lista('despesas_pte').filter((x) => x.adesao_id === adesao.id).length },
    { id: 'extraordinarias' as const, rotulo: 'Demandas extraordinárias', qtd: lista('demandas_extraordinarias').filter((x) => x.adesao_id === adesao.id).length },
    { id: 'documentos' as const, rotulo: 'Documentos', qtd: d.documentos.length },
  ]

  return (
    <div>
      <Link to="/pte" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700"><ArrowLeft size={16} /> PTE</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{String(municipio?.nome)} — PTE {String(ciclo.ano)}</h1>
          <p className="mt-1 text-sm text-slate-600">{String(processo.codigo)} · Processo SEI {String(processo.numero_sei ?? '—')} · adesão em {formatarData(adesao.data_adesao)}</p>
          <p className="mt-1 text-sm">Situação: <strong>{STATUS_ADESAO.find((s) => s.valor === adesao.status)?.rotulo}</strong>{travado && <span className="text-slate-500"> · ciclo aprovado (cálculo travado)</span>}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><Semaforo semaforo={semaforo} /></div>
      </div>

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />
      {msg && <p className={`mt-4 rounded-md px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>}

      <div className="mt-4">
        {aba === 'fluxo' && <PainelEtapas processoId={String(processo.id)} modulo="PTE" dados={dados} aoAlterar={recarregar} />}

        {aba === 'alunos' && (
          <SecaoRegistros
            config={PTE_ALUNO}
            valoresFixos={{ adesao_id: adesao.id }}
            registros={d.pteAlunos}
            referencias={dados}
            podeEditar={pode && !travado}
            aoAlterar={recarregar}
            cabecalho={travado ? 'Ciclo aprovado: inclusões só por demanda extraordinária.' : 'Lista de alunos atendidos informada pelo município (TER/MG). Pode ser importada do Excel.'}
            destacarLinha={(a) => (abertas.some((x) => x.cod_simade === a.cod_simade) ? 'bg-red-50' : undefined)}
            acoesCabecalho={
              <>
                <Botao variante="secundario" onClick={exportarAlunos} disabled={!d.pteAlunos.length}><Download size={16} /> Exportar CSV</Botao>
                {pode && !travado && <ImportarCsv titulo="Importar lista TER" colunas="matricula, nome, inep, km_ida, zona, turno" importar={(l) => importarAlunosTer(usuario, adesao.id, l, numeroBr)} aoConcluir={recarregar} />}
              </>
            }
          />
        )}

        {aba === 'conciliacao' && (
          <SecaoRegistros
            config={DIVERGENCIA}
            valoresFixos={{ adesao_id: adesao.id }}
            registros={d.divergencias}
            referencias={dados}
            podeEditar={false}
            aoAlterar={recarregar}
            cabecalho={
              <>
                Compara a lista TER com o SIMADE do ciclo: matrícula inexistente ou inativa, escola diferente e aluno informado por dois municípios.
                <span className="mt-1 block">
                  {adesao.conciliado_em ? `Última conciliação: ${formatarData(adesao.conciliado_em)}.` : 'Conciliação ainda não executada.'} {abertas.length} aberta(s) · alunos com divergência aberta não entram no cálculo.
                </span>
              </>
            }
            destacarLinha={(x) => (x.status === 'aberta' ? 'bg-red-50' : undefined)}
            acoesCabecalho={pode ? <Botao onClick={() => executar(async () => { const n = await executarConciliacao(usuario, adesao.id); return n }, 'Conciliação executada.')}><RefreshCw size={16} /> Executar conciliação</Botao> : undefined}
          />
        )}
        {aba === 'conciliacao' && pode && d.divergencias.length > 0 && <JustificarDivergencias divergencias={d.divergencias} dados={dados} aoAlterar={recarregar} />}

        {aba === 'calculo' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <p>
                Res. SEE/SEGOV 5.267/2026, art. 14: por rota, km/dia × custo/km × {String(ciclo.dias_letivos ?? 200)} dias × (estudantes estaduais ÷ passageiros).
                Deduções: PNATE estadual {formatarMoeda(adesao.pnate_estadual ?? 0)} e saldo reprogramado {formatarMoeda(adesao.saldo_reprogramado ?? 0)}.
                Rotas com inconsistência aberta e estudantes com divergência aberta ficam fora.
              </p>
              {pode && !travado && <Botao variante="secundario" onClick={() => setEditandoDeducoes(true)}>Deduções</Botao>}
              {ehCentral(usuario) && !travado && <Botao onClick={() => executar(() => calcularAdesao(usuario, adesao.id), 'Cálculo registrado.')}><Calculator size={16} /> Calcular</Botao>}
            </div>
            {calculos.map((c, i) => (
              <div key={c.id} className={`rounded-lg border bg-white p-4 text-sm ${i === 0 ? 'border-marca-600' : 'border-slate-200 opacity-70'}`}>
                <p className="font-semibold">
                  Versão {String(c.versao)} — {formatarMoeda(c.valor_calculado)} <span className="font-normal text-slate-500">· {formatarData(c.calculado_em)}{i === 0 ? ' · vigente' : ''}</span>
                </p>
                <pre className="mt-2 font-sans text-sm whitespace-pre-wrap text-slate-700">{String(c.memoria ?? '')}</pre>
              </div>
            ))}
            {calculos.length === 0 && <p className="text-sm text-slate-500">Nenhum cálculo registrado.</p>}
          </div>
        )}

        {aba === 'termo' && (
          inst ? (
            (() => {
              const s = calcularSituacao(inst, lista('aditivos').filter((a) => a.instrumento_id === inst.id), d.parcelas, hoje)
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Termo {String(inst.numero)} <SeloVigencia faixa={s.faixa} /></h3>
                    <Link to={`/contratos/${inst.id}`} className="inline-flex items-center gap-1 text-marca-700 hover:underline">Abrir gestão do termo <ExternalLink size={14} /></Link>
                  </div>
                  <p className="mt-2">Valor {formatarMoeda(s.valor_atual)} · repassado {formatarMoeda(s.valor_executado)} ({s.pct_executado.toFixed(0)}%) · saldo {formatarMoeda(s.saldo)}</p>
                  <p>Vigência {formatarData(inst.vigencia_inicio)} a {formatarData(s.vigencia_fim_atual)}</p>
                  <table className="mt-3 w-full text-left text-xs">
                    <thead><tr className="border-b text-slate-500"><th className="py-1">Parcela</th><th>Prevista</th><th className="text-right">Valor</th><th>Repasse</th></tr></thead>
                    <tbody>
                      {d.parcelas.sort((a, b) => Number(a.numero) - Number(b.numero)).map((p) => (
                        <tr key={p.id} className="border-b border-slate-100">
                          <td className="py-1">{String(p.numero)}</td>
                          <td>{formatarData(p.data_prevista)}</td>
                          <td className="text-right tabular-nums">{formatarMoeda(p.valor_previsto)}</td>
                          <td>{p.data_pagamento ? `${formatarData(p.data_pagamento)} · ${formatarMoeda(p.valor_pago)}` : <span className="text-slate-400">pendente</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-slate-500">Execução, fiscalização, ocorrências e prestação de contas ficam na gestão do termo.</p>
                </div>
              )
            })()
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm">
              <p>{travado ? `Ciclo aprovado. Valor a repassar: ${formatarMoeda(calculos[0]?.valor_calculado)}. Gere o termo com o cronograma de ${ciclo.num_parcelas} parcela(s).` : 'O termo é gerado depois da aprovação do cálculo do ciclo.'}</p>
              {travado && ehCentral(usuario) && <Botao className="mt-3" onClick={() => setTermo(true)}>Gerar termo</Botao>}
            </div>
          )
        )}

        {aba === 'rotas' && (
          <SecaoRegistros
            config={ROTA_PTE}
            valoresFixos={{ adesao_id: adesao.id }}
            registros={d.rotas}
            referencias={{ ...dados, contratacoes_municipais: d.contratacoes }}
            podeEditar={pode && !travado}
            aoAlterar={recarregar}
            padraoNovo={{ custo_km: d.rotas[0]?.custo_km, turno: 'manha' }}
            cabecalho={(() => {
              const est = estaduaisPorRota(d.pteAlunos)
              return (
                <>
                  Rotas do Sistema Transcolar Rural. Estudantes estaduais por rota (pela lista TER):{' '}
                  {d.rotas.map((r) => `${r.codigo}: ${est.get(String(r.codigo)) ?? 0}/${r.total_passageiros}`).join(' · ') || '—'}
                </>
              )
            })()}
            destacarLinha={(r) => (d.divergencias.some((x) => x.status === 'aberta' && x.referencia === `ROTA ${r.codigo}`) ? 'bg-red-50' : undefined)}
            acoesCabecalho={pode && !travado ? <ImportarCsv titulo="Importar rotas" colunas="rota, descricao, turno, km_diario, custo_km, passageiros, capacidade, urbana" importar={(l) => importarRotas(usuario, adesao.id, l, numeroBr)} aoConcluir={recarregar} /> : undefined}
          />
        )}

        {aba === 'contratacoes' && (
          <div className="space-y-6">
            <SecaoRegistros config={CONTRATACAO_MUNICIPAL} valoresFixos={{ adesao_id: adesao.id }} registros={d.contratacoes} referencias={dados} podeEditar={pode} aoAlterar={recarregar} />
            {d.contratacoes.map((c) => {
              const conf = conformidadeDoContexto(lista, { contratacao_id: c.id }, hoje)
              return (
                <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {c.tipo === 'frota_propria' ? 'Frota própria do município' : `Contrato ${c.numero_contrato} — ${String(achar('transportadores', c.transportador_id)?.razao_social ?? '')}`}
                  </h3>
                  <div className="mt-3">
                    <SecaoRegistros
                      config={ALOCACAO}
                      valoresFixos={{ contratacao_id: c.id }}
                      registros={lista('alocacoes').filter((a) => a.contratacao_id === c.id)}
                      referencias={dados}
                      podeEditar={pode}
                      aoAlterar={recarregar}
                      padraoNovo={{ inicio: hoje }}
                      cabecalho="Veículos e condutores mantidos com recursos do PTE — devem cumprir o CTB, arts. 136 a 139 (Res. 5.267/2026, art. 8º)."
                    />
                  </div>
                  <div className="mt-4">
                    <PainelConformidade entidades={conf} dados={dados} podeEnviar={pode} aoAlterar={recarregar} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {aba === 'despesas' && (
          <SecaoRegistros
            config={DESPESA_PTE}
            valoresFixos={{ adesao_id: adesao.id }}
            registros={lista('despesas_pte').filter((x) => x.adesao_id === adesao.id)}
            referencias={{ ...dados, contratacoes_municipais: d.contratacoes }}
            podeEditar={pode}
            aoAlterar={recarregar}
            padraoNovo={{ data_transacao: hoje }}
            cabecalho={(() => {
              const desp = lista('despesas_pte').filter((x) => x.adesao_id === adesao.id)
              const feriados = feriadosDe(lista)
              const atrasadas = desp.filter((x) => !x.data_comprovacao && somarDiasUteis(String(x.data_transacao), 30, feriados) < hoje).length
              const total = desp.reduce((t, x) => t + Number(x.valor || 0), 0)
              return `Total pago: ${formatarMoeda(total)}. ${atrasadas} despesa(s) sem comprovação há mais de 30 dias úteis (em vermelho). Prestação de contas anual até 28/02 do ano seguinte.`
            })()}
            destacarLinha={(x) => (!x.data_comprovacao && somarDiasUteis(String(x.data_transacao), 30, feriadosDe(lista)) < hoje ? 'bg-red-50' : undefined)}
          />
        )}

        {aba === 'extraordinarias' && (
          <SecaoRegistros config={DEMANDA_EXTRA} valoresFixos={{ adesao_id: adesao.id }} registros={lista('demandas_extraordinarias').filter((x) => x.adesao_id === adesao.id)} referencias={dados} podeEditar={pode} aoAlterar={recarregar} padraoNovo={{ data_solicitacao: hoje, status: 'solicitada' }} />
        )}

        {aba === 'documentos' && (
          <PainelDocumentos processoId={String(processo.id)} codigoProcesso={String(processo.codigo)} dados={dados} podeEnviar={pode} aoAlterar={recarregar} etapas={modelos.map((m) => ({ codigo: String(m.codigo), nome: String(m.nome) }))} />
        )}
      </div>

      <Modal titulo="Deduções do cálculo" aberto={editandoDeducoes} aoFechar={() => setEditandoDeducoes(false)} largura="md">
        {editandoDeducoes && (
          <FormularioRegistro
            config={{ ...ADESAO, campos: ADESAO.campos.filter((c) => c.nome === 'pnate_estadual' || c.nome === 'saldo_reprogramado') }}
            registro={adesao}
            referencias={dados}
            aoCancelar={() => setEditandoDeducoes(false)}
            aoSalvar={async () => {
              setEditandoDeducoes(false)
              await recarregar()
            }}
          />
        )}
      </Modal>

      <Modal titulo="Gerar termo PTE" aberto={termo} aoFechar={() => setTermo(false)}>
        {termo && (
          <FormularioRegistro
            config={GERAR_TERMO}
            registro={null}
            referencias={dados}
            valoresPadrao={{ numero_sei: processo.numero_sei, data_assinatura: hoje, gestor_id: usuario.id }}
            acao={(v) => gerarTermo(usuario, adesao.id, v)}
            rotuloSalvar="Gerar termo e cronograma"
            aoCancelar={() => setTermo(false)}
            aoSalvar={async () => {
              setTermo(false)
              await recarregar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}

/** Tratamento das divergências: justificar (mantém o aluno no cálculo) ou marcar como corrigida. */
function JustificarDivergencias({ divergencias, dados, aoAlterar }: { divergencias: Registro[]; dados: Partial<Record<Colecao, Registro[]>>; aoAlterar: () => Promise<void> }) {
  const [editando, setEditando] = useState<string>('')
  const div = divergencias.find((x) => x.id === editando)
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <select className="campo w-auto min-w-72" value={editando} onChange={(e) => setEditando(e.target.value)} aria-label="Divergência">
        <option value="">Tratar divergência…</option>
        {divergencias.filter((x) => x.status === 'aberta').map((x) => <option key={x.id} value={x.id}>{String(x.cod_simade)} — {ROTULO_DIVERGENCIA[x.tipo as TipoDivergencia]}</option>)}
      </select>
      <Modal titulo="Tratar divergência" aberto={!!div} aoFechar={() => setEditando('')} largura="md">
        {div && (
          <>
            <p className="mb-3 text-sm text-slate-700">{String(div.descricao)}</p>
            <FormularioRegistro
              config={{ ...DIVERGENCIA, campos: DIVERGENCIA.campos.filter((c) => c.emFormulario !== false) }}
              registro={div}
              referencias={dados}
              aoCancelar={() => setEditando('')}
              aoSalvar={async () => {
                setEditando('')
                await aoAlterar()
              }}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
