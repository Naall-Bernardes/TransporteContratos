// Etapa 4 (autorização do subsecretário) e etapa 5 (registro do PAF).
// Essas ações acontecem fora do sistema; aqui ficam o dossiê para a decisão e o registro manual do PAF.

import { CheckCircle2, FileText, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { somarMeses } from '@/lib/datas'
import { ErroPermissao, ErroRegra, ErroValidacao } from '@/lib/dados/repositorio'
import { criarPaf, decidirAutorizacao } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import type { DadosProcesso } from '@/lib/fluxo/processo'
import { formatarCpfCnpj, formatarData, formatarMoeda } from '@/lib/formatacao'
import { ehCentral, podeAutorizarLiberacao } from '@/lib/permissoes'
import { resumoCotacoes } from '@/lib/judicial/cotacoes'
import { STATUS_CARACTERIZACAO, UNIDADES_PRECO } from './configuracoes'

interface Props {
  demanda: Registro
  d: DadosProcesso
  dados: Partial<Record<Colecao, Registro[]>>
  aoAlterar: () => Promise<void> | void
}

const mensagemErro = (e: unknown) => {
  if (e instanceof ErroValidacao) return Object.values(e.erros).join(' ')
  if (e instanceof ErroRegra || e instanceof ErroPermissao) return e.message
  throw e
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h3 className="mb-2 font-semibold text-slate-900">{titulo}</h3>
      {children}
    </div>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5">{children || '—'}</dd>
    </div>
  )
}

/** Meses previstos quando a demanda ainda não tem: ano letivo (fevereiro a novembro). */
export const MESES_PADRAO = 10

/** Valor mensal sugerido para a liberação: média das cotações; sem cotação, soma do aprovado pela SRE (10.5) ou do estimado (7.9). */
export function valorMensalSugerido(d: DadosProcesso): number {
  if (d.cotacoes.length) return resumoCotacoes(d.cotacoes).mediaMensal
  return valorMensalCaracterizacao(d)
}

/** Meses sugeridos: os da demanda; senão, os das cotações (se iguais); senão, o ano letivo. */
export const mesesSugeridos = (d: DadosProcesso) => Number(d.demanda?.meses_previstos || resumoCotacoes(d.cotacoes).meses || MESES_PADRAO)

/** Soma do valor aprovado pela SRE (10.5) ou, na falta, do estimado (7.9) de cada aluno. */
export function valorMensalCaracterizacao(d: DadosProcesso): number {
  return d.alunosDemanda.reduce((t, da) => {
    const car = d.caracterizacoes.find((c) => c.demanda_aluno_id === da.id)
    return t + Number(car?.valor_referencia_aprovado || car?.valor_estimado_mensal || 0)
  }, 0)
}

