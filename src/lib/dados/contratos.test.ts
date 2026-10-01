import { beforeEach, describe, expect, it } from 'vitest'
import { hojeIso } from '../diasUteis'
import { carregarBase, restaurarDemonstracao } from './armazenamento'
import { ErroValidacao, excluir, listar, salvar } from './repositorio'
import type { Usuario } from './tipos'

let base = restaurarDemonstracao()
beforeEach(() => {
  base = restaurarDemonstracao()
})

const usuario = (email: string) => base.colecoes.usuarios.find((u) => u.email === email) as Usuario
const central = () => usuario('central@demo.exemplo')
const instrumento = (numero: string, trechoObjeto = '') =>
  base.colecoes.instrumentos.find((i) => i.numero === numero && String(i.objeto).includes(trechoObjeto))!

async function erros(promessa: Promise<unknown>): Promise<Record<string, string>> {
  try {
    await promessa
  } catch (e) {
    if (e instanceof ErroValidacao) return e.erros
    throw e
  }
  throw new Error('Esperava erro de validação')
}

describe('instrumentos', () => {
  it('ao cadastrar, gera o processo com código único JUD-ano-SRE-seq', async () => {
    const caixa = base.colecoes.caixas_escolares[0]
    const inst = await salvar(
      'instrumentos',
      {
        tipo: 'contrato_caixa',
        numero: '099/2026',
        numero_sei: '1260.01.0009999/2026-01',
        caixa_escolar_id: caixa.id,
        transportador_id: base.colecoes.transportadores[0].id,
        objeto: 'Teste',
        data_assinatura: '2026-09-01',
        vigencia_inicio: '2026-09-01',
        vigencia_fim: '2026-12-31',
        valor_global: 1000,
        dotacao_orcamentaria: 'x',
        gestor_id: central().id,
        fiscal_id: central().id,
        status: 'vigente',
      },
      central(),
    )
    const processo = carregarBase().colecoes.processos.find((p) => p.id === inst.processo_id)!
    const escola = base.colecoes.escolas.find((e) => e.id === caixa.escola_id)!
    const sigla = base.colecoes.sres.find((s) => s.id === escola.sre_id)!.sigla
    expect(processo.codigo).toMatch(new RegExp(`^JUD-2026-${sigla}-\\d{4}$`))
    expect(inst.sre_id).toBe(escola.sre_id)
  })

  it('analista SRE vê só os instrumentos da sua regional', async () => {
    const udi = usuario('analista.udi@demo.exemplo')
    const lista = await listar('instrumentos', udi)
    expect(lista).toHaveLength(4) // contratos 001, 002 e 004 + termo PTE de Uberlândia 2027
    expect(lista.every((i) => i.sre_id === udi.sre_id)).toBe(true)
    const parcelas = await listar('parcelas', udi)
    const ids = new Set(lista.map((i) => i.id))
    expect(parcelas.every((p) => ids.has(p.instrumento_id as string))).toBe(true)
  })

  it('executado manual não pode passar do valor; garantia exige valor', async () => {
    const c = instrumento('001/2026', '2 estudantes')
    const e1 = await erros(salvar('instrumentos', { id: c.id, valor_executado: Number(c.valor_global) + 1 }, central()))
    expect(e1.valor_executado).toMatch(/passa do valor/)
    const e2 = await erros(salvar('instrumentos', { id: c.id, tipo_garantia: 'seguro_garantia' }, central()))
    expect(e2.valor_garantia).toBe('Informe o valor da garantia.')
    const ok = await salvar('instrumentos', { id: c.id, valor_executado: 1000, tipo_garantia: 'seguro_garantia', valor_garantia: 500 }, central())
    expect(ok.valor_executado).toBe(1000)
  })

  it('não exclui instrumento com lançamentos vinculados', async () => {
    await expect(excluir('instrumentos', instrumento('001/2026', '2 estudantes').id, central())).rejects.toThrow(
      /usado em outros cadastros/,
    )
  })
})

