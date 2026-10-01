import { beforeEach, describe, expect, it } from 'vitest'
import { hojeIso } from '../diasUteis'
import { carregarBase, restaurarDemonstracao } from './armazenamento'
import { ErroPermissao, ErroRegra, ErroValidacao, salvar, transacao } from './repositorio'
import { calcularPrioridade } from '../judicial/abertura'
import { situacaoOficio } from '../judicial/oficios'
import { aprovarCiclo, calcularAdesao, consultarSre, criarOficio, criarPaf, decidirAutorizacao, executarConciliacao, gerarCronograma, gerarPrestacoesPrevistas, abrirDemandaTransporte, registrarRespostaOficio, responderConsulta } from './servicos'
import { concluirEtapa } from './servicos'
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
  it('ofício: central cadastra (OFC-ano-seq), consulta a SRE, SRE responde, central registra a resposta', async () => {
    const udi = b().colecoes.sres.find((x) => x.sigla === 'UDI')!
    const of = await criarOficio(central(), {
      numero: '999/2026', orgao_tipo: 'defensoria', orgao_nome: 'Defensoria', comarca: 'Uberlândia', data_recebimento: hojeIso(), prazo_resposta: '2099-01-01', assunto: 'Teste', tipo: 'pedido_informacao', numero_sei: 'SEI-OF',
    })
    await expect(criarOficio(usuario('analista.udi@demo.exemplo'), { numero: 'x' })).rejects.toBeInstanceOf(ErroPermissao)
    expect(b().colecoes.processos.find((p) => p.id === of.processo_id)!.codigo).toMatch(/^OFC-\d{4}-\d{4}$/)
    const sergio = usuario('analista.udi@demo.exemplo')
    const doOficio = () => b().colecoes.oficios.find((o) => o.id === of.id)!
    const consultas = () => b().colecoes.oficio_consultas
    expect(situacaoOficio(doOficio(), consultas())).toBe('aguardando_analise')

    const c = await consultarSre(central(), of.id, { sre_id: udi.id, pergunta: 'Qual rota atende?', prazo: '2099-01-01' })
    expect(situacaoOficio(doOficio(), consultas())).toBe('aguardando_sre')
    await expect(registrarRespostaOficio(central(), of.id, { resposta_numero: 'R1', resposta_data: hojeIso() })).rejects.toThrow(/sem resposta/)
    await expect(responderConsulta(usuario('analista.moc@demo.exemplo'), c.id, 'x')).rejects.toBeInstanceOf(ErroPermissao) // outra SRE
    await responderConsulta(sergio, c.id, 'Rota 12, van escolar.')
    expect(situacaoOficio(doOficio(), consultas())).toBe('informacao_recebida')
    // central devolve pedindo complemento; o histórico guarda os dois pedidos
    const c2 = await consultarSre(central(), of.id, { sre_id: udi.id, pergunta: 'Informe também a quilometragem.', prazo: '2099-01-01' })
    expect(situacaoOficio(doOficio(), consultas())).toBe('aguardando_sre')
    await responderConsulta(sergio, c2.id, '18 km por dia.')
    expect(consultas().filter((x) => x.oficio_id === of.id)).toHaveLength(2)
    await registrarRespostaOficio(central(), of.id, { resposta_numero: 'OF 1/2026', resposta_data: hojeIso() })
    expect(situacaoOficio(doOficio(), consultas())).toBe('respondido')
  })

  it('demanda de transporte: abre da intimação com alunos (existente e novo), pré-preenche a caracterização e calcula a prioridade', async () => {
    const of = b().colecoes.oficios.find((o) => o.tipo === 'intimacao_cumprimento' && !o.demanda_id)!
    const escola = b().colecoes.escolas.find((e) => e.id === of.escola_id)!
    const existente = b().colecoes.alunos.find((a) => a.escola_atual_id === escola.id)!
    const necessidade = { responsavel_nome: 'Mãe Fictícia', turno: 'manha', endereco_origem: 'Zona rural, km 12', dias_semana: ['seg', 'ter', 'qua', 'qui', 'sex'], viagem: 'ida_volta', horario_entrada: '07:00', horario_saida: '11:30', acompanhante: false }
    const dados = {
      tipo_determinacao: 'liminar', data_ciencia: of.data_recebimento as string, prazo_judicial: of.prazo_resposta as string, escola_id: escola.id,
      data_inicio_prevista: of.prazo_resposta as string, prazo_indeterminado: true, caixa_escolar_id: b().colecoes.caixas_escolares.find((c) => c.escola_id === escola.id)!.id,
      responsavel_sre_id: usuario('analista.udi@demo.exemplo').id, prazo_devolucao_formulario: of.prazo_resposta as string, decisao_resumo: 'Transporte adequado.',
      alunos: [
        { aluno_id: existente.id, ...necessidade, veiculo_acessivel: false },
        { novo: { nome: 'Aluno Novo Fictício', cod_simade: '99887766', data_nascimento: '2014-03-01' }, ...necessidade, veiculo_acessivel: true, cadeira_rodas: true },
      ],
    }
    // obrigatórios: sem turno do 2º aluno, recusa apontando o campo
    await expect(abrirDemandaTransporte(central(), of.id, { ...dados, alunos: [dados.alunos[0], { ...dados.alunos[1], turno: '' }] })).rejects.toMatchObject({ erros: { 'alunos.1.turno': expect.any(String) } })
    const dem = await abrirDemandaTransporte(central(), of.id, dados)
    expect(b().colecoes.processos.find((p) => p.id === dem.processo_id)!.codigo).toMatch(/^JUD-\d{4}-UDI-\d{4}$/)
    expect(dem.numero_processo_origem).toBe(of.numero_processo_judicial)
    expect(dem.prioridade).toBe('urgente') // liminar
    expect(b().colecoes.oficios.find((o) => o.id === of.id)!.demanda_id).toBe(dem.id)
    expect(codigoEtapa(etapaAberta(dem.processo_id))).toBe('C01')
    const novo = b().colecoes.alunos.find((a) => a.cod_simade === '99887766')!
    expect(novo.escola_atual_id).toBe(escola.id)
    const cars = b().colecoes.caracterizacoes.filter((c) => c.demanda_id === dem.id)
    expect(cars).toHaveLength(2)
    expect(cars[0].endereco_residencia).toBe('Zona rural, km 12')
    const saudeNovo = b().colecoes.caracterizacoes_saude.find((x) => x.caracterizacao_id === cars[1].id)!
    expect(saudeNovo.pcd_mobilidade_reduzida).toBe(true)
    await expect(abrirDemandaTransporte(central(), of.id, dados)).rejects.toThrow(/já tem demanda/)
    const pedido = b().colecoes.oficios.find((o) => o.tipo === 'pedido_informacao')!
    await expect(abrirDemandaTransporte(central(), pedido.id, dados)).rejects.toThrow(/intimação/)
  })

  it('prioridade: urgente (liminar, prazo curto ou multa), alta (judicial), normal', () => {
    const f = new Set<string>()
    expect(calcularPrioridade({ tipo_determinacao: 'sentenca', prazo_judicial: '2099-01-01', origem: 'judicial' }, '2026-10-01', f)).toBe('alta')
    expect(calcularPrioridade({ tipo_determinacao: 'sentenca', prazo_judicial: '2026-10-05', origem: 'judicial' }, '2026-10-01', f)).toBe('urgente')
    expect(calcularPrioridade({ tipo_determinacao: 'requisicao_mp', prazo_judicial: '2099-01-01', origem: 'ministerio_publico', multa_diaria: 500 }, '2026-10-01', f)).toBe('urgente')
    expect(calcularPrioridade({ tipo_determinacao: 'requisicao_mp', prazo_judicial: '2099-01-01', origem: 'ministerio_publico' }, '2026-10-01', f)).toBe('normal')
  })

  it('checklist incompleto só avança com justificativa, e só de diretor ou órgão central', async () => {
    const { montarDadosProcesso, pendenciasDeDados } = await import('../fluxo/processo')
    const semPendencia = (d: Registro) => pendenciasDeDados('C04', montarDadosProcesso((c) => b().colecoes[c], String(d.processo_id))).length === 0
    const dem = b().colecoes.demandas.find((d) => codigoEtapa(etapaAberta(d.processo_id)) === 'C04' && semPendencia(d))!
    const etapa = etapaAberta(dem.processo_id)
    await expect(concluirEtapa(central(), etapa.id)).rejects.toThrow(/Checklist incompleto/)
    await expect(concluirEtapa(usuario('analista.udi@demo.exemplo'), etapa.id, 'urgente')).rejects.toBeInstanceOf(ErroPermissao)
    await concluirEtapa(usuario('dafi.udi@demo.exemplo'), etapa.id, 'Relatório será anexado.')
    expect(b().colecoes.processo_etapas.find((e) => e.id === etapa.id)!.justificativa_avanco).toMatch(/anexado/)
    expect(b().colecoes.demandas.find((d) => d.id === dem.id)!.situacao).toBe('cumprida')
  })

  it('etapa 4 não se conclui pelo botão comum: só pela decisão do subsecretário', async () => {
    const dem = b().colecoes.demandas.find((d) => codigoEtapa(etapaAberta(d.processo_id)) === 'C02')!
    await expect(concluirEtapa(central(), etapaAberta(dem.processo_id).id, 'qualquer')).rejects.toBeInstanceOf(ErroRegra)
  })

  it('só o subsecretário decide; aprovação define o valor e abre o registro do PAF', async () => {
    const dem = b().colecoes.demandas.find((d) => codigoEtapa(etapaAberta(d.processo_id)) === 'C02')!
    await expect(decidirAutorizacao(central(), dem.id, { decisao: 'aprovada', valor_mensal: 1000, meses: 10 })).rejects.toBeInstanceOf(ErroPermissao)
    await decidirAutorizacao(usuario('subsecretaria@demo.exemplo'), dem.id, { decisao: 'aprovada', valor_mensal: 9800, meses: 10, parecer: 'ok' })
    expect(b().colecoes.demandas.find((d) => d.id === dem.id)!.valor_total).toBe(98000)
    expect(codigoEtapa(etapaAberta(dem.processo_id))).toBe('C03')

    // PAF: vigência de 5 anos, não pode passar do valor autorizado, e conclui a etapa
    const caixa = b().colecoes.caixas_escolares.find((c) => c.id === dem.caixa_escolar_id)!
    await expect(criarPaf(central(), dem.id, { numero: 'PAF X', data_criacao: '2026-09-01', valor: 99000, cnpj_destinatario: String(caixa.cnpj) })).rejects.toBeInstanceOf(ErroValidacao)
    const paf = await criarPaf(central(), dem.id, { numero: 'PAF X', data_criacao: '2026-09-01', valor: 98000, cnpj_destinatario: String(caixa.cnpj) })
    expect(paf.data_vigencia).toBe('2031-09-01')
    expect(codigoEtapa(etapaAberta(dem.processo_id))).toBe('C04')
  })

  it('devolução do subsecretário exige motivo e reabre a caracterização', async () => {
    const dem = b().colecoes.demandas.find((d) => codigoEtapa(etapaAberta(d.processo_id)) === 'C02')!
    const sub = usuario('subsecretaria@demo.exemplo')
    await expect(decidirAutorizacao(sub, dem.id, { decisao: 'devolvida' })).rejects.toBeInstanceOf(ErroValidacao)
    await decidirAutorizacao(sub, dem.id, { decisao: 'devolvida', parecer: 'Rever o km da rota.' })
    expect(codigoEtapa(etapaAberta(dem.processo_id))).toBe('C01')
    const j04 = b().colecoes.processo_etapas.find((e) => e.processo_id === dem.processo_id && codigoEtapa(e) === 'C02')!
    expect(j04.status).toBe('devolvida')
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

})
