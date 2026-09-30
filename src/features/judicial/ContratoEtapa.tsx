// Etapa 6 — Contratos: cadastro do contrato firmado pela Caixa Escolar e acompanhamento do executado/saldo.
// A contratação acontece fora do sistema; aqui entram os dados do contrato assinado.

import { ExternalLink, Save } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SeloVigencia } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { TIPOS_GARANTIA } from '@/features/contratos/configuracoes'
import { calcularSituacao } from '@/lib/contratos/calculos'
import { ErroPermissao, ErroRegra, ErroValidacao, salvar } from '@/lib/dados/repositorio'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import type { DadosProcesso } from '@/lib/fluxo/processo'
import { formatarCpfCnpj, formatarData, formatarMoeda } from '@/lib/formatacao'

interface Props {
  demanda: Registro
  processo: Registro
  d: DadosProcesso
  dados: Partial<Record<Colecao, Registro[]>>
  podeEditar: boolean
  aoAlterar: () => Promise<void> | void
}

function Campo({ rotulo, erro, children, largo }: { rotulo: string; erro?: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`block ${largo ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs text-slate-600">{rotulo}</span>
      <div className="mt-1">{children}</div>
      {erro && <span className="mt-0.5 block text-xs text-red-600">{erro}</span>}
    </label>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5">{children || '—'}</dd>
    </div>
  )
}

const rotuloGarantia = (v: unknown) => TIPOS_GARANTIA.find((o) => o.valor === v)?.rotulo ?? 'Sem garantia'

export function ContratoEtapa({ demanda, processo, d, dados, podeEditar, aoAlterar }: Props) {
  const usuario = useUsuario()
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
  const hoje = hojeIso()
  const contrato = d.instrumentos.find((i) => i.tipo === 'contrato_caixa')
  const paf = d.pafs[0]

  const [f, setF] = useState<Record<string, string>>({
    numero: '',
    transportador_id: '',
    valor_global: String(paf?.valor ?? demanda.valor_total ?? ''),
    data_assinatura: hoje,
    vigencia_inicio: '',
    vigencia_fim: '',
    tipo_garantia: 'sem_garantia',
    valor_garantia: '',
    garantia_vigencia_fim: '',
    valor_executado: '0',
    dotacao_orcamentaria: '',
    gestor_id: String(demanda.responsavel_sre_id ?? ''),
    fiscal_id: String(demanda.responsavel_sre_id ?? ''),
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [executado, setExecutado] = useState(String(contrato?.valor_executado ?? ''))
  const mudar = (campo: string) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value })
  const comGarantia = f.tipo_garantia !== 'sem_garantia'
  const empresa = achar('transportadores', f.transportador_id)
  const saldo = Number(f.valor_global || 0) - Number(f.valor_executado || 0)
  const usuariosAtivos = lista('usuarios').filter((u) => u.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))

  async function tentar(fn: () => Promise<unknown>) {
    setErros({})
    try {
      await fn()
      await aoAlterar()
    } catch (e) {
      if (e instanceof ErroValidacao) setErros(e.erros)
      else if (e instanceof ErroRegra || e instanceof ErroPermissao) setErros({ _geral: e.message })
      else throw e
    }
  }

  const cadastrar = () =>
    tentar(() =>
      salvar(
        'instrumentos',
        {
          tipo: 'contrato_caixa',
          processo_id: processo.id,
          caixa_escolar_id: demanda.caixa_escolar_id,
          numero_sei: processo.numero_sei,
          objeto: `Transporte escolar em cumprimento da demanda ${processo.codigo}.`,
          status: 'vigente',
          periodicidade_prestacao: 'final',
          prazo_prestacao_dias: 30,
          ...f,
          valor_global: f.valor_global === '' ? null : Number(f.valor_global),
          valor_executado: f.valor_executado === '' ? 0 : Number(f.valor_executado),
          valor_garantia: comGarantia && f.valor_garantia !== '' ? Number(f.valor_garantia) : null,
          garantia_vigencia_fim: comGarantia ? f.garantia_vigencia_fim || null : null,
          gestor_id: f.gestor_id || null,
          fiscal_id: f.fiscal_id || null,
        },
        usuario,
      ),
    )

  if (contrato) {
    const s = calcularSituacao(contrato, lista('aditivos').filter((a) => a.instrumento_id === contrato.id), lista('parcelas').filter((p) => p.instrumento_id === contrato.id), hoje)
    const t = achar('transportadores', contrato.transportador_id)
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Contrato nº {String(contrato.numero)} <SeloVigencia faixa={s.faixa} /></h3>
          <Link to={`/contratos/${contrato.id}`} className="inline-flex items-center gap-1 text-marca-700 hover:underline">Abrir gestão do contrato <ExternalLink size={14} /></Link>
        </div>
        <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dado rotulo="Empresa contratada">{String(t?.razao_social ?? '')}</Dado>
          <Dado rotulo="CNPJ">{formatarCpfCnpj(t?.cpf_cnpj)}</Dado>
          <Dado rotulo="Data da assinatura">{formatarData(contrato.data_assinatura)}</Dado>
          <Dado rotulo="Vigência">{formatarData(contrato.vigencia_inicio)} a {formatarData(s.vigencia_fim_atual)}</Dado>
          <Dado rotulo="Valor contratado">{formatarMoeda(s.valor_atual)}</Dado>
          <Dado rotulo="Valor executado">{formatarMoeda(s.valor_executado)} ({s.pct_executado.toFixed(0)}%)</Dado>
          <Dado rotulo="Saldo do contrato"><strong>{formatarMoeda(s.saldo)}</strong></Dado>
          <Dado rotulo="Garantia">
            {rotuloGarantia(contrato.tipo_garantia)}
            {Boolean(contrato.tipo_garantia) && contrato.tipo_garantia !== 'sem_garantia' && <> — {formatarMoeda(contrato.valor_garantia)}{contrato.garantia_vigencia_fim ? `, até ${formatarData(contrato.garantia_vigencia_fim)}` : ''}</>}
          </Dado>
        </dl>
        {podeEditar && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
            <Campo rotulo="Atualizar valor executado (R$)" erro={erros.valor_executado ?? erros._geral}>
              <input className="campo w-48" type="number" min="0" step="0.01" value={executado} onChange={(e) => setExecutado(e.target.value)} />
            </Campo>
            <Botao variante="secundario" disabled={executado === '' || Number(executado) === Number(contrato.valor_executado)} onClick={() => tentar(() => salvar('instrumentos', { id: contrato.id, valor_executado: Number(executado) }, usuario))}>
              <Save size={16} /> Salvar
            </Botao>
          </div>
        )}
      </div>
    )
  }

  if (!podeEditar)
    return <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Nenhum contrato cadastrado ainda.</p>

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h3 className="font-semibold text-slate-900">Cadastrar contrato</h3>
      <p className="mt-1 text-slate-600">
        Contratante: <strong>{String(achar('caixas_escolares', demanda.caixa_escolar_id)?.razao_social ?? '—')}</strong>
        {paf && <> · PAF {String(paf.numero)} ({formatarMoeda(paf.valor)})</>}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nº do contrato *" erro={erros.numero}>
          <input className="campo" value={f.numero} onChange={mudar('numero')} placeholder="Ex.: 012/2026" />
        </Campo>
        <Campo rotulo="Empresa contratada *" erro={erros.transportador_id}>
          <select className="campo" value={f.transportador_id} onChange={mudar('transportador_id')}>
            <option value="">Escolha no cadastro de transportadores…</option>
            {lista('transportadores')
              .filter((t) => t.ativo !== false)
              .sort((a, b) => String(a.razao_social).localeCompare(String(b.razao_social), 'pt-BR'))
              .map((t) => <option key={t.id} value={t.id}>{String(t.razao_social)} — {formatarCpfCnpj(t.cpf_cnpj)}</option>)}
          </select>
          <span className="mt-0.5 block text-xs text-slate-500">
            {empresa ? `CNPJ ${formatarCpfCnpj(empresa.cpf_cnpj)}` : <>Não está na lista? <Link to="/cadastros/transportadores" className="text-marca-700 hover:underline">Cadastrar transportador</Link></>}
          </span>
        </Campo>
        <Campo rotulo="Valor contratado (R$) *" erro={erros.valor_global}>
          <input className="campo" type="number" min="0" step="0.01" value={f.valor_global} onChange={mudar('valor_global')} />
        </Campo>
        <Campo rotulo="Data da assinatura *" erro={erros.data_assinatura}>
          <input className="campo" type="date" value={f.data_assinatura} onChange={mudar('data_assinatura')} />
        </Campo>
        <Campo rotulo="Início da vigência *" erro={erros.vigencia_inicio}>
          <input className="campo" type="date" value={f.vigencia_inicio} onChange={mudar('vigencia_inicio')} />
        </Campo>
        <Campo rotulo="Fim da vigência *" erro={erros.vigencia_fim}>
          <input className="campo" type="date" value={f.vigencia_fim} onChange={mudar('vigencia_fim')} />
        </Campo>
        <Campo rotulo="Tipo de garantia" erro={erros.tipo_garantia}>
          <select className="campo" value={f.tipo_garantia} onChange={mudar('tipo_garantia')}>
            {TIPOS_GARANTIA.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </Campo>
        {comGarantia ? (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor da garantia (R$) *" erro={erros.valor_garantia}>
              <input className="campo" type="number" min="0" step="0.01" value={f.valor_garantia} onChange={mudar('valor_garantia')} />
            </Campo>
            <Campo rotulo="Garantia válida até" erro={erros.garantia_vigencia_fim}>
              <input className="campo" type="date" value={f.garantia_vigencia_fim} onChange={mudar('garantia_vigencia_fim')} />
            </Campo>
          </div>
        ) : (
          <div />
        )}
        <Campo rotulo="Valor executado (R$)" erro={erros.valor_executado}>
          <input className="campo" type="number" min="0" step="0.01" value={f.valor_executado} onChange={mudar('valor_executado')} />
        </Campo>
        <Campo rotulo="Saldo do contrato (calculado)">
          <input className="campo bg-slate-50" readOnly value={f.valor_global === '' ? '' : formatarMoeda(saldo)} />
        </Campo>
        <Campo rotulo="Dotação orçamentária *" erro={erros.dotacao_orcamentaria}>
          <input className="campo" value={f.dotacao_orcamentaria} onChange={mudar('dotacao_orcamentaria')} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Gestor *" erro={erros.gestor_id}>
            <select className="campo" value={f.gestor_id} onChange={mudar('gestor_id')}>
              <option value="">—</option>
              {usuariosAtivos.map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Fiscal *" erro={erros.fiscal_id}>
            <select className="campo" value={f.fiscal_id} onChange={mudar('fiscal_id')}>
              <option value="">—</option>
              {usuariosAtivos.map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
            </select>
          </Campo>
        </div>
      </div>
      {erros._geral && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-red-700">{erros._geral}</p>}
      <Botao className="mt-4" onClick={cadastrar}>Cadastrar contrato</Botao>
    </div>
  )
}
