import { beforeEach, describe, expect, it } from 'vitest'
import { hojeIso } from '../diasUteis'
import { carregarBase, restaurarDemonstracao } from './armazenamento'
import { ErroPermissao, ErroRegra, salvar, transacao } from './repositorio'
import { aprovarCiclo, calcularAdesao, concluirEtapa, criarDemanda, executarConciliacao, gerarCronograma, gerarPrestacoesPrevistas } from './servicos'
import { processarAlertas, verificarGatilhosDeRisco } from './servicosMonitoramento'
import type { Registro, Usuario } from './tipos'

beforeEach(() => {
  restaurarDemonstracao()
})

const b = () => carregarBase()
const usuario = (email: string) => b().colecoes.usuarios.find((u) => u.email === email) as Usuario
const central = () => usuario('central@demo.exemplo')
const etapaAberta = (processoId: unknown) => b().colecoes.processo_etapas.find((e) => e.processo_id === processoId && e.status === 'em_andamento')!
const codigoEtapa = (e: Registro) => b().colecoes.etapas_modelo.find((m) => m.id === e.etapa_modelo_id)!.codigo

describe('fluxo judicial', () => {
  it('criar demanda gera processo JUD-ano-SRE e abre a etapa 1 com prazo em dias úteis', async () => {
    const escola = b().colecoes.escolas.find((e) => String(e.nome).includes('Aurora'))!
    const dem = await criarDemanda(central(), {
      origem: 'judicial', numero_processo_origem: '123', comarca: 'Uberlândia', data_recebimento: hojeIso(), data_ciencia: hojeIso(), prazo_judicial: '2099-01-01', escola_id: escola.id, numero_sei: 'SEI-X',
    })
    const processo = b().colecoes.processos.find((p) => p.id === dem.processo_id)!
    expect(processo.codigo).toMatch(/^JUD-\d{4}-UDI-\d{4}$/)
    const etapa = etapaAberta(dem.processo_id)
    expect(codigoEtapa(etapa)).toBe('J01')
    expect(etapa.prazo_sla).toBeTruthy()
  })

  it('não conclui etapa com checklist incompleto sem justificativa; analista SRE não pode justificar; diretor pode', async () => {
    const dem = b().colecoes.demandas.find((d) => codigoEtapa(etapaAberta(d.processo_id)) === 'J01')!
    const etapa = etapaAberta(dem.processo_id)
    await expect(concluirEtapa(central(), etapa.id)).rejects.toThrow(/Checklist incompleto/)
    await expect(concluirEtapa(usuario('analista.udi@demo.exemplo'), etapa.id, 'urgente')).rejects.toBeInstanceOf(ErroPermissao)
    await concluirEtapa(usuario('dafi.udi@demo.exemplo'), etapa.id, 'Decisão recebida por e-mail do TJ; PDF será anexado.')
    const concluida = b().colecoes.processo_etapas.find((e) => e.id === etapa.id)!
    expect(concluida.status).toBe('concluida')
    expect(concluida.justificativa_avanco).toMatch(/PDF será anexado/)
    expect(codigoEtapa(etapaAberta(dem.processo_id))).toBe('J02')
  })

  it('requisito de dados não é dispensável (J05 sem PAF)', async () => {
    const dem = b().colecoes.demandas.find((d) => codigoEtapa(etapaAberta(d.processo_id)) === 'J05')!
    await expect(concluirEtapa(central(), etapaAberta(dem.processo_id).id, 'qualquer')).rejects.toBeInstanceOf(ErroRegra)
  })
})

describe('PTE', () => {
  it('conciliação mantém justificativas, cálculo exclui divergências abertas e aprovação é única', async () => {
    const ciclo = b().colecoes.ciclos_pte.find((c) => c.ano === 2027)!
    const [aUdi, aJan] = b().colecoes.adesoes_pte.filter((a) => a.ciclo_id === ciclo.id)
    await executarConciliacao(central(), aJan.id)
    const div = b().colecoes.divergencias.find((d) => d.adesao_id === aUdi.id && d.status === 'aberta')!
    await salvar('divergencias', { id: div.id, status: 'justificada', resolucao: 'Confirmado com a escola' }, central())
    await executarConciliacao(central(), aUdi.id)
    expect(b().colecoes.divergencias.find((d) => d.id === div.id)!.status).toBe('justificada')

    await expect(aprovarCiclo(central(), ciclo.id)).rejects.toThrow(/sem cálculo/)
    const calc = await calcularAdesao(central(), aUdi.id)
    const abertas = b().colecoes.divergencias.filter((d) => d.adesao_id === aUdi.id && d.status === 'aberta').length
    expect(Number(calc.qtd_alunos_validos)).toBeLessThan(12)
    expect(abertas).toBeGreaterThan(0)
    await calcularAdesao(central(), aJan.id)
    await expect(aprovarCiclo(usuario('analista.udi@demo.exemplo'), ciclo.id)).rejects.toBeInstanceOf(ErroPermissao)
    await aprovarCiclo(central(), ciclo.id)
    await expect(aprovarCiclo(central(), ciclo.id)).rejects.toThrow(/já foi aprovado/)
    await expect(calcularAdesao(central(), aUdi.id)).rejects.toThrow()
  })
})

