// Etapa "Escolha do transporte": a regional apoia o diretor da escola, registra as cotações
// (mínimo 3, transportadores do cadastro) e marca a escolhida. A média vai para a Autorização.

import { CheckCircle2, Circle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { SecaoRegistros } from '@/features/contratos/SecaoRegistros'
import { ErroPermissao, ErroRegra, ErroValidacao } from '@/lib/dados/repositorio'
import { escolherCotacao } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import type { DadosProcesso } from '@/lib/fluxo/processo'
import { formatarCpfCnpj, formatarMoeda } from '@/lib/formatacao'
import { MINIMO_COTACOES, resumoCotacoes } from '@/lib/judicial/cotacoes'
import { somarDias } from '@/lib/datas'
import { COTACAO } from './configuracoes'

interface Props {
  demanda: Registro
  d: DadosProcesso
  dados: Partial<Record<Colecao, Registro[]>>
  podeEditar: boolean
  aoAlterar: () => Promise<void>
}

export function EscolhaTransporte({ demanda, d, dados, podeEditar, aoAlterar }: Props) {
  const usuario = useUsuario()
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
  const r = resumoCotacoes(d.cotacoes)
  const [justificativa, setJustificativa] = useState(String(demanda.justificativa_cotacao ?? ''))
  const [marcando, setMarcando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const totalDe = (c: Registro) => Number(c.valor_total ?? Number(c.valor_mensal) * Number(c.meses))
  const menorTotal = r.menor ? totalDe(r.menor) : 0
  const precisaJustificar = (c: Registro) => totalDe(c) > menorTotal

  async function escolher(c: Registro) {
    setErro(null)
    if (precisaJustificar(c) && !justificativa.trim()) {
      setMarcando(String(c.id))
      setErro('Esta não é a cotação de menor valor: escreva a justificativa abaixo e confirme.')
      return
    }
    try {
      await escolherCotacao(usuario, String(c.id), justificativa)
      setMarcando(null)
      await aoAlterar()
    } catch (e) {
      if (e instanceof ErroValidacao || e instanceof ErroRegra || e instanceof ErroPermissao) setErro(e.message)
      else throw e
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        A regional apoia o diretor da escola na escolha do transporte e registra as cotações feitas (no mínimo {MINIMO_COTACOES}), com transportadores do cadastro. Marque a escolhida; a <strong>média das cotações</strong> é o valor que vai para a Autorização.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className={`text-2xl font-semibold ${r.qtd >= MINIMO_COTACOES ? 'text-slate-900' : 'text-amber-600'}`}>{r.qtd}/{MINIMO_COTACOES}</p>
          <p className="text-xs text-slate-600">cotações registradas</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold text-slate-900">{r.menor ? formatarMoeda(menorTotal) : '—'}</p>
          <p className="text-xs text-slate-600">menor cotação (contrato)</p>
        </div>
        <div className="rounded-lg border border-marca-200 bg-marca-50 p-3">
          <p className="text-2xl font-semibold text-marca-800">{r.qtd ? formatarMoeda(r.mediaTotal) : '—'}</p>
          <p className="text-xs text-marca-800">média das cotações — vai para a Autorização{r.qtd ? ` (${formatarMoeda(r.mediaMensal)}/mês)` : ''}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="truncate text-sm font-semibold text-slate-900">{r.escolhida ? String(achar('transportadores', r.escolhida.transportador_id)?.razao_social ?? '') : 'não marcada'}</p>
          <p className="text-xs text-slate-600">cotação escolhida{r.escolhida ? ` · ${formatarMoeda(totalDe(r.escolhida))}` : ''}</p>
        </div>
      </div>

      {d.cotacoes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Escolhida</th>
                <th className="px-3 py-2 font-medium">Transportador</th>
                <th className="px-3 py-2 font-medium">Veículo</th>
                <th className="px-3 py-2 text-right font-medium">Mensal</th>
                <th className="px-3 py-2 text-right font-medium">Meses</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.cotacoes.map((c) => {
                const t = achar('transportadores', c.transportador_id)
                return (
                  <tr key={c.id} className={c.escolhida ? 'bg-green-50' : c.id === r.menor?.id ? 'bg-sky-50/50' : ''}>
                    <td className="px-3 py-2">
                      {c.escolhida ? (
                        <span className="inline-flex items-center gap-1 font-medium text-green-700"><CheckCircle2 size={16} /> Escolhida</span>
                      ) : podeEditar ? (
                        <button className="inline-flex items-center gap-1 text-marca-700 hover:underline" onClick={() => escolher(c)}><Circle size={16} /> Escolher</button>
                      ) : (
                        <Circle size={16} className="text-slate-300" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <p>{String(t?.razao_social ?? '')}</p>
                      <p className="text-xs text-slate-500">{formatarCpfCnpj(t?.cpf_cnpj)}{c.id === r.menor?.id ? ' · menor valor' : ''}</p>
                    </td>
                    <td className="px-3 py-2">{String(achar('tipos_veiculo', c.tipo_veiculo_id)?.nome ?? '—')}</td>
                    <td className="px-3 py-2 text-right">{formatarMoeda(c.valor_mensal)}</td>
                    <td className="px-3 py-2 text-right">{String(c.meses)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatarMoeda(totalDe(c))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(r.escolhidaNaoEhMenor || marcando) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <label className="block">
            <span className="text-xs text-amber-900">Justificativa da escolha (não é a de menor valor) *</span>
            <textarea className="campo mt-1" rows={2} value={justificativa} disabled={!podeEditar} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex.: única com veículo adaptado disponível na região" />
          </label>
          {podeEditar && (marcando || justificativa !== String(demanda.justificativa_cotacao ?? '')) && (
            <Botao className="mt-2" onClick={() => {
              const alvo = d.cotacoes.find((c) => c.id === (marcando ?? r.escolhida?.id))
              if (alvo) escolher(alvo)
            }}>Confirmar escolha</Botao>
          )}
        </div>
      )}
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <SecaoRegistros
        config={COTACAO}
        valoresFixos={{ demanda_id: demanda.id }}
        registros={d.cotacoes}
        referencias={dados}
        podeEditar={podeEditar}
        aoAlterar={aoAlterar}
        padraoNovo={{ data_cotacao: hojeIso(), validade_ate: somarDias(hojeIso(), 60), meses: demanda.meses_previstos ?? r.meses ?? 10 }}
        cabecalho={
          <p className="text-xs text-slate-500">
            Inclua ou corrija as cotações aqui. Transportador fora da lista? <Link to="/cadastros/transportadores" className="text-marca-700 hover:underline">Cadastrar transportador</Link>. Anexe as propostas em Documentos (tipo "Proposta / cotação de transporte").
          </p>
        }
      />
    </div>
  )
}
