// Visão compacta do fluxo (usada na adesão PTE): sequência de etapas + etapa atual + histórico.

import { CheckCircle2, Circle, CircleDot } from 'lucide-react'
import { useMemo } from 'react'
import type { Referencias } from '@/features/cadastros/exibicao'
import type { Colecao } from '@/lib/dados/tipos'
import { etapaAtual, montarDadosProcesso } from '@/lib/fluxo/processo'
import { formatarData } from '@/lib/formatacao'
import { EtapaDetalhe, HistoricoEtapas } from './Etapas'

interface Props {
  processoId: string
  modulo: 'JUDICIAL' | 'PTE'
  dados: Referencias
  aoAlterar: () => Promise<void>
  alunos?: { id: string; nome: string }[]
}

export function PainelEtapas({ processoId, modulo, dados, aoAlterar, alunos }: Props) {
  const lista = (c: Colecao) => dados[c] ?? []
  const modelos = lista('etapas_modelo').filter((m) => m.modulo === modulo).sort((a, b) => Number(a.ordem) - Number(b.ordem))
  const d = useMemo(() => montarDadosProcesso((c) => dados[c] ?? [], processoId), [dados, processoId])
  const { modelo } = etapaAtual(d, modelos)

  return (
    <div className="space-y-4">
      <ol className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
        {modelos.map((m) => {
          const e = d.etapas.find((x) => x.etapa_modelo_id === m.id)
          const status = e?.status ?? 'nao_iniciada'
          const Icone = status === 'concluida' ? CheckCircle2 : status === 'em_andamento' ? CircleDot : Circle
          const cor = status === 'concluida' ? 'text-green-600' : status === 'em_andamento' ? 'text-marca-600' : 'text-slate-300'
          return (
            <li key={m.id} className={`min-w-28 flex-1 rounded-md px-2 py-1.5 ${status === 'em_andamento' ? 'bg-marca-50 ring-1 ring-marca-100' : ''}`}>
              <div className="flex items-center gap-1.5">
                <Icone size={16} className={cor} />
                <span className="text-xs font-semibold text-slate-500">{String(m.ordem)}</span>
              </div>
              <p className="mt-0.5 text-xs leading-tight text-slate-800">{String(m.nome)}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {status === 'concluida' ? `✓ ${formatarData(e!.concluida_em)}` : status === 'em_andamento' ? (e!.prazo_sla ? `prazo ${formatarData(e!.prazo_sla)}` : 'contínua') : ''}
              </p>
            </li>
          )
        })}
      </ol>
      {modelo ? (
        <EtapaDetalhe processoId={processoId} modelo={modelo} dados={dados} aoAlterar={aoAlterar} alunos={alunos} />
      ) : (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Todas as etapas foram concluídas.</p>
      )}
      <HistoricoEtapas processoId={processoId} modulo={modulo} dados={dados} />
    </div>
  )
}
