// Relatório de comprovação do cumprimento (para AGE/Judiciário), pronto para imprimir/salvar em PDF.

import { Printer } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { calcularSituacao } from '@/lib/contratos/calculos'
import { ROTULO_STATUS_PRESTACAO } from '@/lib/dados/regrasContratos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { montarDadosProcesso } from '@/lib/fluxo/processo'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { ORIGENS } from './configuracoes'

export function RelatorioCumprimentoPage() {
  const { id } = useParams()
  const { dados, carregando } = useTodos()
  if (carregando) return null
  const achar = (c: Colecao, rid: unknown) => dados[c]?.find((r) => r.id === rid)
  const demanda = achar('demandas', id)
  if (!demanda) return <p className="p-6 text-sm">Demanda não encontrada.</p>
  const d = montarDadosProcesso((c) => dados[c] ?? [], String(demanda.processo_id))
  const hoje = hojeIso()
  const contrato = d.instrumentos[0]
  const s = contrato ? calcularSituacao(contrato, (dados.aditivos ?? []).filter((a) => a.instrumento_id === contrato.id), d.parcelas, hoje) : null
  const modelos = (dados.etapas_modelo ?? []).filter((m) => m.modulo === 'JUDICIAL').sort((a, b) => Number(a.ordem) - Number(b.ordem))
  const cumpriuPrazo = demanda.data_inicio_transporte && String(demanda.data_inicio_transporte) <= String(demanda.prazo_judicial)

  const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-sm font-bold tracking-wide text-slate-800 uppercase">{titulo}</h2>
      {children}
    </section>
  )

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm text-slate-900 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <Botao onClick={() => window.print()}><Printer size={16} /> Imprimir / salvar PDF</Botao>
      </div>
      <p className="text-xs text-slate-500">Secretaria de Estado de Educação de Minas Gerais — Transporte Escolar</p>
      <h1 className="mt-1 text-lg font-bold">Relatório de comprovação do cumprimento</h1>
      <p className="mt-1">Código único <strong>{String(d.processo?.codigo)}</strong> · Processo SEI {String(d.processo?.numero_sei ?? '—')} · emitido em {formatarData(hoje)}</p>

      <Secao titulo="1. Decisão / requisição">
        <p>{ORIGENS.find((o) => o.valor === demanda.origem)?.rotulo} nº {String(demanda.numero_processo_origem)} — {String(demanda.orgao ?? '')}, comarca de {String(demanda.comarca)}.</p>
        <p>Ciência: {formatarData(demanda.data_ciencia)} · Prazo de cumprimento: {formatarData(demanda.prazo_judicial)}</p>
        <p className="mt-1 text-slate-700">{String(demanda.decisao_resumo ?? '')}</p>
      </Secao>

      <Secao titulo="2. Estudante(s) atendido(s)">
        <ul className="list-disc pl-5">
          {d.alunosDemanda.map((a) => {
            const al = achar('alunos', a.aluno_id)
            return <li key={a.id}>{String(al?.nome)} — matrícula SIMADE {String(al?.cod_simade)}</li>
          })}
        </ul>
      </Secao>

      <Secao titulo="3. Cumprimento">
        <p>
          Início efetivo do transporte: <strong>{formatarData(demanda.data_inicio_transporte) || 'não informado'}</strong>
          {Boolean(demanda.data_inicio_transporte) && (cumpriuPrazo ? ' — dentro do prazo determinado.' : ' — após o prazo determinado.')}
        </p>
        {contrato && s && (
          <p className="mt-1">
            Contrato nº {String(contrato.numero)} firmado pela {String(achar('caixas_escolares', contrato.caixa_escolar_id)?.razao_social ?? 'Caixa Escolar')} com {String(achar('transportadores', contrato.transportador_id)?.razao_social ?? '')}, vigência {formatarData(contrato.vigencia_inicio)} a {formatarData(s.vigencia_fim_atual)}, valor {formatarMoeda(s.valor_atual)} ({s.pct_executado.toFixed(0)}% executado).
          </p>
        )}
        {d.fiscalizacoes.length > 0 && (
          <p className="mt-1">
            Fiscalização: {d.fiscalizacoes.length} mês(es) registrados, {d.fiscalizacoes.reduce((t, f) => t + Number(f.dias_rodados || 0), 0)} dias de transporte realizados.
          </p>
        )}
        {d.prestacoes.map((p) => (
          <p key={p.id}>Prestação de contas {String(p.periodo_referencia)}: {ROTULO_STATUS_PRESTACAO[String(p.status)]}.</p>
        ))}
      </Secao>

      <Secao titulo="4. Cronologia do atendimento">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b"><th className="py-1">Etapa</th><th>Início</th><th>Conclusão</th></tr></thead>
          <tbody>
            {modelos.map((m) => {
              const e = d.etapas.find((x) => x.etapa_modelo_id === m.id)
              return e ? (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-1">{String(m.ordem)}. {String(m.nome)}</td>
                  <td>{formatarData(e.iniciada_em)}</td>
                  <td>{e.concluida_em ? formatarData(e.concluida_em) : 'em andamento'}</td>
                </tr>
              ) : null
            })}
          </tbody>
        </table>
      </Secao>

      <Secao titulo="5. Evidências (documentos no repositório)">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b"><th className="py-1">Documento</th><th>Nº SEI</th><th>Data</th><th>Versão</th></tr></thead>
          <tbody>
            {[...d.documentos].sort((a, b) => String(a.data_documento).localeCompare(String(b.data_documento))).map((doc) => (
              <tr key={doc.id} className="border-b border-slate-100">
                <td className="py-1">{String(achar('tipos_documento', doc.tipo_documento_id)?.nome)}</td>
                <td>{String(doc.numero_sei ?? '—')}</td>
                <td>{formatarData(doc.data_documento)}</td>
                <td>v{String(doc.versao_atual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Secao>
      <p className="mt-8 text-xs text-slate-500">Documento gerado pelo sistema de Transporte Escolar (modo demonstração — dados fictícios).</p>
    </div>
  )
}
