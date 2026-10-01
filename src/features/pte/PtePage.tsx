// PTE: termos de repasse do Estado aos municípios. O valor vem pré-determinado; o município
// contrata o transporte e informa contratos, frota, rotas, alunos, despesas e prestação de contas.

import { AlertTriangle, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SeloVigencia } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { conformidadeDoContexto, totalPendencias } from '@/lib/conformidade'
import { calcularSituacao, situacaoPrazoPrestacao } from '@/lib/contratos/calculos'
import { criarTermoRepasse, feriadosDe, type DadosTermoRepasse } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso, somarDiasUteis } from '@/lib/diasUteis'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { ehCentral, ehMunicipio } from '@/lib/permissoes'
import { TERMO_REPASSE } from './configuracoes'

type Filtro = '' | 'ativos' | 'pendencia_docs' | 'prestacao_atrasada' | 'despesa_sem_comprovacao' | 'encerrados'

function Cartao({ titulo, valor, detalhe, ativo, cor, onClick }: { titulo: string; valor: string | number; detalhe?: string; ativo?: boolean; cor?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`rounded-lg border bg-white p-4 text-left ${onClick ? 'transition-shadow hover:shadow-sm' : ''} ${ativo ? 'border-marca-600 ring-2 ring-marca-100' : 'border-slate-200'}`}>
      <p className={`text-2xl font-semibold tabular-nums ${cor ?? 'text-slate-900'}`}>{valor}</p>
      <p className="mt-1 text-sm text-slate-700">{titulo}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>}
    </Tag>
  )
}

