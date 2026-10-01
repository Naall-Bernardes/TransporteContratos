import { FilePlus2, Mail, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PontoSemaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { feriadosDe } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { formatarData } from '@/lib/formatacao'
import { situacaoDosProcessos } from '@/lib/monitoramento'
import { ehCentral } from '@/lib/permissoes'
import { SITUACOES_DEMANDA } from './configuracoes'
import { IniciarContratacao } from './IniciarContratacao'

/** Primeira tela de Contratações: cadastro (a partir de um ofício de intimação) e todos os processos já cadastrados. */
export function NovaContratacaoPage() {
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, recarregar } = useTodos()
  const hoje = hojeIso()
  const central = ehCentral(usuario)
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [cadastrando, setCadastrando] = useState(false)
  const [oficioId, setOficioId] = useState('')
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)

  const linhas = useMemo(() => {
    const l = (c: Colecao) => dados[c] ?? []
    return situacaoDosProcessos(l, hoje, feriadosDe(l))
      .filter((s) => s.demanda)
      .map((s) => {
        const oficio = l('oficios').filter((o) => o.demanda_id === s.demanda!.id && o.tipo === 'intimacao_cumprimento').sort((a, b) => String(a.data_recebimento).localeCompare(String(b.data_recebimento)))[0]
        return {
          ...s,
          oficio,
          codigoOficio: String(l('processos').find((p) => p.id === oficio?.processo_id)?.codigo ?? ''),
          escola: String(l('escolas').find((e) => e.id === s.demanda!.escola_id)?.nome ?? ''),
          sigla: String(l('sres').find((x) => x.id === s.sre_id)?.sigla ?? ''),
          // cadastro = início da primeira etapa (Caracterização)
          cadastradoEm: String(l('processo_etapas').filter((e) => e.processo_id === s.processo.id).map((e) => String(e.iniciada_em)).sort()[0] ?? String(s.processo.criado_em).slice(0, 10)),
          alunos: l('demanda_alunos').filter((a) => a.demanda_id === s.demanda!.id && !a.removido_em).length,
        }
      })
      .sort((a, b) => b.cadastradoEm.localeCompare(a.cadastradoEm))
  }, [dados, hoje])

  const pendentes = lista('oficios').filter((o) => o.tipo === 'intimacao_cumprimento' && !o.demanda_id).sort((a, b) => String(a.prazo_resposta).localeCompare(String(b.prazo_resposta)))
  const oficio = pendentes.find((o) => o.id === oficioId)

  const filtradas = linhas
    .filter((l) => !situacao || l.demanda!.situacao === situacao)
    .filter((l) => {
      const t = busca.trim().toLocaleLowerCase('pt-BR')
      return !t || [l.processo.codigo, l.processo.numero_sei, l.codigoOficio, l.demanda!.numero_processo_origem, l.demanda!.comarca, l.escola, l.sigla].some((x) => String(x ?? '').toLocaleLowerCase('pt-BR').includes(t))
    })

  function fechar() {
    setCadastrando(false)
    setOficioId('')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cadastro</h1>
          <p className="mt-1 text-sm text-slate-600">Contratações cadastradas a partir dos ofícios de intimação, com a situação de cada processo.</p>
        </div>
        {central && (
          <Botao onClick={() => setCadastrando(true)}>
            <FilePlus2 size={16} /> Cadastrar contratação
            {pendentes.length > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs">{pendentes.length}</span>}
          </Botao>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
          <input className="campo pl-9" placeholder="Código, SEI, ofício, processo, comarca, escola…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        <select className="campo w-auto" value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação">
          <option value="">Todas as situações</option>
          {SITUACOES_DEMANDA.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Processo</th>
              <th className="px-3 py-2 font-medium">Nº processo SEI</th>
              <th className="px-3 py-2 font-medium">Ofício de origem</th>
              <th className="px-3 py-2 font-medium">Processo judicial</th>
              <th className="px-3 py-2 font-medium">Escola</th>
              <th className="px-3 py-2 font-medium">Cadastrado em</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((l) => (
              <tr key={l.demanda!.id} className="cursor-pointer hover:bg-marca-50" onClick={() => navegar(`/judicial/${l.demanda!.id}`)}>
                <td className="px-3 py-2">
                  <p className="font-medium whitespace-nowrap text-marca-700">{String(l.processo.codigo)}</p>
                  <p className="text-xs text-slate-500">{l.sigla}</p>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{String(l.processo.numero_sei ?? '—')}</td>
                <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {l.oficio ? <Link to={`/oficios/${l.oficio.id}`} className="text-marca-700 hover:underline">{l.codigoOficio}</Link> : <span className="text-slate-400">—</span>}
                  {l.oficio && <p className="text-xs text-slate-500">nº {String(l.oficio.numero)}</p>}
                </td>
                <td className="px-3 py-2">
                  <p>{String(l.demanda!.numero_processo_origem)}</p>
                  <p className="text-xs text-slate-500">{String(l.demanda!.comarca)}</p>
                </td>
                <td className="px-3 py-2">
                  <p>{l.escola}</p>
                  <p className="text-xs text-slate-500">{l.alunos} aluno(s)</p>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatarData(l.cadastradoEm)}</td>
                <td className="px-3 py-2">
                  {l.demanda!.situacao === 'ativa' && l.modelo ? (
                    <span className="flex items-start gap-2">
                      <PontoSemaforo cor={l.semaforo.cor} />
                      <span className="leading-tight">
                        {String(l.modelo.ordem)}. {String(l.modelo.nome)}
                        <span className="block text-xs text-slate-500">{l.semaforo.texto}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">{SITUACOES_DEMANDA.find((o) => o.valor === l.demanda!.situacao)?.rotulo ?? String(l.demanda!.situacao)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma contratação cadastrada nesta seleção.</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">{filtradas.length} de {linhas.length} contratação(ões).</p>

      <Modal titulo="Cadastrar contratação" aberto={cadastrando} aoFechar={fechar}>
        {cadastrando && (
          <div className="space-y-3 text-sm">
            {pendentes.length === 0 ? (
              <p className="text-slate-600">
                Nenhum ofício de intimação aguardando cadastro. Cadastre o ofício primeiro em{' '}
                <Link to="/oficios" className="inline-flex items-center gap-1 text-marca-700 hover:underline"><Mail size={14} /> Ofícios</Link>.
              </p>
            ) : (
              <label className="block">
                <span className="text-xs text-slate-600">Ofício de intimação *</span>
                <select className="campo mt-1" value={oficioId} onChange={(e) => setOficioId(e.target.value)}>
                  <option value="">Escolha o ofício…</option>
                  {pendentes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {String(achar('processos', o.processo_id)?.codigo ?? '')} · nº {String(o.numero)} · {String(o.numero_processo_judicial ?? '')} · {String(achar('escolas', o.escola_id)?.nome ?? 'sem escola')} · prazo {formatarData(o.prazo_resposta)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {oficio && (
              <>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                  Do ofício vêm: processo judicial <strong>{String(oficio.numero_processo_judicial ?? '')}</strong>, comarca {String(oficio.comarca ?? '')}, órgão, data de recebimento e nº SEI.
                </p>
                <IniciarContratacao
                  key={String(oficio.id)}
                  oficio={oficio}
                  dados={dados}
                  aoCancelar={fechar}
                  aoCriar={async (r) => {
                    fechar()
                    await recarregar()
                    navegar(`/judicial/${r.id}`)
                  }}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