describe('aditivos', () => {
  it('recusa aditivo assinado depois do vencimento (contrato extinto)', async () => {
    const vencido = instrumento('002/2026')
    const e = await erros(
      salvar(
        'aditivos',
        { instrumento_id: vencido.id, numero: 1, data_assinatura: hojeIso(), documento_sei: 'x', altera_prazo: true, nova_vigencia_fim: '2099-12-31' },
        central(),
      ),
    )
    expect(e.data_assinatura).toMatch(/após o fim da vigência/)
  })

  it('exige ao menos um objeto (prazo, valor ou rota)', async () => {
    const e = await erros(
      salvar('aditivos', { instrumento_id: instrumento('003/2026').id, numero: 1, data_assinatura: hojeIso(), documento_sei: 'x' }, central()),
    )
    expect(e._geral).toMatch(/ao menos um objeto/)
  })

  it('recusa supressão que deixa valor abaixo do executado', async () => {
    const vencido = instrumento('002/2026') // 60 mil, 100% pago
    const e = await erros(
      salvar(
        'aditivos',
        {
          instrumento_id: vencido.id,
          numero: 1,
          data_assinatura: String(vencido.vigencia_inicio),
          documento_sei: 'x',
          altera_valor: true,
          valor_variacao: -1000,
        },
        central(),
      ),
    )
    expect(e.valor_variacao).toMatch(/abaixo do já executado/)
  })
})

describe('execução financeira', () => {
  it('recusa pagamento acima do saldo contratual', async () => {
    const quitado = instrumento('002/2026')
    const e = await erros(
      salvar(
        'parcelas',
        { instrumento_id: quitado.id, numero: 99, competencia: '2026-09', valor_previsto: 100, data_prevista: hojeIso(), valor_pago: 100, data_pagamento: hojeIso() },
        central(),
      ),
    )
    expect(e.valor_pago).toMatch(/excede o saldo/)
  })

  it('instrumento encerrado não aceita novos lançamentos', async () => {
    const encerrado = base.colecoes.instrumentos.find((i) => i.status === 'encerrado')!
    const e = await erros(
      salvar('parcelas', { instrumento_id: encerrado.id, numero: 9, competencia: '2026-01', valor_previsto: 1, data_prevista: hojeIso() }, central()),
    )
    expect(e._geral).toMatch(/encerrado/)
  })
})

describe('prestação de contas (ciclo único de diligência)', () => {
  it('fluxo completo: pendente → em análise → diligência → reapresentada → aprovada', async () => {
    const inst = instrumento('003/2026')
    let pc = await salvar('prestacoes_contas', { instrumento_id: inst.id, periodo_referencia: 'teste', data_limite: '2026-12-01', status: 'pendente' }, central())
    pc = await salvar('prestacoes_contas', { id: pc.id, status: 'em_analise', data_entrega: '2026-11-20' }, central())
    pc = await salvar(
      'prestacoes_contas',
      { id: pc.id, status: 'em_diligencia', diligencia_data: '2026-11-25', diligencia_prazo: '2026-12-10', diligencia_descricao: 'x' },
      central(),
    )
    pc = await salvar('prestacoes_contas', { id: pc.id, status: 'reapresentada', reapresentada_em: '2026-12-05' }, central())
    const e = await erros(salvar('prestacoes_contas', { id: pc.id, status: 'em_diligencia' }, central()))
    expect(e._geral).toMatch(/ciclo único/)
    pc = await salvar(
      'prestacoes_contas',
      { id: pc.id, status: 'aprovada_ressalvas', data_decisao: '2026-12-15', analista_id: central().id, parecer: 'ok' },
      central(),
    )
    expect(pc.status).toBe('aprovada_ressalvas')
  })

  it('não pula etapas (pendente → aprovada)', async () => {
    const pendente = base.colecoes.prestacoes_contas.find((p) => p.status === 'pendente')!
    const e = await erros(
      salvar('prestacoes_contas', { id: pendente.id, status: 'aprovada', data_decisao: '2026-12-15', analista_id: central().id, parecer: 'x' }, central()),
    )
    expect(e._geral).toMatch(/não permitida/)
  })
})
