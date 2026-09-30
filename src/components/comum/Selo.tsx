import type { FaixaVigencia, SituacaoPrazoPrestacao } from '@/lib/contratos/calculos'

type Cor = 'verde' | 'amarelo' | 'laranja' | 'vermelho' | 'cinza' | 'azul'

const CORES: Record<Cor, string> = {
  verde: 'bg-green-100 text-green-800 ring-green-600/20',
  amarelo: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  laranja: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  vermelho: 'bg-red-100 text-red-800 ring-red-600/20',
  cinza: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  azul: 'bg-blue-100 text-blue-800 ring-blue-600/20',
}

export function Selo({ cor, children }: { cor: Cor; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${CORES[cor]}`}>
      {children}
    </span>
  )
}

export const FAIXA: Record<FaixaVigencia, { rotulo: string; cor: Cor }> = {
  vigente: { rotulo: 'Vigente', cor: 'verde' },
  nao_iniciado: { rotulo: 'Não iniciado', cor: 'azul' },
  ate_90: { rotulo: 'Vence em até 90 dias', cor: 'amarelo' },
  ate_60: { rotulo: 'Vence em até 60 dias', cor: 'laranja' },
  ate_30: { rotulo: 'Vence em até 30 dias', cor: 'vermelho' },
  vencido: { rotulo: 'Vencido', cor: 'vermelho' },
  encerrado: { rotulo: 'Encerrado', cor: 'cinza' },
}

export function SeloVigencia({ faixa }: { faixa: FaixaVigencia }) {
  return <Selo cor={FAIXA[faixa].cor}>{FAIXA[faixa].rotulo}</Selo>
}

export const PRAZO_PRESTACAO: Record<SituacaoPrazoPrestacao, { rotulo: string; cor: Cor }> = {
  entregue: { rotulo: 'Entregue', cor: 'verde' },
  no_prazo: { rotulo: 'No prazo', cor: 'azul' },
  a_vencer: { rotulo: 'A vencer', cor: 'amarelo' },
  vencida: { rotulo: 'Atrasada', cor: 'vermelho' },
}

const COR_STATUS_PRESTACAO: Record<string, Cor> = {
  pendente: 'cinza',
  em_analise: 'azul',
  em_diligencia: 'laranja',
  reapresentada: 'azul',
  aprovada: 'verde',
  aprovada_ressalvas: 'amarelo',
  reprovada: 'vermelho',
}

export function SeloStatusPrestacao({ status, rotulo }: { status: string; rotulo: string }) {
  return <Selo cor={COR_STATUS_PRESTACAO[status] ?? 'cinza'}>{rotulo}</Selo>
}
