import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-marca-600 text-white hover:bg-marca-700',
  secundario: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'text-slate-600 hover:bg-slate-100',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
}

export function Botao({ variante = 'primario', className = '', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    />
  )
}