/** Liberação direto da fila da etapa: confirma valor mensal × meses e aprova. */
export function LiberacaoRapida({ demanda, codigo, valorSugerido, mesesSugerido, aoFechar, aoConcluir }: { demanda: Registro; codigo: string; valorSugerido: number; mesesSugerido: number; aoFechar: () => void; aoConcluir: () => Promise<void> | void }) {
  const usuario = useUsuario()
  const [valorMensal, setValorMensal] = useState(String(demanda.valor_mensal ?? (valorSugerido || '')))
  const [meses, setMeses] = useState(String(demanda.meses_previstos ?? mesesSugerido))
  const [parecer, setParecer] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const total = Number(valorMensal) * Number(meses)

  async function liberar() {
    setErro(null)
    try {
      await decidirAutorizacao(usuario, String(demanda.id), { decisao: 'aprovada', valor_mensal: Number(valorMensal), meses: Number(meses), parecer })
      await aoConcluir()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">
        Contratação <strong>{codigo}</strong>. Ao autorizar, a demanda segue para o Registro do PAF.{' '}
        <Link to={`/judicial/${demanda.id}?secao=C02`} className="text-marca-700 hover:underline">Ver dossiê completo</Link>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-slate-600">Valor mensal (R$)</span>
          <input className="campo mt-1" type="number" min="0" step="0.01" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">Meses</span>
          <input className="campo mt-1" type="number" min="1" step="1" value={meses} onChange={(e) => setMeses(e.target.value)} />
        </label>
        <div>
          <span className="text-xs text-slate-600">Valor do contrato</span>
          <p className="mt-1 text-lg font-semibold">{total > 0 ? formatarMoeda(total) : '—'}</p>
        </div>
      </div>
      <label className="block">
        <span className="text-xs text-slate-600">Parecer (opcional)</span>
        <textarea className="campo mt-1" rows={2} value={parecer} onChange={(e) => setParecer(e.target.value)} />
      </label>
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao onClick={liberar}><CheckCircle2 size={16} /> Confirmar autorização</Botao>
      </div>
    </div>
  )
}

/** Etapa 4 — dossiê do processo e decisão do(a) subsecretário(a). */
export function AutorizacaoSubsecretario({ demanda, d, dados, aoAlterar }: Props) {
  const usuario = useUsuario()
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
  const hoje = hojeIso()
  const alunos = d.alunosDemanda.map((da) => ({ da, aluno: achar('alunos', da.aluno_id), car: d.caracterizacoes.find((c) => c.demanda_aluno_id === da.id) }))
  const somaAprovada = valorMensalCaracterizacao(d)
  const cot = resumoCotacoes(d.cotacoes)
  const precos = lista('precos_referencia').filter((p) => p.sre_id === demanda.sre_id && String(p.vigencia_inicio) <= hoje && (!p.vigencia_fim || String(p.vigencia_fim) >= hoje))
  const emAndamento = d.etapas.some((e) => achar('etapas_modelo', e.etapa_modelo_id)?.codigo === 'C02' && e.status === 'em_andamento')
  const podeDecidir = podeAutorizarLiberacao(usuario) && emAndamento

  const [valorMensal, setValorMensal] = useState(String(demanda.valor_mensal ?? (valorMensalSugerido(d) || '')))
  const [meses, setMeses] = useState(String(mesesSugeridos(d)))
  const [parecer, setParecer] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const total = Number(valorMensal) * Number(meses)

  async function decidir(decisao: 'aprovada' | 'devolvida') {
    setErro(null)
    try {
      await decidirAutorizacao(usuario, String(demanda.id), { decisao, valor_mensal: Number(valorMensal), meses: Number(meses), parecer })
      setParecer('')
      await aoAlterar()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        A decisão é do(a) subsecretário(a). Aqui estão reunidas as informações do processo para apoiar a liberação do recurso. Se aprovar, a demanda segue para o registro do PAF; se devolver, volta para o Detalhamento da demanda (etapa 1).
      </p>

      <Bloco titulo="Decisão judicial">
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
          <Linha rotulo="Processo de origem">{String(demanda.numero_processo_origem ?? '')} · {String(demanda.comarca ?? '')}</Linha>
          <Linha rotulo="Prazo judicial">
            <strong className={String(demanda.prazo_judicial) < hoje ? 'text-red-600' : ''}>{formatarData(demanda.prazo_judicial)}</strong>
            {String(demanda.prazo_judicial) < hoje && <span className="ml-1 text-red-600">(vencido)</span>}
          </Linha>
          <Linha rotulo="Multa diária">{demanda.multa_diaria ? formatarMoeda(demanda.multa_diaria) : ''}</Linha>
          <div className="sm:col-span-3">
            <Linha rotulo="Resumo da decisão">{String(demanda.decisao_resumo ?? '')}</Linha>
          </div>
          <Linha rotulo="Escola">{String(achar('escolas', demanda.escola_id)?.nome ?? '')}</Linha>
          <Linha rotulo="Caixa Escolar">{String(achar('caixas_escolares', demanda.caixa_escolar_id)?.razao_social ?? '')}</Linha>
          <Linha rotulo="Responsável na SRE">{String(achar('usuarios', demanda.responsavel_sre_id)?.nome ?? '')}</Linha>
        </dl>
      </Bloco>

      <Bloco titulo="Alunos e caracterização">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Aluno</th>
                <th className="py-1.5 pr-3 font-medium">Situação</th>
                <th className="py-1.5 pr-3 font-medium">Veículo aprovado</th>
                <th className="py-1.5 pr-3 font-medium">Km diário</th>
                <th className="py-1.5 pr-3 font-medium">Estimado (7.9)</th>
                <th className="py-1.5 pr-3 font-medium">Aprovado SRE (10.5)</th>
                <th className="py-1.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alunos.map(({ da, aluno, car }) => (
                <tr key={da.id} className="align-top">
                  <td className="py-1.5 pr-3">
                    {String(aluno?.nome ?? '')}
                    {Boolean(car?.justificativa_tecnica) && <p className="mt-0.5 text-xs text-slate-500">Justificativa: {String(car?.justificativa_tecnica)}</p>}
                  </td>
                  <td className="py-1.5 pr-3">{STATUS_CARACTERIZACAO.find((s) => s.valor === car?.status)?.rotulo ?? '—'}</td>
                  <td className="py-1.5 pr-3">{String(achar('tipos_veiculo', car?.tipo_veiculo_aprovado_id ?? car?.tipo_veiculo_indicado_id)?.nome ?? '—')}</td>
                  <td className="py-1.5 pr-3">{car?.km_diario_total ? String(car.km_diario_total) : '—'}</td>
                  <td className="py-1.5 pr-3">{formatarMoeda(car?.valor_estimado_mensal) || '—'}</td>
                  <td className="py-1.5 pr-3">{formatarMoeda(car?.valor_referencia_aprovado) || '—'}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <Link to={`/judicial/${demanda.id}/caracterizacao/${da.id}`} className="inline-flex items-center gap-1 text-marca-700 hover:underline">
                      <FileText size={14} /> Formulário
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2">Soma mensal aprovada pela SRE (referência): <strong>{formatarMoeda(somaAprovada)}</strong></p>
      </Bloco>

      <Bloco titulo={`Cotações da escolha do transporte (${cot.qtd})`}>
        {cot.qtd === 0 ? (
          <p className="text-slate-500">Nenhuma cotação registrada.</p>
        ) : (
          <>
            <ul className="space-y-0.5">
              {d.cotacoes.map((c) => (
                <li key={c.id} className={c.escolhida ? 'font-medium text-green-800' : ''}>
                  {String(achar('transportadores', c.transportador_id)?.razao_social ?? '')} — {formatarMoeda(c.valor_mensal)}/mês × {String(c.meses)} = {formatarMoeda(c.valor_total)}
                  {Boolean(c.escolhida) && ' (escolhida)'}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              <strong>Média das cotações (valor sugerido): {formatarMoeda(cot.mediaTotal)}</strong> <span className="text-slate-500">· {formatarMoeda(cot.mediaMensal)}/mês</span>
            </p>
            {Boolean(demanda.justificativa_cotacao) && <p className="mt-1 text-slate-600">Justificativa da escolha: {String(demanda.justificativa_cotacao)}</p>}
          </>
        )}
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Preços de referência vigentes na SRE">
          {precos.length === 0 ? (
            <p className="text-slate-500">Nenhum.</p>
          ) : (
            <ul className="space-y-0.5">
              {precos.map((p) => (
                <li key={p.id}>
                  {String(achar('tipos_veiculo', p.tipo_veiculo_id)?.nome)} — {formatarMoeda(p.valor)} ({UNIDADES_PRECO.find((u) => u.valor === p.unidade)?.rotulo})
                </li>
              ))}
            </ul>
          )}
        </Bloco>
        <Bloco titulo={`Documentos do processo (${d.documentos.length})`}>
          {d.documentos.length === 0 ? (
            <p className="text-slate-500">Nenhum documento.</p>
          ) : (
            <ul className="max-h-48 space-y-0.5 overflow-y-auto">
              {d.documentos.map((doc) => (
                <li key={doc.id}>
                  {String(achar('tipos_documento', doc.tipo_documento_id)?.nome ?? 'Documento')}
                  <span className="text-slate-500"> · {String(doc.nome_arquivo ?? '')}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>

      {d.autorizacoes.length > 0 && (
        <Bloco titulo="Decisões anteriores">
          <ul className="space-y-2">
            {d.autorizacoes.map((a) => (
              <li key={a.id} className={`rounded-md px-3 py-2 ${a.decisao === 'aprovada' ? 'bg-green-50' : 'bg-orange-50'}`}>
                <strong>{a.decisao === 'aprovada' ? 'Liberação aprovada' : 'Devolvida para ajuste'}</strong> em {formatarData(a.data)} por {String(achar('usuarios', a.subsecretario_id)?.nome ?? '')}
                {a.decisao === 'aprovada' && <> — {formatarMoeda(a.valor_mensal)}/mês × {String(a.meses)} meses = {formatarMoeda(a.valor_total)}</>}
                {Boolean(a.parecer) && <p className="mt-0.5 text-slate-600">{String(a.parecer)}</p>}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {emAndamento && (
        <Bloco titulo="Decisão do(a) subsecretário(a)">
          {podeDecidir ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs text-slate-600">Valor mensal autorizado (R$)</span>
                  <input className="campo mt-1" type="number" min="0" step="0.01" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Meses</span>
                  <input className="campo mt-1" type="number" min="1" step="1" value={meses} onChange={(e) => setMeses(e.target.value)} />
                </label>
                <div>
                  <span className="text-xs text-slate-600">Valor total</span>
                  <p className="mt-2 font-semibold">{total > 0 ? formatarMoeda(total) : '—'}</p>
                </div>
              </div>
              <label className="block">
                <span className="text-xs text-slate-600">Parecer (obrigatório para devolver)</span>
                <textarea className="campo mt-1" rows={3} value={parecer} onChange={(e) => setParecer(e.target.value)} />
              </label>
              {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">{erro}</p>}
              <div className="flex flex-wrap gap-2">
                <Botao onClick={() => decidir('aprovada')}><CheckCircle2 size={16} /> Aprovar liberação</Botao>
                <Botao variante="secundario" onClick={() => decidir('devolvida')}><Undo2 size={16} /> Devolver para ajuste</Botao>
              </div>
            </div>
          ) : (
            <p className="text-slate-600">Aguardando a decisão do(a) subsecretário(a). Só o perfil Subsecretário(a) pode aprovar ou devolver.</p>
          )}
        </Bloco>
      )}
    </div>
  )
}

/** Etapa 5 — registro manual do PAF criado. */
export function RegistroPaf({ demanda, d, dados, aoAlterar }: Props) {
  const usuario = useUsuario()
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
  const caixa = achar('caixas_escolares', demanda.caixa_escolar_id)
  const emAndamento = d.etapas.some((e) => achar('etapas_modelo', e.etapa_modelo_id)?.codigo === 'C03' && e.status === 'em_andamento')
  const pode = ehCentral(usuario) && emAndamento

  const [numero, setNumero] = useState('')
  const [dataCriacao, setDataCriacao] = useState(hojeIso())
  const [valor, setValor] = useState(String(demanda.valor_total ?? ''))
  const [cnpj, setCnpj] = useState(String(caixa?.cnpj ?? ''))
  const [erro, setErro] = useState<string | null>(null)
  const vigencia = /^\d{4}-\d{2}-\d{2}$/.test(dataCriacao) ? somarMeses(dataCriacao, 60) : ''
  const nomeCnpj = lista('caixas_escolares').find((c) => String(c.cnpj).replace(/\D/g, '') === cnpj.replace(/\D/g, ''))?.razao_social

  async function criar() {
    setErro(null)
    try {
      await criarPaf(usuario, String(demanda.id), { numero: numero.trim(), data_criacao: dataCriacao, valor: Number(valor), cnpj_destinatario: cnpj })
      await aoAlterar()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <div className="space-y-4">
      {d.pafs.map((p) => (
        <Bloco key={p.id} titulo={`PAF ${String(p.numero)}`}>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-4">
            <Linha rotulo="Data de criação">{formatarData(p.data_criacao)}</Linha>
            <Linha rotulo="Vigência até">{formatarData(p.data_vigencia)}</Linha>
            <Linha rotulo="Valor financeiro">{formatarMoeda(p.valor)}</Linha>
            <Linha rotulo="CNPJ de destino">{formatarCpfCnpj(p.cnpj_destinatario)}</Linha>
          </dl>
        </Bloco>
      ))}

      {emAndamento && (
        <Bloco titulo="Criar PAF">
          <p className="mb-3 text-slate-600">
            Liberação autorizada: <strong>{formatarMoeda(demanda.valor_total)}</strong>. Preencha os dados do PAF já criado; a vigência é calculada automaticamente (5 anos após a criação).
          </p>
          {pode ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-slate-600">Número oficial do PAF *</span>
                  <input className="campo mt-1" value={numero} onChange={(e) => setNumero(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Data de criação do PAF *</span>
                  <input className="campo mt-1" type="date" max={hojeIso()} value={dataCriacao} onChange={(e) => setDataCriacao(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Data de vigência (automática)</span>
                  <input className="campo mt-1 bg-slate-50" value={formatarData(vigencia)} readOnly />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Valor financeiro (R$) *</span>
                  <input className="campo mt-1" type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs text-slate-600">CNPJ de destino *</span>
                  <input className="campo mt-1" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  <span className="mt-1 block text-xs text-slate-500">{nomeCnpj ? String(nomeCnpj) : 'CNPJ não corresponde a nenhuma Caixa Escolar cadastrada.'}</span>
                </label>
              </div>
              {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">{erro}</p>}
              <Botao disabled={!numero.trim() || !dataCriacao || !valor || !cnpj} onClick={criar}>Criar PAF</Botao>
            </div>
          ) : (
            <p className="text-slate-600">O PAF é registrado pelo órgão central.</p>
          )}
        </Bloco>
      )}
    </div>
  )
}
