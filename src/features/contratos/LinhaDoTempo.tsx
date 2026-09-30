import type { EventoLinhaTempo } from '@/lib/contratos/calculos'
import { formatarData } from '@/lib/formatacao'

const COR: Record<EventoLinhaTempo['categoria'], string> = {
  instrumento: 'bg-marca-600',
  aditivo: 'bg-purple-600',
  financeiro: 'bg-green-600',
  fiscalizacao: 'bg-sky-500',
  ocorrencia: 'bg-red-500',
  prestacao: 'bg-amber-500',
  encerramento: 'bg-slate-600',
}

const ROTULO: Record<EventoLinhaTempo['categoria'], string> = {
  instrumento: 'Instrumento',
  aditivo: 'Aditivo',
  financeiro: 'Financeiro',
  fiscalizacao: 'Fiscalização',
  ocorrencia: 'Ocorrência',
  prestacao: 'Prestação de contas',
  encerramento: 'Encerramento',
}

export function LinhaDoTempo({ eventos, hoje }: { eventos: EventoLinhaTempo[]; hoje: string }) {
  if (eventos.length === 0) return <p className="text-sm text-slate-500">Nenhum evento.</p>
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-600">
        {Object.entries(ROTULO).map(([k, r]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${COR[k as EventoLinhaTempo['categoria']]}`} /> {r}
          </span>
        ))}
      </div>
      <ol className="relative border-l border-slate-200">
        {eventos.map((e, i) => (
          <li key={i} className="mb-4 ml-4">
            <span className={`absolute -left-1.5 mt-1.5 size-3 rounded-full ring-2 ring-white ${COR[e.categoria]}`} />
            <p className="text-xs text-slate-500">
              {formatarData(e.data)}
              {e.data > hoje && ' (futuro)'}
            </p>
            <p className="text-sm font-medium text-slate-900">{e.titulo}</p>
            {e.detalhe && <p className="text-sm text-slate-600">{e.detalhe}</p>}
          </li>
        ))}
      </ol>
    </div>
  )
}
