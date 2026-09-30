// Barras horizontais de uma série (uma cor só, valor escrito ao lado, dica ao passar o mouse).
// Opcional: marcador de referência por barra (ex.: SLA), desenhado como traço vertical.

export interface ItemBarra {
  rotulo: string
  valor: number
  /** Texto do valor (default: número formatado). */
  texto?: string
  /** Valor de referência (ex.: SLA) — traço vertical sobre a barra. */
  referencia?: number | null
  /** Destaca a barra (ex.: acima do SLA). */
  destaque?: boolean
}

export function BarrasHorizontais({ itens, rotuloReferencia, vazio = 'Sem dados.' }: { itens: ItemBarra[]; rotuloReferencia?: string; vazio?: string }) {
  if (itens.length === 0) return <p className="text-sm text-slate-500">{vazio}</p>
  const max = Math.max(...itens.map((i) => Math.max(i.valor, i.referencia ?? 0)), 1)
  return (
    <div>
      <ul className="space-y-2">
        {itens.map((i) => (
          <li key={i.rotulo} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,16rem)_1fr]">
            <span className="truncate text-slate-700" title={i.rotulo}>{i.rotulo}</span>
            <span className="relative flex items-center gap-2" title={`${i.rotulo}: ${i.texto ?? i.valor.toLocaleString('pt-BR')}${i.referencia ? ` (${rotuloReferencia ?? 'referência'}: ${i.referencia})` : ''}`}>
              <span className="relative h-4 flex-1">
                <span
                  className={`absolute inset-y-0 left-0 rounded-r ${i.destaque ? 'bg-orange-500' : 'bg-marca-600'}`}
                  style={{ width: `${(i.valor / max) * 100}%`, minWidth: i.valor > 0 ? 3 : 0 }}
                />
                {i.referencia ? <span className="absolute -inset-y-1 w-0.5 bg-slate-800" style={{ left: `${(i.referencia / max) * 100}%` }} /> : null}
              </span>
              <span className={`w-20 shrink-0 text-right tabular-nums ${i.destaque ? 'font-medium text-orange-700' : 'text-slate-700'}`}>{i.texto ?? i.valor.toLocaleString('pt-BR')}</span>
            </span>
          </li>
        ))}
      </ul>
      {rotuloReferencia && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-3 w-0.5 bg-slate-800" /> {rotuloReferencia} · <span className="inline-block h-2 w-3 rounded-r bg-orange-500" /> acima da referência
        </p>
      )}
    </div>
  )
}