describe('contratos: cronograma e prestações previstas', () => {
  it('gera parcelas que somam o valor restante e prestações por periodicidade', async () => {
    const inst = b().colecoes.instrumentos.find((i) => i.numero === '003/2026')!
    await transacao(central(), (tx) => {
      for (const p of tx.lista('parcelas').filter((x) => x.instrumento_id === inst.id && !x.valor_pago)) tx.excluir('parcelas', p.id)
    })
    await gerarCronograma(central(), inst.id, { qtd: 11, primeira_data: hojeIso(), intervalo_meses: 1 })
    const parcelas = b().colecoes.parcelas.filter((p) => p.instrumento_id === inst.id)
    expect(parcelas.reduce((s, p) => s + Number(p.valor_previsto), 0)).toBeCloseTo(Number(inst.valor_global), 2)

    await salvar('instrumentos', { id: inst.id, periodicidade_prestacao: 'semestral', prazo_prestacao_dias: 30 }, central())
    const criadas = await gerarPrestacoesPrevistas(central(), inst.id)
    expect(criadas).toBe(2)
    expect(await gerarPrestacoesPrevistas(central(), inst.id)).toBe(0) // não duplica
  })
})

describe('monitoramento', () => {
  it('gera alertas com escalonamento e não duplica; gatilhos de risco criam ocorrências automáticas', async () => {
    const n = await processarAlertas(central())
    expect(n).toBeGreaterThan(3)
    expect(await processarAlertas(central())).toBe(0)
    const judicial = b().colecoes.alertas.find((a) => a.tipo === 'prazo_judicial' && String(a.chave).endsWith('vencido'))!
    expect((judicial.destinatarios as string[]).some((d) => d.includes('central@'))).toBe(true)

    const r = await verificarGatilhosDeRisco(central())
    expect(r).toBeGreaterThan(3)
    const gatilhos = new Set(
      b().colecoes.risco_ocorrencias.filter((o) => o.origem === 'automatica').map((o) => String(o.chave_automatica).split('|')[0]),
    )
    expect(gatilhos).toContain('prazo_judicial_vencido')
    expect(gatilhos).toContain('contrato_vencido_sem_aditivo')
    expect(gatilhos).toContain('prestacao_vencida')
  })
})

describe('frota e conformidade legal', () => {
  it('recusa motorista com menos de 21 anos ou sem categoria D (CTB art. 138)', async () => {
    const t = b().colecoes.transportadores[0]
    const base = { funcao: 'motorista', nome: 'Teste', cpf: '52998224725', vinculo_tipo: 'transportador', transportador_id: t.id, cnh_numero: '1', cnh_validade: '2030-01-01' }
    await expect(salvar('condutores', { ...base, data_nascimento: '2010-01-01', cnh_categoria: 'D' }, central())).rejects.toMatchObject({ erros: { data_nascimento: expect.stringContaining('21 anos') } })
    await expect(salvar('condutores', { ...base, data_nascimento: '1990-01-01', cnh_categoria: 'B' }, central())).rejects.toMatchObject({ erros: { cnh_categoria: expect.stringContaining('categoria D') } })
  })

  it('etapa P03 do PTE fica bloqueada com documento obrigatório vencido', async () => {
    const adesao = b().colecoes.adesoes_pte.find((a) => a.status === 'execucao')!
    const { montarDadosProcesso, pendenciasDeDados } = await import('../fluxo/processo')
    const d = montarDadosProcesso((c) => b().colecoes[c], String(adesao.processo_id))
    expect(pendenciasDeDados('P03', d).some((p) => p.includes('art. 8º'))).toBe(true)
  })

  it('gera e-mails de documentação vencida e de despesa sem comprovação', async () => {
    await processarAlertas(central())
    const tipos = new Set(b().colecoes.alertas.map((a) => a.tipo))
    expect(tipos).toContain('documentacao')
    expect(tipos).toContain('despesa_pte')
  })
})