export function PtePage() {
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, recarregar } = useTodos()
  const hoje = hojeIso()
  const central = ehCentral(usuario)
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [ano, setAno] = useState('')
  const [sre, setSre] = useState('')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)

  const linhas = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
    const feriados = feriadosDe(lista)
    return lista('adesoes_pte')
      .map((a) => {
        const termo = lista('instrumentos').find((i) => i.processo_id === a.processo_id && i.tipo === 'termo_pte')
        const parcelas = termo ? lista('parcelas').filter((p) => p.instrumento_id === termo.id) : []
        const s = termo ? calcularSituacao(termo, lista('aditivos').filter((x) => x.instrumento_id === termo.id), parcelas, hoje) : undefined
        const contratos = lista('contratacoes_municipais').filter((c) => c.adesao_id === a.id)
        const conformidade = contratos.flatMap((c) => conformidadeDoContexto(lista, { contratacao_id: c.id }, hoje))
        const despesas = lista('despesas_pte').filter((x) => x.adesao_id === a.id)
        const prestacoes = termo ? lista('prestacoes_contas').filter((p) => p.instrumento_id === termo.id) : []
        return {
          adesao: a,
          termo,
          s,
          municipio: achar('municipios', a.municipio_id),
          sigla: String(achar('sres', a.sre_id)?.sigla ?? ''),
          ano: String(achar('ciclos_pte', a.ciclo_id)?.ano ?? ''),
          codigo: String(achar('processos', a.processo_id)?.codigo ?? ''),
          contratos: contratos.filter((c) => c.tipo === 'terceirizado').length,
          frotaPropria: contratos.some((c) => c.tipo === 'frota_propria'),
          pendDocs: totalPendencias(conformidade),
          gasto: despesas.reduce((t, x) => t + Number(x.valor || 0), 0),
          semComprovacao: despesas.filter((x) => !x.data_comprovacao && somarDiasUteis(String(x.data_transacao), 30, feriados) < hoje).length,
          alunos: lista('pte_alunos').filter((x) => x.adesao_id === a.id && x.ativo !== false).length,
          prestacao: prestacoes.find((p) => !['aprovada', 'aprovada_ressalvas', 'reprovada'].includes(String(p.status))) ?? prestacoes.at(-1),
          prestacaoAtrasada: prestacoes.some((p) => situacaoPrazoPrestacao(p, hoje) === 'vencida'),
          encerrado: a.status === 'encerrado' || termo?.status === 'encerrado',
        }
      })
      .sort((x, y) => Number(y.ano) - Number(x.ano) || String(x.municipio?.nome).localeCompare(String(y.municipio?.nome), 'pt-BR'))
  }, [dados, hoje])

  const ativos = linhas.filter((l) => !l.encerrado)
  const soma = (f: (l: (typeof linhas)[number]) => number) => ativos.reduce((t, l) => t + f(l), 0)
  const anos = [...new Set(linhas.map((l) => l.ano))].sort().reverse()
  const filtradas = linhas
    .filter((l) => {
      switch (filtro) {
        case 'ativos': return !l.encerrado
        case 'encerrados': return l.encerrado
        case 'pendencia_docs': return l.pendDocs > 0
        case 'prestacao_atrasada': return l.prestacaoAtrasada
        case 'despesa_sem_comprovacao': return l.semComprovacao > 0
        default: return true
      }
    })
    .filter((l) => !ano || l.ano === ano)
    .filter((l) => !sre || l.adesao.sre_id === sre)
    .filter((l) => {
      const t = busca.trim().toLocaleLowerCase('pt-BR')
      return !t || [l.codigo, l.termo?.numero, l.termo?.numero_sei, l.municipio?.nome, l.sigla].some((x) => String(x ?? '').toLocaleLowerCase('pt-BR').includes(t))
    })
  const f = (id: Filtro) => ({ ativo: filtro === id, onClick: () => setFiltro(filtro === id ? '' : id) })
  const repassado = soma((l) => l.s?.valor_executado ?? 0)
  const valor = soma((l) => l.s?.valor_atual ?? 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Programa Estadual de Transporte Escolar (PTE)</h1>
          <p className="mt-1 text-sm text-slate-600">
            {ehMunicipio(usuario)
              ? 'Termos de repasse do seu município. Informe os contratos, a frota, as rotas, os alunos atendidos, as despesas e a prestação de contas.'
              : 'Termos de repasse aos municípios. O Estado repassa o valor pré-determinado; o município contrata o transporte e informa a execução.'}
          </p>
        </div>
        {central && <Botao onClick={() => setNovo(true)}><Plus size={16} /> Novo termo de repasse</Botao>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo="Termos ativos" valor={ativos.length} detalhe={`${ativos.filter((l) => l.contratos > 0 || l.frotaPropria).length} com contrato ou frota informada`} {...f('ativos')} />
        <Cartao titulo="Valor dos repasses (ativos)" valor={formatarMoeda(valor)} detalhe={`Repassado ${formatarMoeda(repassado)}${valor ? ` (${((repassado / valor) * 100).toFixed(0)}%)` : ''}`} />
        <Cartao titulo="Gasto informado pelos municípios" valor={formatarMoeda(soma((l) => l.gasto))} detalhe={repassado ? `${((soma((l) => l.gasto) / repassado) * 100).toFixed(0)}% do repassado` : undefined} />
        <Cartao titulo="Encerrados" valor={linhas.length - ativos.length} {...f('encerrados')} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Cartao titulo="Com documentos da frota pendentes" valor={linhas.filter((l) => l.pendDocs > 0).length} cor={linhas.some((l) => l.pendDocs > 0) ? 'text-red-600' : undefined} {...f('pendencia_docs')} />
        <Cartao titulo="Despesas sem comprovação (> 30 dias úteis)" valor={linhas.reduce((t, l) => t + l.semComprovacao, 0)} cor={linhas.some((l) => l.semComprovacao) ? 'text-red-600' : undefined} {...f('despesa_sem_comprovacao')} />
        <Cartao titulo="Prestações de contas atrasadas" valor={linhas.filter((l) => l.prestacaoAtrasada).length} cor={linhas.some((l) => l.prestacaoAtrasada) ? 'text-red-600' : undefined} {...f('prestacao_atrasada')} />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
          <input className="campo pl-9" placeholder="Código, nº do termo, SEI, município…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        <select className="campo w-auto" value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano">
          <option value="">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {central && (
          <select className="campo w-auto" value={sre} onChange={(e) => setSre(e.target.value)} aria-label="SRE">
            <option value="">Todas as SREs</option>
            {(dados.sres ?? []).map((x) => <option key={x.id} value={x.id}>{String(x.sigla)}</option>)}
          </select>
        )}
        <select className="campo w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="ativos">Ativos</option>
          <option value="encerrados">Encerrados</option>
          <option value="pendencia_docs">Com documentos da frota pendentes</option>
          <option value="despesa_sem_comprovacao">Com despesa sem comprovação</option>
          <option value="prestacao_atrasada">Com prestação atrasada</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Termo</th>
              <th className="px-3 py-2 font-medium">Município</th>
              <th className="px-3 py-2 font-medium">Vigência</th>
              <th className="px-3 py-2 text-right font-medium">Repasse</th>
              <th className="px-3 py-2 font-medium">Repassado</th>
              <th className="px-3 py-2 text-right font-medium">Gasto pelo município</th>
              <th className="px-3 py-2 font-medium">Contratos e frota</th>
              <th className="px-3 py-2 font-medium">Prestação de contas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((l) => (
              <tr key={l.adesao.id} className="cursor-pointer hover:bg-marca-50" onClick={() => navegar(`/pte/adesoes/${l.adesao.id}`)}>
                <td className="px-3 py-2">
                  <p className="font-medium whitespace-nowrap text-marca-700">{l.termo ? String(l.termo.numero) : 'sem termo'}</p>
                  <p className="text-xs text-slate-500">{l.codigo} · {l.ano}</p>
                </td>
                <td className="px-3 py-2">
                  <p>{String(l.municipio?.nome ?? '')}</p>
                  <p className="text-xs text-slate-500">{l.sigla} · {l.alunos} aluno(s)</p>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {l.termo ? <>{formatarData(l.termo.vigencia_inicio)} a {formatarData(l.s?.vigencia_fim_atual)}</> : '—'}
                  {l.s && <div className="mt-0.5"><SeloVigencia faixa={l.s.faixa} /></div>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{l.s ? formatarMoeda(l.s.valor_atual) : '—'}</td>
                <td className="px-3 py-2">
                  {l.s && (
                    <>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-marca-600" style={{ width: `${Math.min(100, l.s.pct_executado)}%` }} /></div>
                      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{formatarMoeda(l.s.valor_executado)} · {l.s.pct_executado.toFixed(0)}%</p>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {formatarMoeda(l.gasto)}
                  {l.semComprovacao > 0 && <p className="text-xs text-red-600">{l.semComprovacao} sem comprovação</p>}
                </td>
                <td className="px-3 py-2">
                  <p>{l.contratos} contrato(s){l.frotaPropria ? ' + frota própria' : ''}</p>
                  {l.pendDocs > 0 ? (
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle size={12} /> {l.pendDocs} documento(s) pendente(s)</p>
                  ) : (
                    l.contratos + Number(l.frotaPropria) > 0 && <p className="text-xs text-green-700">documentos em dia</p>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {l.prestacao ? (
                    <>
                      <p>{String(l.prestacao.periodo_referencia)}</p>
                      <p className={l.prestacaoAtrasada ? 'font-medium text-red-600' : 'text-slate-500'}>{String(l.prestacao.status).replace('_', ' ')} · até {formatarData(l.prestacao.data_limite)}</p>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhum termo nesta seleção.</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">{filtradas.length} de {linhas.length} termo(s). Clique numa linha para abrir.</p>

      <Modal titulo="Novo termo de repasse" aberto={novo} aoFechar={() => setNovo(false)}>
        {novo && (
          <FormularioRegistro
            config={TERMO_REPASSE}
            registro={null}
            referencias={dados}
            valoresPadrao={{ ano: Number(hoje.slice(0, 4)) + 1, num_parcelas: 10, data_assinatura: hoje, gestor_id: usuario.id, fiscal_id: usuario.id }}
            acao={(v) => criarTermoRepasse(usuario, v as unknown as DadosTermoRepasse)}
            rotuloSalvar="Cadastrar termo"
            aoCancelar={() => setNovo(false)}
            aoSalvar={async (r) => {
              setNovo(false)
              await recarregar()
              navegar(`/pte/adesoes/${r.id}`)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
