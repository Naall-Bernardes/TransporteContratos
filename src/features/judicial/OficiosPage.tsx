import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cartao } from '@/components/comum/Cartao'
import { PontoSemaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { criarOficio, feriadosDe } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { formatarData } from '@/lib/formatacao'
import { ROTULO_SITUACAO_OFICIO, situacaoDosOficios, type SituacaoOficio } from '@/lib/judicial/oficios'
import { ehCentral } from '@/lib/permissoes'
import { OFICIO, ORGAOS_OFICIO, TIPOS_OFICIO } from './configuracoes'

type Filtro = '' | 'pendentes' | SituacaoOficio | 'vencidos' | 'amarelo'

const COR_SITUACAO: Record<SituacaoOficio, string> = {
  aguardando_analise: 'bg-slate-100 text-slate-700',
  aguardando_sre: 'bg-amber-100 text-amber-800',
  informacao_recebida: 'bg-sky-100 text-sky-800',
  respondido: 'bg-green-100 text-green-800',
}

/** Controle de todos os ofícios que chegam e precisam ser respondidos. */
export function OficiosPage() {
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, recarregar } = useTodos()
  const hoje = hojeIso()
  const central = ehCentral(usuario)
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [tipo, setTipo] = useState('')
  const [orgao, setOrgao] = useState('')
  const [sre, setSre] = useState('')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)

  const linhas = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    return situacaoDosOficios(lista, hoje, feriadosDe(lista)).map((l) => ({
      ...l,
      sigla: String(lista('sres').find((s) => s.id === l.oficio.sre_id)?.sigla ?? ''),
      escola: String(lista('escolas').find((e) => e.id === l.oficio.escola_id)?.nome ?? ''),
      responsavel: String(lista('usuarios').find((u) => u.id === l.oficio.responsavel_id)?.nome ?? ''),
      cumprimento: lista('processos').find((p) => p.id === lista('demandas').find((d) => d.id === l.oficio.demanda_id)?.processo_id),
    }))
  }, [dados, hoje])

  const conta = (f: (l: (typeof linhas)[number]) => boolean) => linhas.filter(f).length
  const pendente = (l: (typeof linhas)[number]) => l.situacao !== 'respondido'
  const filtradas = linhas
    .filter((l) => {
      switch (filtro) {
        case 'pendentes': return pendente(l)
        case 'vencidos': return l.vencido
        case 'amarelo': return pendente(l) && l.semaforo.cor === 'amarelo'
        case '': return true
        default: return l.situacao === filtro
      }
    })
    .filter((l) => !tipo || l.oficio.tipo === tipo)
    .filter((l) => !orgao || l.oficio.orgao_tipo === orgao)
    .filter((l) => !sre || l.oficio.sre_id === sre)
    .filter((l) => {
      const t = busca.trim().toLocaleLowerCase('pt-BR')
      return !t || [l.processo?.codigo, l.processo?.numero_sei, l.oficio.numero_sei, l.oficio.numero, l.oficio.numero_processo_judicial, l.oficio.comarca, l.oficio.orgao_nome, l.oficio.assunto, l.escola, l.responsavel].some((x) => String(x ?? '').toLocaleLowerCase('pt-BR').includes(t))
    })
    .sort((a, b) => Number(a.situacao === 'respondido') - Number(b.situacao === 'respondido') || String(a.oficio.prazo_resposta).localeCompare(String(b.oficio.prazo_resposta)))

  const f = (id: Filtro) => ({ ativo: filtro === id, onClick: () => setFiltro(filtro === id ? '' : id) })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ofícios</h1>
          <p className="mt-1 text-sm text-slate-600">
            {central
              ? 'Todos os ofícios recebidos que precisam de resposta. Semáforo = prazo de resposta, em dias úteis.'
              : 'Ofícios encaminhados à sua SRE para prestar informação ao órgão central.'}
          </p>
        </div>
        {central && <Botao onClick={() => setNovo(true)}><Plus size={16} /> Novo ofício</Botao>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Cartao titulo="Pendentes de resposta" valor={conta(pendente)} {...f('pendentes')} />
        <Cartao titulo="Aguardando análise" valor={conta((l) => l.situacao === 'aguardando_analise')} {...f('aguardando_analise')} />
        <Cartao titulo="Aguardando SRE" valor={conta((l) => l.situacao === 'aguardando_sre')} cor="text-amber-600" {...f('aguardando_sre')} />
        <Cartao titulo="Informação recebida" valor={conta((l) => l.situacao === 'informacao_recebida')} cor="text-sky-700" {...f('informacao_recebida')} />
        <Cartao titulo="Prazo vencido" valor={conta((l) => l.vencido)} cor="text-red-600" {...f('vencidos')} />
        <Cartao titulo="Respondidos" valor={conta((l) => l.situacao === 'respondido')} cor="text-green-700" {...f('respondido')} />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
          <input className="campo pl-9" placeholder="Código, nº, SEI, processo, comarca, assunto, responsável…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        <select className="campo w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {TIPOS_OFICIO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        <select className="campo w-auto" value={orgao} onChange={(e) => setOrgao(e.target.value)} aria-label="Órgão">
          <option value="">Todos os órgãos</option>
          {ORGAOS_OFICIO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        {central && (
          <select className="campo w-auto" value={sre} onChange={(e) => setSre(e.target.value)} aria-label="SRE">
            <option value="">Todas as SREs</option>
            {(dados.sres ?? []).map((s) => <option key={s.id} value={s.id}>{String(s.sigla)}</option>)}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Código / nº</th>
              <th className="px-3 py-2 font-medium">Nº processo SEI</th>
              <th className="px-3 py-2 font-medium">Órgão</th>
              <th className="px-3 py-2 font-medium">Assunto</th>
              <th className="px-3 py-2 font-medium">Recebido</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              <th className="px-3 py-2 font-medium">Responsável</th>
              <th className="px-3 py-2 font-medium">Prazo de resposta</th>
              <th className="px-3 py-2 font-medium">Data de conclusão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((l) => (
              <tr key={l.oficio.id} className="cursor-pointer hover:bg-marca-50" onClick={() => navegar(`/oficios/${l.oficio.id}`)}>
                <td className="px-3 py-2">
                  <p className="font-medium whitespace-nowrap text-marca-700">{String(l.processo?.codigo ?? '')}</p>
                  <p className="text-xs text-slate-500">nº {String(l.oficio.numero)}{l.sigla ? ` · ${l.sigla}` : ''}</p>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{String(l.oficio.numero_sei || l.processo?.numero_sei || '—')}</td>
                <td className="px-3 py-2">
                  <p>{ORGAOS_OFICIO.find((o) => o.valor === l.oficio.orgao_tipo)?.rotulo}</p>
                  <p className="text-xs text-slate-500">{String(l.oficio.orgao_nome ?? '')}{l.oficio.comarca ? ` · ${l.oficio.comarca}` : ''}</p>
                </td>
                <td className="max-w-md px-3 py-2">
                  <p className="text-xs font-medium text-slate-500">{TIPOS_OFICIO.find((o) => o.valor === l.oficio.tipo)?.rotulo}</p>
                  <p className="line-clamp-2">{String(l.oficio.assunto ?? '')}</p>
                  {l.cumprimento && <p className="text-xs text-marca-700">Contratação {String(l.cumprimento.codigo)}</p>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatarData(l.oficio.data_recebimento)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${COR_SITUACAO[l.situacao]}`}>{ROTULO_SITUACAO_OFICIO[l.situacao]}</span>
                  {l.consultaPendente && <p className="mt-1 text-xs text-slate-500">SRE até {formatarData(l.consultaPendente.prazo)}</p>}
                </td>
                <td className="px-3 py-2">
                  {l.responsavel || '—'}
                  {l.situacao === 'aguardando_sre' && <p className="text-xs text-amber-700">informação com a SRE {l.sigla}</p>}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-start gap-2">
                    <PontoSemaforo cor={l.semaforo.cor} />
                    <span className="text-xs leading-tight">
                      <span className="block font-medium">{formatarData(l.oficio.prazo_resposta)}</span>
                      {l.situacao !== 'respondido' && l.semaforo.texto}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {l.oficio.resposta_data ? (
                    <span className={String(l.oficio.resposta_data) > String(l.oficio.prazo_resposta) ? 'text-red-600' : 'text-green-700'}>{formatarData(l.oficio.resposta_data)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhum ofício nesta seleção.</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">{filtradas.length} de {linhas.length} ofício(s).</p>

      <Modal titulo="Novo ofício recebido" aberto={novo} aoFechar={() => setNovo(false)}>
        {novo && (
          <FormularioRegistro
            config={OFICIO}
            registro={null}
            referencias={dados}
            valoresPadrao={{ data_recebimento: hoje, responsavel_id: usuario.id }}
            acao={(v) => criarOficio(usuario, v)}
            rotuloSalvar="Cadastrar ofício"
            aoCancelar={() => setNovo(false)}
            aoSalvar={async (r) => {
              setNovo(false)
              await recarregar()
              navegar(`/oficios/${r.id}`)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
