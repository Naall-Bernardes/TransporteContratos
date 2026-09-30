import { describe, expect, it } from 'vitest'
import { restaurarDemonstracao } from './armazenamento'
import { validar } from './regras'
import { consultaDe } from './repositorio'
import { COLECOES, type Usuario } from './tipos'

describe('dados de demonstração', () => {
  it('todos os registros respeitam as regras de integridade', () => {
    const base = restaurarDemonstracao()
    const consulta = consultaDe(base)
    const admin = base.colecoes.usuarios.find((u) => u.papel === 'admin') as Usuario
    const problemas: string[] = []
    for (const colecao of COLECOES) {
      for (const r of base.colecoes[colecao]) {
        const erros = validar(colecao, r, base.colecoes[colecao], {
          consulta,
          irmaos: (c, id) => base.colecoes[c].filter((x) => x.instrumento_id === id && x.id !== r.id),
          lista: (c) => base.colecoes[c].filter((x) => x.id !== r.id),
          // valida como "registro já existente, alterado pelo administrador"
          anterior: colecao === 'documento_versoes' ? undefined : r,
          usuario: admin,
          usuarioEhAdmin: true,
        })
        for (const [campo, msg] of Object.entries(erros)) problemas.push(`${colecao}.${campo}: ${msg}`)
      }
    }
    expect([...new Set(problemas)]).toEqual([])
  })

  it('cada demanda e adesão tem exatamente uma etapa em andamento (exceto encerradas)', () => {
    const base = restaurarDemonstracao()
    for (const p of [...base.colecoes.demandas, ...base.colecoes.adesoes_pte]) {
      const abertas = base.colecoes.processo_etapas.filter((e) => e.processo_id === p.processo_id && e.status === 'em_andamento')
      const encerrado = p.situacao === 'cumprida' || p.status === 'encerrado'
      expect(abertas.length, String(p.id)).toBe(encerrado ? 0 : 1)
    }
  })
})
