import { beforeEach, describe, expect, it } from 'vitest'
import { restaurarDemonstracao } from './armazenamento'
import { ErroPermissao, ErroValidacao, excluir, listar, listarAuditoria, salvar } from './repositorio'
import type { Usuario } from './tipos'

let base = restaurarDemonstracao()

const usuario = async (email: string) => base.colecoes.usuarios.find((u) => u.email === email) as Usuario

beforeEach(() => {
  base = restaurarDemonstracao()
})

describe('permissões por SRE (futuro RLS)', () => {
  it('analista SRE vê só escolas e alunos da própria regional', async () => {
    const udi = await usuario('analista.udi@demo.exemplo')
    const escolas = await listar('escolas', udi)
    expect(escolas.length).toBe(2)
    expect(escolas.every((e) => e.sre_id === udi.sre_id)).toBe(true)
    const alunos = await listar('alunos', udi)
    const idsEscolas = new Set(escolas.map((e) => e.id))
    expect(alunos.every((a) => idsEscolas.has(a.escola_atual_id as string))).toBe(true)
  })

  it('órgão central vê todas as escolas', async () => {
    const central = await usuario('central@demo.exemplo')
    expect((await listar('escolas', central)).length).toBe(6)
  })

  it('analista SRE não cadastra aluno em escola de outra SRE', async () => {
    const udi = await usuario('analista.udi@demo.exemplo')
    const escolaMoc = base.colecoes.escolas.find((e) => String(e.nome).includes('Serra Verde'))!
    await expect(
      salvar('alunos', { nome: 'Teste', cod_simade: '1', data_nascimento: '2015-01-01', escola_atual_id: escolaMoc.id }, udi),
    ).rejects.toBeInstanceOf(ErroPermissao)
  })

  it('analista SRE não altera cadastro de escolas', async () => {
    const udi = await usuario('analista.udi@demo.exemplo')
    const escola = (await listar('escolas', udi))[0]
    await expect(salvar('escolas', { ...escola, nome: 'Outro' }, udi)).rejects.toBeInstanceOf(ErroPermissao)
  })

  it('só o administrador altera usuários', async () => {
    const central = await usuario('central@demo.exemplo')
    await expect(salvar('usuarios', { nome: 'X', email: 'x@x.com', papel: 'admin' }, central)).rejects.toBeInstanceOf(
      ErroPermissao,
    )
  })
})

describe('integridade (futuras restrições do banco)', () => {
  it('recusa sigla de SRE repetida ou fora do padrão', async () => {
    const admin = await usuario('admin@demo.exemplo')
    await expect(salvar('sres', { sigla: 'udi', nome: 'Duplicada' }, admin)).rejects.toMatchObject({
      erros: { sigla: 'Já existe SRE com esta sigla.' },
    })
    await expect(salvar('sres', { sigla: 'AB', nome: 'Curta' }, admin)).rejects.toBeInstanceOf(ErroValidacao)
  })

  it('recusa preço de referência com vigência sobreposta', async () => {
    const central = await usuario('central@demo.exemplo')
    const existente = base.colecoes.precos_referencia[0]
    await expect(
      salvar('precos_referencia', { ...existente, id: undefined, vigencia_inicio: '2026-06-01', vigencia_fim: null }, central),
    ).rejects.toMatchObject({ erros: { vigencia_inicio: expect.stringContaining('Já existe preço vigente') } })
  })

  it('escola herda a SRE do município', async () => {
    const central = await usuario('central@demo.exemplo')
    const bh = base.colecoes.municipios.find((m) => m.nome === 'Belo Horizonte')!
    const escola = await salvar('escolas', { cod_inep: '31999999', nome: 'Nova', municipio_id: bh.id }, central)
    expect(escola.sre_id).toBe(bh.sre_id)
  })

  it('impede excluir registro em uso', async () => {
    const central = await usuario('central@demo.exemplo')
    const escola = base.colecoes.escolas[0]
    await expect(excluir('escolas', escola.id, central)).rejects.toBeInstanceOf(ErroPermissao)
  })
})

describe('auditoria', () => {
  it('registra inclusão e alteração com valores antes/depois', async () => {
    const central = await usuario('central@demo.exemplo')
    const criado = await salvar('tipos_veiculo', { nome: 'Caminhonete', capacidade: 5 }, central)
    await salvar('tipos_veiculo', { ...criado, capacidade: 6 }, central)
    const log = await listarAuditoria(central)
    expect(log[0]).toMatchObject({ operacao: 'UPDATE', antes: { capacidade: 5 }, depois: { capacidade: 6 } })
    expect(log[1]).toMatchObject({ operacao: 'INSERT', antes: null, usuario_nome: central.nome })
  })

  it('não registra alteração quando nada mudou', async () => {
    const central = await usuario('central@demo.exemplo')
    const tipo = base.colecoes.tipos_veiculo[0]
    await salvar('tipos_veiculo', { ...tipo }, central)
    expect(await listarAuditoria(central)).toHaveLength(0)
  })
})
