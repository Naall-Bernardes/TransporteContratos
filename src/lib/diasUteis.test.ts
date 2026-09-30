import { describe, expect, it } from 'vitest'
import { diasUteisEntre, ehDiaUtil, somarDiasUteis } from './diasUteis'

// Out/2026: 12/10 (segunda) é feriado nacional.
const feriados = new Set(['2026-10-12'])

describe('dias úteis', () => {
  it('sábado, domingo e feriado não são dias úteis', () => {
    expect(ehDiaUtil('2026-10-10', feriados)).toBe(false) // sábado
    expect(ehDiaUtil('2026-10-11', feriados)).toBe(false) // domingo
    expect(ehDiaUtil('2026-10-12', feriados)).toBe(false) // feriado
    expect(ehDiaUtil('2026-10-13', feriados)).toBe(true)
  })

  it('soma 5 dias úteis pulando fim de semana e feriado', () => {
    // quinta 08/10 → 09 (1), 13 (2), 14 (3), 15 (4), 16 (5)
    expect(somarDiasUteis('2026-10-08', 5, feriados)).toBe('2026-10-16')
  })

  it('conta dias úteis entre datas, negativo quando vencido', () => {
    expect(diasUteisEntre('2026-10-08', '2026-10-16', feriados)).toBe(5)
    expect(diasUteisEntre('2026-10-16', '2026-10-08', feriados)).toBe(-5)
    expect(diasUteisEntre('2026-10-08', '2026-10-08', feriados)).toBe(0)
  })
})
