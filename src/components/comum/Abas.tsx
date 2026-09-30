export interface Aba<T extends string> {
  id: T
  rotulo: string
  qtd?: number
  alerta?: boolean
}

export function Abas<T extends string>({ abas, ativa, aoMudar }: { abas: Aba<T>[]; ativa: T; aoMudar: (id: T) => void }) {
  return (
    <div className="mt-6 overflow-x-auto overflow-y-hidden border-b border-slate-200">
      <nav className="flex gap-1">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => aoMudar(a.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${ativa === a.id ? 'border-marca-600 font-medium text-marca-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {a.rotulo}
            {a.qtd !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{a.qtd}</span>}
            {a.alerta && <span className="ml-1.5 inline-block size-2 rounded-full bg-red-500 align-middle" aria-label="pendência" />}
          </button>
        ))}
      </nav>
    </div>
  )
}
