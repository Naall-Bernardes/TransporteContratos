import { AlertTriangle, Download, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FAIXA, SeloVigencia } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { situacaoPrazoPrestacao, type FaixaVigencia } from '@/lib/contratos/calculos'
import { baixarArquivo, gerarCsv } from '@/lib/csv'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { ehCentral, podeEditarColecao } from '@/lib/permissoes'
import { INSTRUMENTO, TIPOS_INSTRUMENTO } from './configuracoes'
import { useGestaoContratual } from './useGestaoContratual'

type Filtro = 'todos' | 'ativos' | 'a_vencer' | 'vencido' | 'encerrado' | 'com_alerta' | 'prestacao_atrasada'

const ATIVAS: FaixaVigencia[] = ['vigente', 'nao_iniciado', 'ate_90', 'ate_60', 'ate_30']

function Cartao({ titulo, valor, detalhe, ativo, cor, onClick }: { titulo: string; valor: string | number; detalhe?: string; ativo?: boolean; cor?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left transition-shadow hover:shadow-sm ${ativo ? 'border-marca-600 ring-2 ring-marca-100' : 'border-slate-200'}`}
    >
      <p className={`text-2xl font-semibold tabular-nums ${cor ?? 'text-slate-900'}`}>{valor}</p>
      <p className="mt-1 text-sm text-slate-700">{titulo}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>}
    </button>
  )
}

export function ContratosPage() {
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, itens, recarregar, hoje } = useGestaoContratual()
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [tipo, setTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)

  /** Instrumentos com ao menos uma prestação de contas atrasada. */
  const comPrestacaoAtrasada = useMemo(
    () =>
      new Set(
        (dados.prestacoes_contas ?? [])
          .filter((p) => situacaoPrazoPrestacao(p, hoje) === 'vencida')
          .map((p) => p.instrumento_id as string),
      ),
    [dados, hoje],
  )

  const resumo = useMemo(() => {
    const ativos = itens.filter((i) => ATIVAS.includes(i.situacao.faixa))
    const conta = (f: FaixaVigencia) => itens.filter((i) => i.situacao.faixa === f).length
    return {
      ativos: ativos.length,
      ate30: conta('ate_30'),
      ate60: conta('ate_60'),
      ate90: conta('ate_90'),
      vencidos: conta('vencido'),
      encerrados: conta('encerrado'),
      comAlerta: itens.filter((i) => i.alertas.some((a) => a.nivel === 'critico')).length,
      prestacoesAtrasadas: (dados.prestacoes_contas ?? []).filter((p) => situacaoPrazoPrestacao(p, hoje) === 'vencida').length,
      valorAtual: ativos.reduce((s, i) => s + i.situacao.valor_atual, 0),
      executado: ativos.reduce((s, i) => s + i.situacao.valor_executado, 0),
      saldo: ativos.reduce((s, i) => s + i.situacao.saldo, 0),
    }
  }, [itens, dados, hoje])

  const linhas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return itens
      .filter((i) => {
        const f = i.situacao.faixa
        switch (filtro) {
          case 'ativos': return ATIVAS.includes(f)
          case 'a_vencer': return f === 'ate_30' || f === 'ate_60' || f === 'ate_90'
          case 'vencido': return f === 'vencido'
          case 'encerrado': return f === 'encerrado'
          case 'com_alerta': return i.alertas.some((a) => a.nivel === 'critico')
          case 'prestacao_atrasada': return comPrestacaoAtrasada.has(i.instrumento.id)
          default: return true
        }
      })
      .filter((i) => !tipo || i.instrumento.tipo === tipo)
      .filter((i) =>
        !termo ||
        [i.processo?.codigo, i.instrumento.numero, i.instrumento.numero_sei, i.contratante, i.contratado, i.sigla_sre, i.instrumento.objeto]
          .some((t) => String(t ?? '').toLocaleLowerCase('pt-BR').includes(termo)),
      )
      .sort((a, b) => a.situacao.dias_para_vencer - b.situacao.dias_para_vencer)
  }, [itens, filtro, tipo, busca, comPrestacaoAtrasada])

  function exportar() {
    const cab = ['Código único', 'Nº SEI', 'Tipo', 'Nº', 'SRE', 'Contratante', 'Contratado', 'Início', 'Fim vigência atual', 'Dias p/ vencer', 'Situação',
      'Valor original', 'Valor atual', 'Executado', 'Saldo', '% executado', 'Qtd aditivos', 'Alertas']
    const rot = (v: unknown) => TIPOS_INSTRUMENTO.find((t) => t.valor === v)?.rotulo ?? ''
    const num = (v: number) => v.toFixed(2).replace('.', ',')
    const csv = gerarCsv(cab, linhas.map((i) => [
      String(i.processo?.codigo ?? ''), String(i.instrumento.numero_sei), rot(i.instrumento.tipo), String(i.instrumento.numero), i.sigla_sre,
      i.contratante, i.contratado, formatarData(i.instrumento.vigencia_inicio), formatarData(i.situacao.vigencia_fim_atual),
      String(i.situacao.dias_para_vencer), FAIXA[i.situacao.faixa].rotulo, num(i.situacao.valor_original), num(i.situacao.valor_atual),
      num(i.situacao.valor_executado), num(i.situacao.saldo), num(i.situacao.pct_executado), String(i.situacao.qtd_aditivos),
      i.alertas.map((a) => a.texto).join(' | '),
    ]))
    baixarArquivo(`instrumentos_${hoje}.csv`, csv)
  }

  const f = (id: Filtro) => ({ ativo: filtro === id, onClick: () => setFiltro(filtro === id ? 'todos' : id) })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Gestão contratual</h1>
          <p className="mt-1 text-sm text-slate-600">
            Contratos Caixa Escolar × transportador e termos Estado × município.
            {!ehCentral(usuario) && ' Você vê apenas os instrumentos da sua regional.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={exportar} disabled={linhas.length === 0}>
            <Download size={16} /> Exportar CSV
          </Botao>
          {podeEditarColecao(usuario, 'instrumentos') && (
            <Botao onClick={() => setNovo(true)}>
              <Plus size={16} /> Novo instrumento
            </Botao>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo="Instrumentos ativos" valor={resumo.ativos} detalhe={`Saldo total ${formatarMoeda(resumo.saldo)}`} {...f('ativos')} />
        <Cartao
          titulo="A vencer (90 / 60 / 30 dias)"
          valor={resumo.ate90 + resumo.ate60 + resumo.ate30}
          detalhe={`${resumo.ate90} em até 90 · ${resumo.ate60} em até 60 · ${resumo.ate30} em até 30`}
          cor={resumo.ate30 ? 'text-orange-600' : undefined}
          {...f('a_vencer')}
        />
        <Cartao titulo="Vencidos sem encerramento" valor={resumo.vencidos} cor={resumo.vencidos ? 'text-red-600' : undefined} {...f('vencido')} />
        <Cartao titulo="Prestações de contas atrasadas" valor={resumo.prestacoesAtrasadas} cor={resumo.prestacoesAtrasadas ? 'text-red-600' : undefined} {...f('prestacao_atrasada')} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo="Com alerta crítico" valor={resumo.comAlerta} {...f('com_alerta')} />
        <Cartao titulo="Valor contratado (ativos)" valor={formatarMoeda(resumo.valorAtual)} />
        <Cartao
          titulo="Executado (ativos)"
          valor={formatarMoeda(resumo.executado)}
          detalhe={resumo.valorAtual ? `${((resumo.executado / resumo.valorAtual) * 100).toFixed(1)}% do contratado` : undefined}
        />
        <Cartao titulo="Encerrados" valor={resumo.encerrados} {...f('encerrado')} />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
          <input className="campo pl-9" placeholder="Código, nº, SEI, contratante, contratado…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        <select className="campo w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          <option value="contrato_caixa">Contratos (Judicial)</option>
          <option value="termo_pte">Termos (PTE)</option>
        </select>
        <select className="campo w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Situação">
          <option value="todos">Todas as situações</option>
          <option value="ativos">Ativos</option>
          <option value="a_vencer">A vencer (até 90 dias)</option>
          <option value="vencido">Vencidos</option>
          <option value="encerrado">Encerrados</option>
          <option value="com_alerta">Com alerta crítico</option>
          <option value="prestacao_atrasada">Com prestação atrasada</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Código / nº</th>
              <th className="px-3 py-2 font-medium">Partes</th>
              <th className="px-3 py-2 font-medium">SRE</th>
              <th className="px-3 py-2 font-medium">Vigência atual</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              <th className="px-3 py-2 text-right font-medium">Valor atual</th>
              <th className="px-3 py-2 font-medium">Executado</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2" aria-label="Alertas" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((i) => {
              const criticos = i.alertas.filter((a) => a.nivel === 'critico').length
              return (
                <tr key={i.instrumento.id} className="cursor-pointer hover:bg-marca-50" onClick={() => navegar(`/contratos/${i.instrumento.id}`)}>
                  <td className="px-3 py-2">
                    <p className="font-medium whitespace-nowrap text-marca-700">{String(i.processo?.codigo ?? '')}</p>
                    <p className="text-xs text-slate-500">
                      {i.instrumento.tipo === 'termo_pte' ? 'Termo' : 'Contrato'} {String(i.instrumento.numero)} · SEI {String(i.instrumento.numero_sei)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <p>{i.contratado}</p>
                    <p className="text-xs text-slate-500">{i.contratante}</p>
                  </td>
                  <td className="px-3 py-2">{i.sigla_sre}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatarData(i.instrumento.vigencia_inicio)} a {formatarData(i.situacao.vigencia_fim_atual)}
                    {i.situacao.qtd_aditivos > 0 && <p className="text-xs text-slate-500">{i.situacao.qtd_aditivos} aditivo(s)</p>}
                  </td>
                  <td className="px-3 py-2"><SeloVigencia faixa={i.situacao.faixa} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatarMoeda(i.situacao.valor_atual)}</td>
                  <td className="px-3 py-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100" title={`${i.situacao.pct_executado.toFixed(1)}%`}>
                      <div className="h-full bg-marca-600" style={{ width: `${Math.min(100, i.situacao.pct_executado)}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{i.situacao.pct_executado.toFixed(0)}%</p>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatarMoeda(i.situacao.saldo)}</td>
                  <td className="px-3 py-2">
                    {criticos > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600" title={i.alertas.map((a) => a.texto).join('\n')}>
                        <AlertTriangle size={14} /> {criticos}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhum instrumento nesta seleção.</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">{linhas.length} de {itens.length} instrumento(s). Clique numa linha para abrir.</p>

      <Modal titulo="Novo instrumento" aberto={novo} aoFechar={() => setNovo(false)}>
        {novo && (
          <FormularioRegistro
            config={INSTRUMENTO}
            registro={null}
            referencias={dados}
            aoCancelar={() => setNovo(false)}
            aoSalvar={async (r) => {
              setNovo(false)
              await recarregar()
              navegar(`/contratos/${r.id}`)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
