import { ArrowRight, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Cartao } from '@/components/comum/Cartao'
import { PontoSemaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { ErroPermissao, ErroRegra, ErroValidacao, salvar } from '@/lib/dados/repositorio'
import { criarOficio, feriadosDe } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { formatarData } from '@/lib/formatacao'
import { ROTULO_SITUACAO_OFICIO, situacaoDosOficios, type SituacaoOficio } from '@/lib/judicial/oficios'
import { ehCentral } from '@/lib/permissoes'
import { OFICIO, ORGAOS_OFICIO, TIPOS_OFICIO } from './configuracoes'

/** Tipo do ofício: cor e nome curto para a coluna. Intimação para cumprimento de sentença vai para Contratações. */
const COR_TIPO: Record<string, string> = {
  intimacao_cumprimento: 'bg-violet-100 text-violet-800',
  pedido_informacao: 'bg-sky-100 text-sky-800',
  reiteracao: 'bg-orange-100 text-orange-800',
  outro: 'bg-slate-100 text-slate-700',
}
const ROTULO_TIPO_CURTO: Record<string, string> = {
  intimacao_cumprimento: 'Cumprimento de sentença',
  pedido_informacao: 'Pedido de informação',
  reiteracao: 'Reiteração / cobrança',
  outro: 'Outro',
}

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
  // A regional abre direto nos ofícios que aguardam a resposta dela
  const [filtro, setFiltro] = useState<Filtro>(ehCentral(usuario) ? 'pendentes' : 'aguardando_sre')
  const [tipo, setTipo] = useState('')
  const [orgao, setOrgao] = useState('')
  const [sre, setSre] = useState('')
  const [busca, setBusca] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [sei, setSei] = useState('')
  const [unidade, setUnidade] = useState('')
  const [erro, setErro] = useState<string | null>(null)
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
    .filter((l) => !responsavel || (responsavel === '__nenhum__' ? !l.oficio.responsavel_id : l.oficio.responsavel_id === responsavel))
    .filter((l) => !unidade || l.oficio.orgao_nome === unidade)
    .filter((l) => {
      const t = sei.replace(/\D/g, '')
      return !t || String(l.oficio.numero_sei || l.processo?.numero_sei || '').replace(/\D/g, '').includes(t)
    })
    .filter((l) => {
      const t = busca.trim().toLocaleLowerCase('pt-BR')
      return !t || [l.processo?.codigo, l.processo?.numero_sei, l.oficio.numero_sei, l.oficio.numero, l.oficio.numero_processo_judicial, l.oficio.comarca, l.oficio.orgao_nome, l.oficio.assunto, l.escola, l.responsavel].some((x) => String(x ?? '').toLocaleLowerCase('pt-BR').includes(t))
    })
    .sort((a, b) => Number(a.situacao === 'respondido') - Number(b.situacao === 'respondido') || String(a.oficio.prazo_resposta).localeCompare(String(b.oficio.prazo_resposta)))

  const f = (id: Filtro) => ({ ativo: filtro === id, onClick: () => setFiltro(filtro === id ? '' : id) })
  const responsaveis = (dados.usuarios ?? []).filter((u) => u.ativo !== false && (u.papel === 'analista_central' || u.papel === 'admin')).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
  const unidades = [...new Set(linhas.map((l) => String(l.oficio.orgao_nome ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const temFiltro = filtro !== 'pendentes' || tipo || orgao || sre || busca || responsavel || sei || unidade
  function limpar() {
    setFiltro('pendentes'); setTipo(''); setOrgao(''); setSre(''); setBusca(''); setResponsavel(''); setSei(''); setUnidade('')
  }
  async function atribuir(oficioId: string, responsavelId: string) {
    setErro(null)
    try {
      await salvar('oficios', { id: oficioId, responsavel_id: responsavelId || null }, usuario)
      await recarregar()
    } catch (e) {
      if (e instanceof ErroValidacao || e instanceof ErroRegra || e instanceof ErroPermissao) setErro(e.message)
      else throw e
    }
  }

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

      <div className="mt-6 mb-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <label className="block sm:col-span-2">
            <span className="text-xs text-slate-600">Buscar</span>
            <span className="relative mt-1 block">
              <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
              <input className="campo pl-9" placeholder="Código, nº, processo, comarca, assunto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </span>
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Nº SEI</span>
            <input className="campo mt-1" placeholder="Parte do número" value={sei} onChange={(e) => setSei(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Situação</span>
            <select className="campo mt-1" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
              <option value="">Todas</option>
              <option value="pendentes">Pendentes de resposta</option>
              {(Object.keys(ROTULO_SITUACAO_OFICIO) as SituacaoOficio[]).map((k) => <option key={k} value={k}>{ROTULO_SITUACAO_OFICIO[k]}</option>)}
              <option value="vencidos">Prazo vencido</option>
              <option value="amarelo">A vencer (até 3 dias úteis)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Responsável</span>
            <select className="campo mt-1" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Todos</option>
              <option value="__nenhum__">Sem responsável</option>
              {responsaveis.map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Órgão</span>
            <select className="campo mt-1" value={orgao} onChange={(e) => setOrgao(e.target.value)}>
              <option value="">Todos</option>
              {ORGAOS_OFICIO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Vara / unidade</span>
            <select className="campo mt-1" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              <option value="">Todas</option>
              {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Tipo</span>
            <select className="campo mt-1" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPOS_OFICIO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </select>
          </label>
          {central && (
            <label className="block">
              <span className="text-xs text-slate-600">SRE</span>
              <select className="campo mt-1" value={sre} onChange={(e) => setSre(e.target.value)}>
                <option value="">Todas</option>
                {(dados.sres ?? []).map((sr) => <option key={sr.id} value={sr.id}>{String(sr.sigla)}</option>)}
              </select>
            </label>
          )}
        </div>
        {temFiltro && <button className="mt-2 text-xs text-marca-700 hover:underline" onClick={limpar}>Limpar filtros</button>}
      </div>

      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Código / nº</th>
              <th className="px-3 py-2 font-medium">Nº processo SEI</th>
              <th className="px-3 py-2 font-medium">Tipo / destino</th>
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
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${COR_TIPO[String(l.oficio.tipo)] ?? COR_TIPO.outro}`}>{ROTULO_TIPO_CURTO[String(l.oficio.tipo)] ?? String(l.oficio.tipo)}</span>
                  {l.oficio.tipo === 'intimacao_cumprimento' ? (
                    l.cumprimento ? (
                      <Link to={`/judicial/${l.oficio.demanda_id}`} className="mt-1 flex items-center gap-1 text-xs whitespace-nowrap text-marca-700 hover:underline"><ArrowRight size={12} /> Contratações · {String(l.cumprimento.codigo)}</Link>
                    ) : central ? (
                      <Link to={`/judicial/novo/cadastrar?oficio=${l.oficio.id}`} className="mt-1 flex items-center gap-1 text-xs font-medium whitespace-nowrap text-amber-700 hover:underline"><ArrowRight size={12} /> Enviar para Contratações</Link>
                    ) : (
                      <p className="mt-1 text-xs whitespace-nowrap text-amber-700">Aguardando ir para Contratações</p>
                    )
                  ) : l.cumprimento ? (
                    <Link to={`/judicial/${l.oficio.demanda_id}`} className="mt-1 block text-xs whitespace-nowrap text-slate-500 hover:underline">ligado a {String(l.cumprimento.codigo)}</Link>
                  ) : (
                    <p className="mt-1 text-xs whitespace-nowrap text-slate-500">Resposta ao órgão</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <p>{ORGAOS_OFICIO.find((o) => o.valor === l.oficio.orgao_tipo)?.rotulo}</p>
                  <p className="text-xs text-slate-500">{String(l.oficio.orgao_nome ?? '')}{l.oficio.comarca ? ` · ${l.oficio.comarca}` : ''}</p>
                </td>
                <td className="max-w-md px-3 py-2">
                  <p className="line-clamp-2">{String(l.oficio.assunto ?? '')}</p>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatarData(l.oficio.data_recebimento)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${COR_SITUACAO[l.situacao]}`}>{ROTULO_SITUACAO_OFICIO[l.situacao]}</span>
                  {l.consultaPendente && <p className="mt-1 text-xs text-slate-500">SRE até {formatarData(l.consultaPendente.prazo)}</p>}
                </td>
                <td className="px-3 py-2" onClick={(e) => central && e.stopPropagation()}>
                  {central ? (
                    <select
                      className={`campo w-44 py-1 text-xs ${l.oficio.responsavel_id ? '' : 'border-amber-300 bg-amber-50'}`}
                      value={String(l.oficio.responsavel_id ?? '')}
                      onChange={(e) => atribuir(l.oficio.id, e.target.value)}
                      aria-label="Atribuir responsável"
                    >
                      <option value="">Atribuir…</option>
                      {responsaveis.map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
                    </select>
                  ) : (
                    l.responsavel || '—'
                  )}
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
