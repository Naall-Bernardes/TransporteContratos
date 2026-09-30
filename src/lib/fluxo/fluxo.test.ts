import { describe, expect, it } from 'vitest'
import type { Registro } from '../dados/tipos'
import { avaliarChecklist, condicoesAtivas, documentosFaltantes } from './checklist'
import { calcularSemaforo, prazoDaEtapa } from './sla'

const feriados = new Set(['2026-10-12'])
const r = (c: Record<string, unknown>) => ({ id: crypto.randomUUID(), ...c }) as Registro

describe('SLA e semáforo', () => {
  it('prazo da etapa em dias úteis', () => {
    expect(prazoDaEtapa('2026-10-08', 5, feriados)).toBe('2026-10-16')
    expect(prazoDaEtapa('2026-10-08', null, feriados)).toBeNull()
  })

  it('usa o menor prazo entre judicial e etapa', () => {
    const s = calcularSemaforo({ prazoJudicial: '2026-10-14', prazoEtapa: '2026-10-20' }, '2026-10-08', feriados)
    expect(s.origem).toBe('judicial')
    expect(s.dias_uteis).toBe(3) // 09, 13, 14
    expect(s.cor).toBe('amarelo')
  })

  it('verde com folga, vermelho vencido, cinza encerrado', () => {
    expect(calcularSemaforo({ prazoEtapa: '2026-10-30' }, '2026-10-08', feriados).cor).toBe('verde')
    expect(calcularSemaforo({ prazoEtapa: '2026-10-07' }, '2026-10-08', feriados).cor).toBe('vermelho')
    expect(calcularSemaforo({ prazoEtapa: '2026-10-07', encerrado: true }, '2026-10-08', feriados).cor).toBe('cinza')
  })

  it('prazo judicial deixa de contar quando o transporte começou', () => {
    const s = calcularSemaforo({ prazoJudicial: '2026-10-01', inicioTransporte: '2026-09-28', prazoEtapa: '2026-10-30' }, '2026-10-08', feriados)
    expect(s.origem).toBe('etapa')
    expect(s.cor).toBe('verde')
  })

  it('escalonamento: 1 a vencer, 2 vencida, 3 vencida há mais de 3 dias úteis ou prazo judicial vencido', () => {
    expect(calcularSemaforo({ prazoEtapa: '2026-10-09' }, '2026-10-08', feriados).nivel).toBe(1)
    expect(calcularSemaforo({ prazoEtapa: '2026-10-07' }, '2026-10-08', feriados).nivel).toBe(2)
    expect(calcularSemaforo({ prazoEtapa: '2026-10-01' }, '2026-10-08', feriados).nivel).toBe(3)
    expect(calcularSemaforo({ prazoJudicial: '2026-10-07', prazoEtapa: '2026-10-30' }, '2026-10-08', feriados).nivel).toBe(3)
  })
})

describe('checklist condicional', () => {
  const tipos = [r({ id: 'laudo', nome: 'Laudo' }), r({ id: 'matricula', nome: 'Matrícula' }), r({ id: 'cot', nome: 'Cotação' })]
  const modelos = [
    r({ tipo_documento_id: 'matricula', condicao: 'sempre' }),
    r({ tipo_documento_id: 'laudo', condicao: 'se_pcd' }),
  ]

  it('laudo só é exigido se o estudante for PcD', () => {
    const semPcd = condicoesAtivas({ caracterizacoes: [], saude: [r({ pcd_mobilidade_reduzida: false })] })
    const comPcd = condicoesAtivas({ caracterizacoes: [], saude: [r({ pcd_mobilidade_reduzida: true })] })
    expect(documentosFaltantes(avaliarChecklist(modelos, tipos, [], semPcd)).map((i) => i.nome)).toEqual(['Matrícula'])
    expect(documentosFaltantes(avaliarChecklist(modelos, tipos, [], comPcd)).map((i) => i.nome)).toEqual(['Matrícula', 'Laudo'])
  })

  it('documento enviado atende o item', () => {
    const ativas = condicoesAtivas({ caracterizacoes: [], saude: [] })
    const itens = avaliarChecklist(modelos, tipos, [r({ tipo_documento_id: 'matricula' })], ativas)
    expect(documentosFaltantes(itens)).toHaveLength(0)
  })
})
