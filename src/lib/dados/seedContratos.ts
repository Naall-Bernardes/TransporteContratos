// Instrumentos FICTÍCIOS para demonstração da gestão contratual.
// As datas são relativas a "hoje" para que os alertas (30/60/90 dias, vencido,
// prestação atrasada) sempre apareçam, em qualquer dia em que o sistema for aberto.

import { gerarCodigoUnico } from '../codigoUnico'
import type { ColecaoContrato, Registro } from './tipos'

type Novo = (campos: Record<string, unknown>) => Registro

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

const mesDe = (iso: string) => iso.slice(0, 7)

interface Contexto {
  novo: Novo
  hoje: string
  caixas: Registro[]
  escolas: Registro[]
  sres: Registro[]
  municipios: Registro[]
  transportadores: Registro[]
  usuarios: Registro[]
}

export function criarContratosDemonstracao(c: Contexto): Record<ColecaoContrato, Registro[]> {
  const { novo, hoje } = c
  const d = (n: number) => somarDias(hoje, n)
  const usuario = (email: string) => c.usuarios.find((u) => u.email === email)!.id
  const caixaDa = (trechoEscola: string) => {
    const escola = c.escolas.find((e) => String(e.nome).includes(trechoEscola))!
    return c.caixas.find((x) => x.escola_id === escola.id)!
  }
  const sreDaCaixa = (caixa: Registro) => c.escolas.find((e) => e.id === caixa.escola_id)!.sre_id as string
  const siglaSre = (id: string) => String(c.sres.find((s) => s.id === id)!.sigla)
  const municipio = (nome: string) => c.municipios.find((m) => m.nome === nome)!
  const transportador = (trecho: string) => c.transportadores.find((t) => String(t.razao_social).includes(trecho))!.id

  const out: Record<ColecaoContrato, Registro[]> = {
    processos: [],
    instrumentos: [],
    aditivos: [],
    parcelas: [],
    fiscalizacoes: [],
    ocorrencias: [],
    prestacoes_contas: [],
  }

  function instrumento(campos: Record<string, unknown>): Registro {
    const judicial = campos.tipo === 'contrato_caixa'
    const ano = Number(String(campos.data_assinatura).slice(0, 4))
    const chave = judicial
      ? siglaSre(String(campos.sre_id))
      : String(c.municipios.find((m) => m.id === campos.municipio_id)!.cod_ibge)
    const processo = novo({
      codigo: gerarCodigoUnico(judicial ? 'JUDICIAL' : 'PTE', ano, chave, out.processos.map((p) => String(p.codigo))),
      modulo: judicial ? 'JUDICIAL' : 'PTE',
      ano,
      numero_sei: campos.numero_sei,
      sre_id: campos.sre_id,
      municipio_id: judicial ? null : campos.municipio_id,
    })
    out.processos.push(processo)
    const inst = novo({
      caixa_escolar_id: null,
      transportador_id: null,
      municipio_id: null,
      status: 'vigente',
      ...campos,
      processo_id: processo.id,
    })
    out.instrumentos.push(inst)
    return inst
  }

  /** Parcelas mensais iguais; as `pagas` primeiras já quitadas. */
  function parcelasMensais(inst: Registro, qtd: number, valor: number, pagas: number, documento: string) {
    for (let i = 0; i < qtd; i++) {
      const prevista = somarDias(String(inst.vigencia_inicio), 30 * (i + 1))
      out.parcelas.push(
        novo({
          instrumento_id: inst.id,
          numero: i + 1,
          competencia: mesDe(somarDias(String(inst.vigencia_inicio), 30 * i)),
          valor_previsto: valor,
          data_prevista: prevista,
          valor_pago: i < pagas ? valor : null,
          data_pagamento: i < pagas ? somarDias(prevista, 3) : null,
          documento_sei: i < pagas ? `${documento}-${i + 1}` : null,
        }),
      )
    }
  }

  function fiscalizacoesMensais(inst: Registro, meses: number, alunos: number, km: number, fiscal: string) {
    for (let i = 0; i < meses; i++) {
      out.fiscalizacoes.push(
        novo({
          instrumento_id: inst.id,
          competencia: mesDe(somarDias(String(inst.vigencia_inicio), 30 * i)),
          dias_rodados: 20 + (i % 3),
          alunos_transportados: alunos,
          km_rodados: km * (20 + (i % 3)),
          conformidade: i === 2 ? 'ressalvas' : 'conforme',
          fiscal_id: fiscal,
          data_registro: somarDias(String(inst.vigencia_inicio), 30 * (i + 1) + 2),
          observacao: i === 2 ? 'Dois dias sem atendimento por problema mecânico (fictício).' : null,
        }),
      )
    }
  }

  // 1) UDI – vence em 25 dias, com diligência em andamento na prestação de contas
  const caixaAurora = caixaDa('Aurora')
  const c1 = instrumento({
    tipo: 'contrato_caixa',
    numero: '001/2026',
    numero_sei: '1260.01.0000001/2026-01',
    caixa_escolar_id: caixaAurora.id,
    transportador_id: transportador('Transportes Fictícios'),
    sre_id: sreDaCaixa(caixaAurora),
    objeto: 'Transporte escolar de 2 estudantes em cumprimento de decisão judicial (fictício).',
    data_assinatura: d(-245),
    vigencia_inicio: d(-240),
    vigencia_fim: d(25),
    valor_global: 96000,
    dotacao_orcamentaria: '1261.12.361.xxxx (fictícia)',
    gestor_id: usuario('dafi.udi@demo.exemplo'),
    fiscal_id: usuario('analista.udi@demo.exemplo'),
  })
  parcelasMensais(c1, 8, 12000, 7, 'NF-UDI-001')
  fiscalizacoesMensais(c1, 7, 2, 38, usuario('analista.udi@demo.exemplo'))
  out.ocorrencias.push(
    novo({
      instrumento_id: c1.id,
      data: d(-150),
      tipo: 'interrupcao',
      gravidade: 'alta',
      titulo: 'Transporte não realizado por 2 dias',
      descricao: 'Veículo quebrado; estudantes sem transporte (fictício).',
      providencia: 'Contratado notificado; substituição de veículo exigida.',
      status: 'resolvida',
      notificacao_data: d(-149),
      notificacao_prazo: d(-144),
      notificacao_respondida_em: d(-146),
    }),
  )
  out.prestacoes_contas.push(
    novo({
      instrumento_id: c1.id,
      periodo_referencia: '1º semestre',
      data_limite: d(-40),
      data_entrega: d(-45),
      status: 'em_diligencia',
      diligencia_data: d(-20),
      diligencia_prazo: d(5),
      diligencia_descricao: 'Faltam 2 notas fiscais e o relatório de fiscalização de um mês (fictício).',
    }),
  )

  // 2) UDI – vencido há 5 dias SEM aditivo (situação de risco)
  const caixaRio = caixaDa('Rio das Pedras')
  const c2 = instrumento({
    tipo: 'contrato_caixa',
    numero: '002/2026',
    numero_sei: '1260.01.0000002/2026-01',
    caixa_escolar_id: caixaRio.id,
    transportador_id: transportador('Transportes Fictícios'),
    sre_id: sreDaCaixa(caixaRio),
    objeto: 'Transporte escolar de estudante com deficiência, veículo adaptado (fictício).',
    data_assinatura: d(-200),
    vigencia_inicio: d(-195),
    vigencia_fim: d(-5),
    valor_global: 60000,
    dotacao_orcamentaria: '1261.12.361.xxxx (fictícia)',
    gestor_id: usuario('dafi.udi@demo.exemplo'),
    fiscal_id: usuario('analista.udi@demo.exemplo'),
  })
  parcelasMensais(c2, 6, 10000, 6, 'NF-UDI-002')
  fiscalizacoesMensais(c2, 6, 1, 52, usuario('analista.udi@demo.exemplo'))

  // 3) MOC – prorrogado por aditivo (vence em 55 dias) e com acréscimo de 25%; prestação ATRASADA
  const caixaSerra = caixaDa('Serra Verde')
  const c3 = instrumento({
    tipo: 'contrato_caixa',
    numero: '001/2026',
    numero_sei: '1260.01.0000003/2026-26',
    caixa_escolar_id: caixaSerra.id,
    transportador_id: transportador('Rota Norte'),
    sre_id: sreDaCaixa(caixaSerra),
    objeto: 'Transporte escolar rural de 3 estudantes, trecho com tração 4x4 (fictício).',
    data_assinatura: d(-305),
    vigencia_inicio: d(-300),
    vigencia_fim: d(-60),
    valor_global: 72000,
    dotacao_orcamentaria: '1261.12.361.xxxx (fictícia)',
    gestor_id: usuario('central@demo.exemplo'),
    fiscal_id: usuario('analista.moc@demo.exemplo'),
  })
  out.aditivos.push(
    novo({
      instrumento_id: c3.id,
      numero: 1,
      data_assinatura: d(-70),
      documento_sei: 'SEI 90000001',
      altera_prazo: true,
      nova_vigencia_fim: d(55),
      altera_valor: true,
      valor_variacao: 18000,
      altera_rota_veiculo: true,
      descricao: 'Prorrogação até o fim do ano letivo e inclusão de um estudante na rota (fictício).',
    }),
  )
  parcelasMensais(c3, 12, 7500, 8, 'NF-MOC-001')
  fiscalizacoesMensais(c3, 8, 3, 64, usuario('analista.moc@demo.exemplo'))
  out.prestacoes_contas.push(
    novo({ instrumento_id: c3.id, periodo_referencia: '1º semestre', data_limite: d(-10), status: 'pendente' }),
  )
  out.ocorrencias.push(
    novo({
      instrumento_id: c3.id,
      data: d(-12),
      tipo: 'veiculo_irregular',
      gravidade: 'media',
      titulo: 'Vistoria DETRAN vencida',
      descricao: 'Autorização do DETRAN do veículo venceu (fictício).',
      providencia: 'Solicitada nova vistoria.',
      status: 'em_tratamento',
      notificacao_data: d(-11),
      notificacao_prazo: d(4),
    }),
  )

  // 4) MOC – contrato recente, vigente
  const caixaVereda = caixaDa('Vereda Grande')
  const c4 = instrumento({
    tipo: 'contrato_caixa',
    numero: '003/2026',
    numero_sei: '1260.01.0000004/2026-26',
    caixa_escolar_id: caixaVereda.id,
    transportador_id: transportador('Motorista Autônomo'),
    sre_id: sreDaCaixa(caixaVereda),
    objeto: 'Transporte escolar de 1 estudante em cumprimento de requisição do MP (fictício).',
    data_assinatura: d(-32),
    vigencia_inicio: d(-30),
    vigencia_fim: d(335),
    valor_global: 42000,
    dotacao_orcamentaria: '1261.12.361.xxxx (fictícia)',
    gestor_id: usuario('central@demo.exemplo'),
    fiscal_id: usuario('analista.moc@demo.exemplo'),
  })
  parcelasMensais(c4, 12, 3500, 1, 'NF-MOC-003')
  fiscalizacoesMensais(c4, 1, 1, 22, usuario('analista.moc@demo.exemplo'))

  // 5) PTE – termo com Montes Claros, vence em 80 dias
  const moc = municipio('Montes Claros')
  const t1 = instrumento({
    tipo: 'termo_pte',
    numero: 'TC 015/2026',
    numero_sei: '1260.01.0000005/2026-10',
    municipio_id: moc.id,
    sre_id: moc.sre_id,
    objeto: 'Repasse PTE/MG para transporte de estudantes da rede estadual (fictício).',
    data_assinatura: d(-245),
    vigencia_inicio: d(-240),
    vigencia_fim: d(80),
    valor_global: 450000,
    dotacao_orcamentaria: '1261.12.361.yyyy (fictícia)',
    gestor_id: usuario('central@demo.exemplo'),
    fiscal_id: usuario('analista.moc@demo.exemplo'),
  })
  for (let i = 0; i < 3; i++) {
    const prevista = d(-230 + 100 * i)
    out.parcelas.push(
      novo({
        instrumento_id: t1.id,
        numero: i + 1,
        competencia: mesDe(prevista),
        valor_previsto: 150000,
        data_prevista: prevista,
        valor_pago: i < 2 ? 150000 : null,
        data_pagamento: i < 2 ? somarDias(prevista, 5) : null,
        documento_sei: i < 2 ? `OB-PTE-${i + 1}` : null,
      }),
    )
  }
  out.prestacoes_contas.push(
    novo({ instrumento_id: t1.id, periodo_referencia: '1ª parcela', data_limite: d(8), status: 'pendente' }),
  )

  // 6) PTE – termo com Januária, já encerrado e com prestação aprovada
  const jan = municipio('Januária')
  const t2 = instrumento({
    tipo: 'termo_pte',
    numero: 'TC 022/2025',
    numero_sei: '1260.01.0000006/2025-10',
    municipio_id: jan.id,
    sre_id: jan.sre_id,
    objeto: 'Repasse PTE/MG – ciclo anterior (fictício).',
    data_assinatura: d(-410),
    vigencia_inicio: d(-400),
    vigencia_fim: d(-40),
    valor_global: 180000,
    dotacao_orcamentaria: '1261.12.361.yyyy (fictícia)',
    gestor_id: usuario('central@demo.exemplo'),
    fiscal_id: usuario('central@demo.exemplo'),
    status: 'encerrado',
    encerrado_em: d(-20),
    situacao_final: 'concluido',
    termo_encerramento_sei: 'SEI 90000099',
  })
  out.parcelas.push(
    novo({ instrumento_id: t2.id, numero: 1, competencia: mesDe(d(-390)), valor_previsto: 180000, data_prevista: d(-390), valor_pago: 180000, data_pagamento: d(-385), documento_sei: 'OB-PTE-JAN-1' }),
  )
  out.prestacoes_contas.push(
    novo({
      instrumento_id: t2.id,
      periodo_referencia: 'Ciclo completo',
      data_limite: d(-30),
      data_entrega: d(-35),
      status: 'aprovada',
      data_decisao: d(-25),
      analista_id: usuario('central@demo.exemplo'),
      parecer: 'Contas regulares (fictício).',
    }),
  )

  return out
}
