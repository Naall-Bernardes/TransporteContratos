// Alertas de um instrumento: vigência (90/60/30/vencido), limite de acréscimos,
// saldo baixo, prestação de contas e ocorrências. Base dos futuros e-mails (Fase 6).

import type { Registro } from '../dados/tipos'
import { formatarData } from '../formatacao'
import { diasCorridos, situacaoPrazoPrestacao, type SituacaoInstrumento } from './calculos'

export interface Alerta {
  nivel: 'critico' | 'atencao'
  texto: string
}

export const LIMITE_ACRESCIMOS_PCT = 25
export const SALDO_BAIXO_PCT = 10

export function alertasInstrumento(
  s: SituacaoInstrumento,
  prestacoes: Registro[],
  ocorrencias: Registro[],
  hoje: string,
): Alerta[] {
  const a: Alerta[] = []
  if (s.faixa === 'encerrado') return a
  const fim = formatarData(s.vigencia_fim_atual)

  if (s.faixa === 'vencido')
    a.push({ nivel: 'critico', texto: `Vigência terminou em ${fim} sem aditivo de prorrogação. Verifique se o transporte continua sem cobertura contratual.` })
  else if (s.faixa === 'ate_30' || s.faixa === 'ate_60' || s.faixa === 'ate_90')
    a.push({ nivel: s.faixa === 'ate_30' ? 'critico' : 'atencao', texto: `Vence em ${s.dias_para_vencer} dias (${fim}).` })

  if (s.pct_acrescimos > LIMITE_ACRESCIMOS_PCT)
    a.push({ nivel: 'atencao', texto: `Acréscimos somam ${s.pct_acrescimos.toFixed(1)}% do valor original (referência usual: até ${LIMITE_ACRESCIMOS_PCT}%).` })

  if (s.valor_atual > 0 && s.saldo / s.valor_atual < SALDO_BAIXO_PCT / 100 && s.faixa !== 'vencido')
    a.push({ nivel: 'atencao', texto: `Saldo contratual abaixo de ${SALDO_BAIXO_PCT}% do valor.` })

  for (const p of prestacoes) {
    const sit = situacaoPrazoPrestacao(p, hoje)
    if (sit === 'vencida')
      a.push({ nivel: 'critico', texto: `Prestação de contas "${p.periodo_referencia}" não entregue: prazo venceu em ${formatarData(p.data_limite)}.` })
    else if (sit === 'a_vencer')
      a.push({ nivel: 'atencao', texto: `Prestação de contas "${p.periodo_referencia}" vence em ${formatarData(p.data_limite)}.` })
    if (p.status === 'em_diligencia' && p.diligencia_prazo && String(p.diligencia_prazo) < hoje)
      a.push({ nivel: 'critico', texto: `Diligência da prestação "${p.periodo_referencia}" sem resposta: prazo venceu em ${formatarData(p.diligencia_prazo)}.` })
  }

  for (const o of ocorrencias) {
    if (o.status === 'resolvida') continue
    if (o.gravidade === 'alta') a.push({ nivel: 'critico', texto: `Ocorrência grave em aberto: ${o.titulo}.` })
    if (o.notificacao_prazo && !o.notificacao_respondida_em && diasCorridos(hoje, String(o.notificacao_prazo)) < 0)
      a.push({ nivel: 'atencao', texto: `Notificação sem resposta do contratado (prazo ${formatarData(o.notificacao_prazo)}): ${o.titulo}.` })
  }
  return a
}
