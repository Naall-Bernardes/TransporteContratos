import type { ReactNode } from 'react'

interface Props {
  titulo: string
  valor: string | number
  detalhe?: ReactNode
  ativo?: boolean
  cor?: string
  onClick?: () => void
}

/** Cartão de indicador. Com `onClick`, funciona como filtro. */
export function Cartao({ titulo, valor, detalhe, ativo, cor, onClick }: Props) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left ${onClick ? 'transition-shadow hover:shadow-sm' : ''} ${ativo ? 'border-marca-600 ring-2 ring-marca-100' : 'border-slate-200'}`}
    >
      <p className={`text-2xl font-semibold tabular-nums ${cor ?? 'text-slate-900'}`}>{valor}</p>
      <p className="mt-1 text-sm text-slate-700">{titulo}</p>
      {detalhe && <div className="mt-0.5 text-xs text-slate-500">{detalhe}</div>}
    </Tag>
  )
}
