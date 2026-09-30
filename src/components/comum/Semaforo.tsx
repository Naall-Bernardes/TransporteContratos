import { ROTULO_NIVEL, type CorSemaforo, type Semaforo as TSemaforo } from '@/lib/fluxo/sla'

const COR: Record<CorSemaforo, string> = {
  verde: 'bg-green-500',
  amarelo: 'bg-amber-400',
  vermelho: 'bg-red-500',
  cinza: 'bg-slate-400',
}

export const ROTULO_COR: Record<CorSemaforo, string> = {
  verde: 'No prazo',
  amarelo: 'A vencer',
  vermelho: 'Vencido',
  cinza: 'Encerrado',
}

export function PontoSemaforo({ cor }: { cor: CorSemaforo }) {
  return <span className={`inline-block size-3 shrink-0 rounded-full ${COR[cor]}`} aria-label={ROTULO_COR[cor]} title={ROTULO_COR[cor]} />
}

export function Semaforo({ semaforo, compacto }: { semaforo: TSemaforo; compacto?: boolean }) {
  return (
    <span className="inline-flex items-start gap-2">
      <PontoSemaforo cor={semaforo.cor} />
      <span className="text-sm leading-tight">
        <span className="font-medium">{ROTULO_COR[semaforo.cor]}</span>
        {!compacto && <span className="block text-xs text-slate-500">{semaforo.texto}</span>}
        {!compacto && semaforo.nivel > 0 && <span className="block text-xs font-medium text-orange-700">Escalonamento: {ROTULO_NIVEL[semaforo.nivel]}</span>}
      </span>
    </span>
  )
}
