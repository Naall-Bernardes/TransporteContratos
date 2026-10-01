// Painel de indicadores. Mesmos cálculos usados no restante do sistema.

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarrasHorizontais } from '@/components/comum/BarrasHorizontais'
import { Cartao } from '@/components/comum/Cartao'
import { PontoSemaforo } from '@/components/comum/Semaforo'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { formatarMoeda } from '@/lib/formatacao'
import { calcularPainel } from '@/lib/painel'
import { feriadosDe } from '@/lib/dados/servicos'
import { situacaoDosOficios } from '@/lib/judicial/oficios'

function Bloco({ titulo, descricao, children, link }: { titulo: string; descricao?: string; children: ReactNode; link?: { para: string; rotulo: string } }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          {descricao && <p className="text-xs text-slate-500">{descricao}</p>}
        </div>
        {link && <Link to={link.para} className="text-sm text-marca-700 hover:underline">{link.rotulo} →</Link>}
      </div>
      {children}
    </section>
  )
}

export function PainelPage() {
  const { dados } = useTodos()
  const hoje = hojeIso()

  const p = useMemo(() => calcularPainel((c: Colecao) => dados[c] ?? [], hoje), [dados, hoje])
  const oficios = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    return situacaoDosOficios(lista, hoje, feriadosDe(lista))
  }, [dados, hoje])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Painel</h1>
        <p className="mt-1 text-sm text-slate-600">Indicadores calculados na hora, a partir dos dados que você pode ver.</p>
      </div>

      <Bloco titulo="Ofícios" link={{ para: '/oficios', rotulo: 'Abrir ofícios' }}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Cartao titulo="Pendentes de resposta" valor={oficios.filter((o) => o.situacao !== 'respondido').length} />
          <Cartao titulo="Aguardando SRE" valor={oficios.filter((o) => o.situacao === 'aguardando_sre').length} />
          <Cartao titulo="A vencer" valor={oficios.filter((o) => o.situacao !== 'respondido' && o.semaforo.cor === 'amarelo').length} detalhe={<span className="inline-flex items-center gap-1"><PontoSemaforo cor="amarelo" /> até 3 dias úteis</span>} />
          <Cartao titulo="Prazo vencido" valor={oficios.filter((o) => o.vencido).length} cor={oficios.some((o) => o.vencido) ? 'text-red-600' : undefined} />
          <Cartao titulo="Respondidos" valor={oficios.filter((o) => o.situacao === 'respondido').length} />
        </div>
      </Bloco>

      <Bloco titulo="Contratações" link={{ para: '/judicial', rotulo: 'Abrir contratações' }}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Cartao titulo="Ativas" valor={p.ativas} />
          <Cartao titulo="Vencidas" valor={p.vermelho} cor={p.vermelho ? 'text-red-600' : undefined} detalhe={<span className="inline-flex items-center gap-1"><PontoSemaforo cor="vermelho" /> semáforo vermelho</span>} />
          <Cartao titulo="A vencer" valor={p.amarelo} detalhe={<span className="inline-flex items-center gap-1"><PontoSemaforo cor="amarelo" /> até 3 dias úteis</span>} />
          <Cartao titulo="Prazo judicial vencido" valor={p.judicialVencido} cor={p.judicialVencido ? 'text-red-700' : undefined} detalhe="sem início do transporte" />
          <Cartao titulo="Cumpridas" valor={p.cumpridas} />
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Contratações ativas por etapa atual</h3>
            <BarrasHorizontais itens={p.porEtapa} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Por SRE e semáforo</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-1 text-left font-medium">SRE</th>
                  <th className="py-1 text-right font-medium"><span className="inline-flex items-center gap-1"><PontoSemaforo cor="verde" /> No prazo</span></th>
                  <th className="py-1 text-right font-medium"><span className="inline-flex items-center gap-1"><PontoSemaforo cor="amarelo" /> A vencer</span></th>
                  <th className="py-1 text-right font-medium"><span className="inline-flex items-center gap-1"><PontoSemaforo cor="vermelho" /> Vencido</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.porSre.map((s) => (
                  <tr key={s.sigla}>
                    <td className="py-1.5">{s.sigla}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.verde}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.amarelo}</td>
                    <td className={`py-1.5 text-right tabular-nums ${s.vermelho ? 'font-semibold text-red-600' : ''}`}>{s.vermelho}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Tempo médio por etapa — Contratações" descricao="Dias úteis das etapas concluídas (entre parênteses, quantas). Traço = SLA. Etapas contínuas (Contratos) não entram.">
        <BarrasHorizontais itens={p.tempoJudicial} rotuloReferencia="SLA" vazio="Nenhuma etapa concluída." />
      </Bloco>

      <Bloco titulo="Contratos das Caixas Escolares" link={{ para: '/contratos', rotulo: 'Abrir gestão contratual' }}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Cartao titulo="Ativos" valor={p.contratos.ativos} />
          <Cartao titulo="A vencer" valor={p.contratos.ate90 + p.contratos.ate60 + p.contratos.ate30} detalhe={`${p.contratos.ate90} em 90 · ${p.contratos.ate60} em 60 · ${p.contratos.ate30} em 30 dias`} />
          <Cartao titulo="Vencidos" valor={p.contratos.vencidos} cor={p.contratos.vencidos ? 'text-red-600' : undefined} />
          <Cartao titulo="Valor contratado" valor={formatarMoeda(p.contratos.valor)} />
          <Cartao titulo="Executado" valor={formatarMoeda(p.contratos.executado)} detalhe={p.contratos.valor ? `${((p.contratos.executado / p.contratos.valor) * 100).toFixed(1)}%` : undefined} />
          <Cartao titulo="Prestações atrasadas" valor={p.contratos.prestacoesAtrasadas} cor={p.contratos.prestacoesAtrasadas ? 'text-red-600' : undefined} />
        </div>
      </Bloco>

      <Bloco titulo="Conformidade legal da frota em serviço" descricao="Contratado, veículos e condutores de contratos judiciais e das contratações do PTE (CTB arts. 136–138, 148-A e 329; DETRAN-MG; Res. SEE 3.670/2017).">
        <div className="grid gap-3 sm:grid-cols-5">
          <Cartao titulo="Em serviço (contratados, veículos, condutores)" valor={p.conformidade.emServico} />
          <Cartao titulo="Com pendência obrigatória" valor={p.conformidade.comPendencia} cor={p.conformidade.comPendencia ? 'text-red-600' : undefined} />
          <Cartao titulo="Documentos vencidos ou não enviados" valor={p.conformidade.pendencias} cor={p.conformidade.pendencias ? 'text-red-600' : undefined} />
          <Cartao titulo="Documentos a vencer (30 dias)" valor={p.conformidade.aVencer} cor={p.conformidade.aVencer ? 'text-amber-600' : undefined} />
          <Cartao titulo="Despesas PTE sem comprovação (> 30 dias úteis)" valor={p.conformidade.despesasSemComprovacao} cor={p.conformidade.despesasSemComprovacao ? 'text-red-600' : undefined} />
        </div>
      </Bloco>

      <Bloco titulo="PTE — termos de repasse aos municípios" link={{ para: '/pte', rotulo: 'Abrir PTE' }}>
        <div className="grid gap-4 lg:grid-cols-2">
          {p.pte.map((r) => (
            <div key={r.ano}>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">{r.ano}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Cartao titulo="Municípios com termo" valor={r.municipios} />
                <Cartao titulo="Alunos atendidos" valor={r.alunos.toLocaleString('pt-BR')} />
                <Cartao titulo="Valor dos repasses" valor={formatarMoeda(r.valor)} />
                <Cartao titulo="Repassado" valor={formatarMoeda(r.repassado)} detalhe={r.valor ? `${((r.repassado / r.valor) * 100).toFixed(0)}%` : undefined} />
                <Cartao titulo="Gasto informado" valor={formatarMoeda(r.gasto)} />
                <Cartao titulo="Prestações pendentes" valor={r.prestacoes} />
              </div>
            </div>
          ))}
        </div>
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Documentos pendentes por etapa" descricao="Documentos obrigatórios faltando nos processos em andamento.">
          <BarrasHorizontais itens={p.pendDocs} vazio="Nenhum documento pendente." />
        </Bloco>
      </div>
    </div>
  )
}
