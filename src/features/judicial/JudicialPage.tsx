import { CheckCircle2, Download, Mail, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Cartao } from '@/components/comum/Cartao'
import { PontoSemaforo, ROTULO_COR } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { baixarArquivo, gerarCsv } from '@/lib/csv'
import { feriadosDe } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { ROTULO_NIVEL } from '@/lib/fluxo/sla'
import { avaliarEtapa, montarDadosProcesso } from '@/lib/fluxo/processo'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { situacaoDosProcessos } from '@/lib/monitoramento'
import { ehCentral, podeAutorizarLiberacao, ROTULO_PAPEL } from '@/lib/permissoes'
import { LiberacaoRapida, MESES_PADRAO, valorMensalSugerido } from './Autorizacao'
import { ORIGENS } from './configuracoes'

type Filtro = '' | 'ativas' | 'vermelho' | 'amarelo' | 'judicial_vencido' | 'nivel3' | 'cumpridas'

/**
 * Lista de demandas. Em /judicial/etapa/:codigo vira a FILA daquela etapa (submenu do Judicial/MP),
 * mostrando o que falta em cada demanda para concluir a etapa.
 */
export function JudicialPage() {
  const { codigo } = useParams()
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, recarregar } = useTodos()
  const hoje = hojeIso()
  const [filtro, setFiltro] = useState<Filtro>('ativas')
  const [etapaEscolhida, setEtapa] = useState('')
  const etapa = codigo ?? etapaEscolhida
  const [sre, setSre] = useState('')
  const [busca, setBusca] = useState('')
  const [liberando, setLiberando] = useState<string | null>(null)
  const filaAutorizacao = codigo === 'C02'
  const podeLiberar = podeAutorizarLiberacao(usuario)

  const linhas = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
    return situacaoDosProcessos(lista, hoje, feriadosDe(lista))
      .filter((s) => s.demanda)
      .map((s) => {
        const alunos = lista('demanda_alunos')
          .filter((a) => a.demanda_id === s.demanda!.id && !a.removido_em)
          .map((a) => String(achar('alunos', a.aluno_id)?.nome ?? ''))
        return {
          ...s,
          alunos,
          escola: String(achar('escolas', s.demanda!.escola_id)?.nome ?? ''),
          sigla: String(achar('sres', s.sre_id)?.sigla ?? ''),
          responsavel: String(achar('usuarios', s.instancia?.responsavel_id)?.nome ?? '—'),
          judicialVencido: !s.demanda!.data_inicio_transporte && String(s.demanda!.prazo_judicial) < hoje && s.demanda!.situacao === 'ativa',
          ...(codigo && s.modelo
            ? (() => {
                const dp = montarDadosProcesso(lista, s.processo.id, hoje)
                const av = avaliarEtapa(dp, s.modelo, lista('checklist_modelo'), lista('tipos_documento'))
                return {
                  falta: [...av.pendencias, ...(av.faltantes.length ? [`Documento(s): ${av.faltantes.map((f) => f.nome).join(', ')}`] : [])],
                  valorMensal: valorMensalSugerido(dp),
                  meses: Number(s.demanda!.meses_previstos || MESES_PADRAO),
                }
              })()
            : { falta: [] as string[], valorMensal: 0, meses: MESES_PADRAO }),
        }
      })
  }, [dados, hoje, codigo])

  const conta = (f: (l: (typeof linhas)[number]) => boolean) => linhas.filter(f).length
  const ativa = (l: (typeof linhas)[number]) => l.demanda!.situacao === 'ativa'
  const filtradas = linhas
    .filter((l) => {
      switch (filtro) {
        case 'ativas': return ativa(l)
        case 'vermelho': return ativa(l) && l.semaforo.cor === 'vermelho'
        case 'amarelo': return ativa(l) && l.semaforo.cor === 'amarelo'
        case 'judicial_vencido': return l.judicialVencido
        case 'nivel3': return ativa(l) && l.semaforo.nivel === 3
        case 'cumpridas': return !ativa(l)
        default: return true
      }
    })
    .filter((l) => !etapa || l.modelo?.codigo === etapa)
    .filter((l) => !sre || l.sre_id === sre)
    .filter((l) => {
      const t = busca.trim().toLocaleLowerCase('pt-BR')
      return !t || [l.processo.codigo, l.processo.numero_sei, l.demanda!.numero_processo_origem, l.demanda!.comarca, l.escola, ...l.alunos].some((x) => String(x ?? '').toLocaleLowerCase('pt-BR').includes(t))
    })
    .sort((a, b) => ({ vermelho: 0, amarelo: 1, verde: 2, cinza: 3 })[a.semaforo.cor] - ({ vermelho: 0, amarelo: 1, verde: 2, cinza: 3 })[b.semaforo.cor] || String(a.semaforo.prazo).localeCompare(String(b.semaforo.prazo)))

  function exportar() {
    const csv = gerarCsv(
      ['Código único', 'Nº SEI', 'Origem', 'Processo judicial/MP', 'Comarca', 'SRE', 'Escola', 'Alunos', 'Etapa atual', 'Responsável', 'Prazo judicial', 'Semáforo', 'Prazo que manda', 'Dias úteis', 'Escalonamento', 'Situação'],
      filtradas.map((l) => [
        String(l.processo.codigo), String(l.processo.numero_sei ?? ''), ORIGENS.find((o) => o.valor === l.demanda!.origem)?.rotulo ?? '', String(l.demanda!.numero_processo_origem), String(l.demanda!.comarca),
        l.sigla, l.escola, l.alunos.join(', '), l.modelo ? `${l.modelo.codigo} ${l.modelo.nome}` : 'Concluída', l.responsavel, formatarData(l.demanda!.prazo_judicial),
        ROTULO_COR[l.semaforo.cor], formatarData(l.semaforo.prazo), String(l.semaforo.dias_uteis ?? ''), ROTULO_NIVEL[l.semaforo.nivel], String(l.demanda!.situacao),
      ]),
    )
    baixarArquivo(`demandas_judiciais_${hoje}.csv`, csv)
  }

  const modeloFila = codigo ? (dados.etapas_modelo ?? []).find((m) => m.codigo === codigo) : undefined
  const f = (id: Filtro) => ({ ativo: filtro === id, onClick: () => setFiltro(filtro === id ? '' : id) })
  const etapas = (dados.etapas_modelo ?? []).filter((m) => m.modulo === 'JUDICIAL').sort((a, b) => Number(a.ordem) - Number(b.ordem))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{modeloFila ? `${modeloFila.ordem}. ${modeloFila.nome}` : 'Cumprimento de sentença'}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {modeloFila
              ? `Demandas paradas nesta etapa · SLA ${modeloFila.sla_dias_uteis ? `${modeloFila.sla_dias_uteis} dias úteis` : 'não se aplica'} · atua: ${modeloFila.papel_responsavel === 'sre' ? 'SRE' : modeloFila.papel_responsavel === 'subsecretario' ? ROTULO_PAPEL.subsecretario : 'órgão central'}.`
              : 'Cada cumprimento nasce de um ofício de intimação. Semáforo = o menor entre o prazo judicial e o prazo (SLA) da etapa atual, em dias úteis.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={exportar} disabled={!filtradas.length}><Download size={16} /> Exportar CSV</Botao>
          {!codigo && ehCentral(usuario) && (
            <Link to="/judicial/oficios" className="inline-flex items-center gap-2 rounded-md bg-marca-600 px-3 py-2 text-sm font-medium text-white hover:bg-marca-700">
              <Mail size={16} /> Iniciar a partir de um ofício
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Cartao titulo="Ativas" valor={conta(ativa)} {...f('ativas')} />
        <Cartao titulo="Vencidas (vermelho)" valor={conta((l) => ativa(l) && l.semaforo.cor === 'vermelho')} cor="text-red-600" {...f('vermelho')} />
        <Cartao titulo="A vencer (amarelo)" valor={conta((l) => ativa(l) && l.semaforo.cor === 'amarelo')} cor="text-amber-600" {...f('amarelo')} />
        <Cartao titulo="Prazo judicial vencido" valor={conta((l) => l.judicialVencido)} cor="text-red-700" {...f('judicial_vencido')} />
        <Cartao titulo="Escalonadas ao órgão central" valor={conta((l) => ativa(l) && l.semaforo.nivel === 3)} {...f('nivel3')} />
        <Cartao titulo="Cumpridas / encerradas" valor={conta((l) => !ativa(l))} {...f('cumpridas')} />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
          <input className="campo pl-9" placeholder="Código, SEI, processo, comarca, escola, aluno…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        {!codigo && <select className="campo w-auto" value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Etapa">
          <option value="">Todas as etapas</option>
          {etapas.map((m) => <option key={m.id} value={String(m.codigo)}>{String(m.ordem)}. {String(m.nome)}</option>)}
        </select>}
        {ehCentral(usuario) && (
          <select className="campo w-auto" value={sre} onChange={(e) => setSre(e.target.value)} aria-label="SRE">
            <option value="">Todas as SREs</option>
            {[...new Set(linhas.map((l) => l.sre_id))].map((id) => <option key={String(id)} value={String(id)}>{linhas.find((l) => l.sre_id === id)?.sigla}</option>)}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Código / SEI</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th className="px-3 py-2 font-medium">Escola / alunos</th>
              {!filaAutorizacao && <th className="px-3 py-2 font-medium">Etapa atual</th>}
              <th className="px-3 py-2 font-medium">Prazo judicial</th>
              <th className="px-3 py-2 font-medium">Semáforo</th>
              {filaAutorizacao && <th className="px-3 py-2 text-right font-medium">Valor do contrato</th>}
              {codigo && !filaAutorizacao && <th className="px-3 py-2 font-medium">O que falta para concluir</th>}
              {filaAutorizacao && <th className="px-3 py-2 font-medium">Liberação</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((l) => (
              <tr key={l.demanda!.id} className="cursor-pointer hover:bg-marca-50" onClick={() => navegar(`/judicial/${l.demanda!.id}${l.modelo ? `?secao=${l.modelo.codigo}` : ''}`)}>
                <td className="px-3 py-2">
                  <p className="font-medium whitespace-nowrap text-marca-700">{String(l.processo.codigo)}</p>
                  <p className="text-xs text-slate-500">SEI {String(l.processo.numero_sei ?? '—')} · {l.sigla}</p>
                </td>
                <td className="px-3 py-2">
                  <p>{ORIGENS.find((o) => o.valor === l.demanda!.origem)?.rotulo}</p>
                  <p className="text-xs text-slate-500">{String(l.demanda!.numero_processo_origem)} · {String(l.demanda!.comarca)}</p>
                </td>
                <td className="px-3 py-2">
                  <p>{l.escola}</p>
                  <p className="text-xs text-slate-500">{l.alunos.join(', ') || 'sem aluno'}</p>
                </td>
                {!filaAutorizacao && (
                  <td className="px-3 py-2">
                    {l.modelo ? <p>{String(l.modelo.ordem)}. {String(l.modelo.nome)}</p> : <p className="text-green-700">Cumprida</p>}
                    <p className="text-xs text-slate-500">{l.responsavel}</p>
                  </td>
                )}
                <td className={`px-3 py-2 whitespace-nowrap ${l.judicialVencido ? 'font-medium text-red-600' : ''}`}>
                  {formatarData(l.demanda!.prazo_judicial)}
                  {Boolean(l.demanda!.data_inicio_transporte) && <p className="text-xs font-normal text-green-700">transporte iniciado</p>}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-start gap-2">
                    <PontoSemaforo cor={l.semaforo.cor} />
                    <span className="text-xs leading-tight">
                      {l.semaforo.texto}
                      {l.semaforo.nivel > 0 && <span className="block font-medium text-orange-700">{ROTULO_NIVEL[l.semaforo.nivel]}</span>}
                    </span>
                  </span>
                </td>
                {filaAutorizacao && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <p className="font-medium">{l.valorMensal ? formatarMoeda(l.valorMensal * l.meses) : '—'}</p>
                    {l.valorMensal > 0 && <p className="text-xs text-slate-500">{formatarMoeda(l.valorMensal)}/mês × {l.meses} meses</p>}
                  </td>
                )}
                {codigo && !filaAutorizacao && (
                  <td className="px-3 py-2 text-xs">
                    {l.falta.length === 0 ? (
                      <span className="font-medium text-green-700">Pronta para concluir</span>
                    ) : (
                      <ul className="list-disc space-y-0.5 pl-4 text-amber-900">
                        {l.falta.slice(0, 3).map((x) => <li key={x}>{x}</li>)}
                        {l.falta.length > 3 && <li>+{l.falta.length - 3}</li>}
                      </ul>
                    )}
                  </td>
                )}
                {filaAutorizacao && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Botao
                      className="whitespace-nowrap"
                      disabled={!podeLiberar}
                      title={podeLiberar ? undefined : 'Só o perfil Subsecretário(a) autoriza.'}
                      onClick={() => setLiberando(l.demanda!.id)}
                    >
                      <CheckCircle2 size={16} /> AUTORIZAR PAF
                    </Botao>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma demanda nesta seleção.</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">{filtradas.length} de {linhas.length} demanda(s).</p>

      <Modal titulo="Autorizar PAF" aberto={liberando !== null} aoFechar={() => setLiberando(null)}>
        {(() => {
          const l = linhas.find((x) => x.demanda!.id === liberando)
          return l ? (
            <LiberacaoRapida
              key={l.demanda!.id}
              demanda={l.demanda!}
              codigo={String(l.processo.codigo)}
              valorSugerido={l.valorMensal}
              aoFechar={() => setLiberando(null)}
              aoConcluir={async () => {
                setLiberando(null)
                await recarregar()
              }}
            />
          ) : null
        })()}
      </Modal>

    </div>
  )
}
