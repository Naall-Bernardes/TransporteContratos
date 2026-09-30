import { CheckCircle2, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cartao } from '@/components/comum/Cartao'
import { ImportarCsv } from '@/components/comum/ImportarCsv'
import { PontoSemaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { ErroPermissao, ErroRegra } from '@/lib/dados/repositorio'
import { aprovarCiclo, calcularAdesao, criarAdesao, feriadosDe, importarSimade } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { situacaoDosProcessos } from '@/lib/monitoramento'
import { ehCentral } from '@/lib/permissoes'
import { ADESAO, CICLO, STATUS_ADESAO, STATUS_CICLO } from './configuracoes'

export function PtePage() {
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, recarregar } = useTodos()
  const hoje = hojeIso()
  const ciclos = [...(dados.ciclos_pte ?? [])].sort((a, b) => Number(b.ano) - Number(a.ano))
  const [cicloId, setCicloId] = useState<string | null>(null)
  const ciclo = ciclos.find((c) => c.id === cicloId) ?? ciclos.find((c) => c.status !== 'encerrado' && !c.aprovado_em) ?? ciclos[0]
  const [modal, setModal] = useState<'ciclo' | 'novo_ciclo' | 'adesao' | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const central = ehCentral(usuario)

  const linhas = useMemo(() => {
    if (!ciclo) return []
    const lista = (c: Colecao) => dados[c] ?? []
    const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
    const situacoes = situacaoDosProcessos(lista, hoje, feriadosDe(lista))
    return lista('adesoes_pte')
      .filter((a) => a.ciclo_id === ciclo.id)
      .map((a) => {
        const alunos = lista('pte_alunos').filter((x) => x.adesao_id === a.id && x.ativo !== false)
        const abertas = lista('divergencias').filter((x) => x.adesao_id === a.id && x.status === 'aberta')
        const calculo = lista('calculos_repasse').filter((x) => x.adesao_id === a.id).sort((x, y) => Number(y.versao) - Number(x.versao))[0]
        const termo = lista('instrumentos').find((i) => i.processo_id === a.processo_id)
        const repassado = termo ? lista('parcelas').filter((p) => p.instrumento_id === termo.id).reduce((s, p) => s + Number(p.valor_pago || 0), 0) : 0
        const prestPend = termo ? lista('prestacoes_contas').filter((p) => p.instrumento_id === termo.id && !['aprovada', 'aprovada_ressalvas', 'reprovada'].includes(String(p.status))).length : 0
        return { adesao: a, municipio: achar('municipios', a.municipio_id), sre: achar('sres', a.sre_id), processo: achar('processos', a.processo_id), situacao: situacoes.find((s) => s.adesao?.id === a.id), alunos: alunos.length, abertas: abertas.length, calculo, termo, repassado, prestPend }
      })
      .sort((x, y) => String(x.municipio?.nome).localeCompare(String(y.municipio?.nome), 'pt-BR'))
  }, [dados, ciclo, hoje])

  async function executar(fn: () => Promise<unknown>, ok: string) {
    setMensagem(null)
    try {
      await fn()
      setMensagem({ tipo: 'ok', texto: ok })
      await recarregar()
    } catch (e) {
      if (e instanceof ErroRegra || e instanceof ErroPermissao) setMensagem({ tipo: 'erro', texto: e.message })
      else throw e
    }
  }

  const soma = (f: (l: (typeof linhas)[number]) => number) => linhas.reduce((s, l) => s + f(l), 0)
  const simadeDoCiclo = (dados.simade_registros ?? []).filter((s) => s.ciclo_id === ciclo?.id).length

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Programa Estadual de Transporte Escolar (PTE)</h1>
          <p className="mt-1 text-sm text-slate-600">Ciclo anual: planejamento → adesão e cadastro → definição e repasse → execução e monitoramento → prestação de contas.</p>
        </div>
        {central && <Botao variante="secundario" onClick={() => setModal('novo_ciclo')}><Plus size={16} /> Novo ciclo</Botao>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {ciclos.map((c) => (
          <button
            key={c.id}
            onClick={() => setCicloId(c.id)}
            className={`rounded-full px-3 py-1 text-sm ${c.id === ciclo?.id ? 'bg-marca-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Ciclo {String(c.ano)} · {STATUS_CICLO.find((s) => s.valor === c.status)?.rotulo}
          </button>
        ))}
      </div>

      {ciclo && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Ciclo {String(ciclo.ano)}{' '}
                  {ciclo.aprovado_em ? (
                    <span className="ml-1 inline-flex items-center gap-1 text-sm font-normal text-green-700"><CheckCircle2 size={14} /> aprovado em {formatarData(ciclo.aprovado_em)}</span>
                  ) : (
                    <span className="ml-1 text-sm font-normal text-amber-700">cálculo ainda não aprovado</span>
                  )}
                </h2>
                <p className="mt-1">
                  Parâmetros: {formatarMoeda(ciclo.valor_por_aluno)}/aluno · {formatarMoeda(ciclo.valor_por_km)}/km · {String(ciclo.dias_letivos)} dias letivos · {String(ciclo.num_parcelas)} parcela(s)
                </p>
                <p className="text-slate-600">
                  Adesões até {formatarData(ciclo.data_fim_adesao)} · execução de {formatarData(ciclo.vigencia_inicio)} a {formatarData(ciclo.vigencia_fim)} · SIMADE: {simadeDoCiclo} matrícula(s) importada(s)
                </p>
                {Boolean(ciclo.observacao) && <p className="mt-1 text-xs text-slate-500">{String(ciclo.observacao)}</p>}
              </div>
              {central && (
                <div className="flex flex-wrap gap-2">
                  <Botao variante="secundario" onClick={() => setModal('ciclo')}><Pencil size={16} /> Parâmetros</Botao>
                  <ImportarCsv titulo="Importar SIMADE" colunas="matricula, nome, inep, ibge, situacao" importar={(l) => importarSimade(usuario, ciclo.id, l)} aoConcluir={recarregar} />
                  {!ciclo.aprovado_em && (
                    <>
                      <Botao variante="secundario" onClick={() => executar(async () => { for (const l of linhas) await calcularAdesao(usuario, l.adesao.id) }, 'Cálculo refeito para todas as adesões.')}>Calcular todas</Botao>
                      <Botao onClick={() => executar(() => aprovarCiclo(usuario, ciclo.id), 'Ciclo aprovado. Os parâmetros e cálculos estão travados.')}>Aprovar ciclo (única vez)</Botao>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {mensagem && <p className={`mt-3 rounded-md px-3 py-2 text-sm ${mensagem.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{mensagem.texto}</p>}

          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Cartao titulo="Municípios aderidos" valor={linhas.length} />
            <Cartao titulo="Alunos informados" valor={soma((l) => l.alunos).toLocaleString('pt-BR')} />
            <Cartao titulo="Divergências abertas" valor={soma((l) => l.abertas)} cor={soma((l) => l.abertas) ? 'text-red-600' : undefined} />
            <Cartao titulo="Valor calculado" valor={formatarMoeda(soma((l) => Number(l.calculo?.valor_calculado ?? 0)))} />
            <Cartao titulo="Repassado" valor={formatarMoeda(soma((l) => l.repassado))} />
            <Cartao titulo="Prestações pendentes" valor={soma((l) => l.prestPend)} />
          </div>

          <div className="mt-6 mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Adesões do ciclo</h2>
            {!ciclo.aprovado_em && <Botao onClick={() => setModal('adesao')}><Plus size={16} /> Registrar adesão</Botao>}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Município / código</th>
                  <th className="px-3 py-2 font-medium">Etapa</th>
                  <th className="px-3 py-2 text-right font-medium">Alunos</th>
                  <th className="px-3 py-2 text-right font-medium">Diverg. abertas</th>
                  <th className="px-3 py-2 text-right font-medium">Valor calculado</th>
                  <th className="px-3 py-2 text-right font-medium">Repassado</th>
                  <th className="px-3 py-2 font-medium">Termo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((l) => (
                  <tr key={l.adesao.id} className="cursor-pointer hover:bg-marca-50" onClick={() => navegar(`/pte/adesoes/${l.adesao.id}`)}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{String(l.municipio?.nome)} <span className="text-xs text-slate-500">({String(l.sre?.sigla ?? '')})</span></p>
                      <p className="text-xs text-marca-700">{String(l.processo?.codigo)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-start gap-2">
                        {l.situacao && <PontoSemaforo cor={l.situacao.semaforo.cor} />}
                        <span>
                          {STATUS_ADESAO.find((s) => s.valor === l.adesao.status)?.rotulo}
                          {l.situacao?.semaforo && l.situacao.semaforo.cor !== 'cinza' && <span className="block text-xs text-slate-500">{l.situacao.semaforo.texto}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.alunos}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${l.abertas ? 'font-medium text-red-600' : ''}`}>{l.abertas}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{l.calculo ? formatarMoeda(l.calculo.valor_calculado) : '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{l.termo ? formatarMoeda(l.repassado) : '—'}</td>
                    <td className="px-3 py-2">{l.termo ? String(l.termo.numero) : <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {linhas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma adesão neste ciclo.</p>}
          </div>
        </>
      )}

      <Modal titulo={modal === 'adesao' ? 'Registrar adesão de município' : modal === 'novo_ciclo' ? 'Novo ciclo' : 'Parâmetros do ciclo'} aberto={modal !== null} aoFechar={() => setModal(null)}>
        {modal && (
          <FormularioRegistro
            config={modal === 'adesao' ? ADESAO : CICLO}
            registro={modal === 'ciclo' ? (ciclo as Registro) : null}
            referencias={dados}
            valoresPadrao={modal === 'adesao' ? { data_adesao: hoje } : modal === 'novo_ciclo' ? { ano: Number(ciclo?.ano ?? 2026) + 1, valor_por_aluno: ciclo?.valor_por_aluno, valor_por_km: ciclo?.valor_por_km, dias_letivos: 200, num_parcelas: 3 } : undefined}
            acao={modal === 'adesao' ? (v) => criarAdesao(usuario, { ...v, ciclo_id: ciclo!.id }) : undefined}
            aoCancelar={() => setModal(null)}
            aoSalvar={async (r) => {
              const eraAdesao = modal === 'adesao'
              setModal(null)
              await recarregar()
              if (eraAdesao) navegar(`/pte/adesoes/${r.id}`)
              else if (modal === 'novo_ciclo') setCicloId(r.id)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
