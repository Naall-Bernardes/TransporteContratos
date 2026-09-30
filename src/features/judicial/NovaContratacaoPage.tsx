import { FilePlus2, Mail, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PontoSemaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { feriadosDe } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { formatarData } from '@/lib/formatacao'
import { situacaoDosOficios } from '@/lib/judicial/oficios'
import { ehCentral } from '@/lib/permissoes'
import { ORGAOS_OFICIO } from './configuracoes'
import { IniciarContratacao } from './IniciarContratacao'

/** Primeira tela de Contratações: cadastrar a contratação a partir de um ofício de intimação. */
export function NovaContratacaoPage() {
  const usuario = useUsuario()
  const navegar = useNavigate()
  const { dados, recarregar } = useTodos()
  const hoje = hojeIso()
  const central = ehCentral(usuario)
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<Registro | null>(null)

  const linhas = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    return situacaoDosOficios(lista, hoje, feriadosDe(lista))
      .filter((l) => l.oficio.tipo === 'intimacao_cumprimento' && !l.oficio.demanda_id)
      .map((l) => ({ ...l, escola: String(lista('escolas').find((e) => e.id === l.oficio.escola_id)?.nome ?? '') }))
      .sort((a, b) => String(a.oficio.prazo_resposta).localeCompare(String(b.oficio.prazo_resposta)))
  }, [dados, hoje])

  const filtradas = linhas.filter((l) => {
    const t = busca.trim().toLocaleLowerCase('pt-BR')
    return !t || [l.processo?.codigo, l.oficio.numero, l.oficio.numero_sei, l.oficio.numero_processo_judicial, l.oficio.comarca, l.oficio.orgao_nome, l.oficio.assunto, l.escola].some((x) => String(x ?? '').toLocaleLowerCase('pt-BR').includes(t))
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cadastro a partir de ofício</h1>
          <p className="mt-1 text-sm text-slate-600">
            Intimações para cumprimento de sentença que ainda não têm contratação. Escolha o ofício e cadastre: a contratação começa na Caracterização da demanda.
          </p>
        </div>
        {central && (
          <Link to="/oficios" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Mail size={16} /> Ofício ainda não cadastrado? Ir para Ofícios
          </Link>
        )}
      </div>

      <div className="relative mb-3 w-full max-w-sm">
        <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
        <input className="campo pl-9" placeholder="Código, nº, SEI, processo, comarca, escola…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Ofício</th>
              <th className="px-3 py-2 font-medium">Nº processo SEI</th>
              <th className="px-3 py-2 font-medium">Órgão / processo judicial</th>
              <th className="px-3 py-2 font-medium">Assunto / escola</th>
              <th className="px-3 py-2 font-medium">Recebido</th>
              <th className="px-3 py-2 font-medium">Prazo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((l) => (
              <tr key={l.oficio.id}>
                <td className="px-3 py-2">
                  <Link to={`/oficios/${l.oficio.id}`} className="font-medium whitespace-nowrap text-marca-700 hover:underline">{String(l.processo?.codigo ?? '')}</Link>
                  <p className="text-xs text-slate-500">nº {String(l.oficio.numero)}</p>
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{String(l.oficio.numero_sei || l.processo?.numero_sei || '—')}</td>
                <td className="px-3 py-2">
                  <p>{ORGAOS_OFICIO.find((o) => o.valor === l.oficio.orgao_tipo)?.rotulo} · {String(l.oficio.orgao_nome ?? '')}</p>
                  <p className="text-xs text-slate-500">{String(l.oficio.numero_processo_judicial ?? '—')} · {String(l.oficio.comarca ?? '')}</p>
                </td>
                <td className="max-w-md px-3 py-2">
                  <p className="line-clamp-2">{String(l.oficio.assunto ?? '')}</p>
                  <p className="text-xs text-slate-500">{l.escola || 'escola não informada'}</p>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatarData(l.oficio.data_recebimento)}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <PontoSemaforo cor={l.semaforo.cor} /> {formatarData(l.oficio.prazo_resposta)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Botao className="whitespace-nowrap" disabled={!central} title={central ? undefined : 'O cadastro é feito pelo órgão central.'} onClick={() => setEscolhido(l.oficio)}>
                    <FilePlus2 size={16} /> Cadastrar contratação
                  </Botao>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma intimação aguardando cadastro de contratação.</p>}
      </div>

      <Modal titulo="Cadastrar contratação" aberto={escolhido !== null} aoFechar={() => setEscolhido(null)}>
        {escolhido && (
          <div className="space-y-3">
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Do ofício vêm: processo judicial <strong>{String(escolhido.numero_processo_judicial ?? '')}</strong>, comarca {String(escolhido.comarca ?? '')}, órgão, data de recebimento e nº SEI.
            </p>
            <IniciarContratacao
              oficio={escolhido}
              dados={dados}
              aoCancelar={() => setEscolhido(null)}
              aoCriar={async (r) => {
                setEscolhido(null)
                await recarregar()
                navegar(`/judicial/${r.id}`)
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
