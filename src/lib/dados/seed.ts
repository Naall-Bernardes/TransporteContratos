// Dados iniciais do modo demonstração.
// SREs, municípios (amostra, códigos IBGE) e feriados nacionais: dados públicos reais.
// Escolas, Caixas Escolares, alunos, transportadores, usuários e preços: TODOS FICTÍCIOS.
// As siglas das SREs são uma sugestão inicial — podem ser alteradas no cadastro.

import { hojeIso } from '../diasUteis'
import { cnpjComDigitos, cpfComDigitos } from '../validacao'
import { criarConfiguracoes } from './seedConfiguracoes'
import { criarContratosDemonstracao } from './seedContratos'
import { criarModulosDemonstracao } from './seedModulos'
import { COLECOES, type Base, type Colecao, type Registro } from './tipos'

const SRES: [string, string][] = [
  ['ALM', 'Almenara'], ['ARA', 'Araçuaí'], ['BAR', 'Barbacena'], ['CBE', 'Campo Belo'],
  ['CRG', 'Carangola'], ['CRT', 'Caratinga'], ['CXB', 'Caxambu'], ['CLF', 'Conselheiro Lafaiete'],
  ['CFB', 'Coronel Fabriciano'], ['CUR', 'Curvelo'], ['DIA', 'Diamantina'], ['DIV', 'Divinópolis'],
  ['GVA', 'Governador Valadares'], ['GUA', 'Guanhães'], ['ITJ', 'Itajubá'], ['ITU', 'Ituiutaba'],
  ['JNB', 'Janaúba'], ['JNR', 'Januária'], ['JFO', 'Juiz de Fora'], ['LEO', 'Leopoldina'],
  ['MHU', 'Manhuaçu'], ['MTA', 'Metropolitana A'], ['MTB', 'Metropolitana B'], ['MTC', 'Metropolitana C'],
  ['MCA', 'Monte Carmelo'], ['MOC', 'Montes Claros'], ['MUR', 'Muriaé'], ['NER', 'Nova Era'],
  ['OPR', 'Ouro Preto'], ['PMI', 'Pará de Minas'], ['PCT', 'Paracatu'], ['PAS', 'Passos'],
  ['PMG', 'Patos de Minas'], ['PTR', 'Patrocínio'], ['PIR', 'Pirapora'], ['PCL', 'Poços de Caldas'],
  ['PNV', 'Ponte Nova'], ['PAL', 'Pouso Alegre'], ['SJR', 'São João del-Rei'], ['SSP', 'São Sebastião do Paraíso'],
  ['SLG', 'Sete Lagoas'], ['TOT', 'Teófilo Otoni'], ['UBA', 'Ubá'], ['URA', 'Uberaba'],
  ['UDI', 'Uberlândia'], ['UNA', 'Unaí'], ['VAR', 'Varginha'],
]

// [código IBGE, nome, sigla da SRE]
const MUNICIPIOS: [string, string, string][] = [
  ['3106200', 'Belo Horizonte', 'MTA'],
  ['3118601', 'Contagem', 'MTB'],
  ['3106705', 'Betim', 'MTB'],
  ['3170206', 'Uberlândia', 'UDI'],
  ['3170107', 'Uberaba', 'URA'],
  ['3143302', 'Montes Claros', 'MOC'],
  ['3136702', 'Juiz de Fora', 'JFO'],
  ['3127701', 'Governador Valadares', 'GVA'],
  ['3135209', 'Januária', 'JNR'],
  ['3121605', 'Diamantina', 'DIA'],
  ['3168606', 'Teófilo Otoni', 'TOT'],
  ['3103405', 'Araçuaí', 'ARA'],
]

const FERIADOS_2026: [string, string, string][] = [
  ['2026-01-01', 'Confraternização Universal', 'nacional'],
  ['2026-02-16', 'Carnaval (ponto facultativo)', 'estadual'],
  ['2026-02-17', 'Carnaval (ponto facultativo)', 'estadual'],
  ['2026-04-03', 'Paixão de Cristo', 'nacional'],
  ['2026-04-21', 'Tiradentes / Data Magna de MG', 'nacional'],
  ['2026-05-01', 'Dia do Trabalho', 'nacional'],
  ['2026-06-04', 'Corpus Christi (ponto facultativo)', 'estadual'],
  ['2026-09-07', 'Independência do Brasil', 'nacional'],
  ['2026-10-12', 'Nossa Senhora Aparecida', 'nacional'],
  ['2026-10-28', 'Dia do Servidor Público (ponto facultativo)', 'estadual'],
  ['2026-11-02', 'Finados', 'nacional'],
  ['2026-11-15', 'Proclamação da República', 'nacional'],
  ['2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'],
  ['2026-12-25', 'Natal', 'nacional'],
  ['2027-01-01', 'Confraternização Universal', 'nacional'],
  ['2027-02-08', 'Carnaval (ponto facultativo)', 'estadual'],
  ['2027-02-09', 'Carnaval (ponto facultativo)', 'estadual'],
  ['2027-03-26', 'Paixão de Cristo', 'nacional'],
  ['2027-04-21', 'Tiradentes / Data Magna de MG', 'nacional'],
  ['2027-05-01', 'Dia do Trabalho', 'nacional'],
  ['2027-05-27', 'Corpus Christi (ponto facultativo)', 'estadual'],
  ['2027-09-07', 'Independência do Brasil', 'nacional'],
  ['2027-10-12', 'Nossa Senhora Aparecida', 'nacional'],
  ['2027-10-28', 'Dia do Servidor Público (ponto facultativo)', 'estadual'],
  ['2027-11-02', 'Finados', 'nacional'],
  ['2027-11-15', 'Proclamação da República', 'nacional'],
  ['2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'],
  ['2027-12-25', 'Natal', 'nacional'],
]

const TIPOS_VEICULO: [string, number | null, boolean][] = [
  ['Automóvel (até 4 passageiros)', 4, false],
  ['Van / micro-ônibus', 16, false],
  ['Ônibus', 44, false],
  ['Veículo adaptado com rampa ou plataforma', 12, true],
  ['Veículo com tração 4x4', 4, false],
  ['Embarcação', null, false],
  ['Outro', null, false],
]

export function criarBaseDemonstracao(versao: number): Base {
  const agora = new Date().toISOString()
  const novo = (campos: Record<string, unknown>): Registro => ({
    id: crypto.randomUUID(),
    criado_em: agora,
    criado_por: null,
    atualizado_em: agora,
    atualizado_por: null,
    ...campos,
  })

  const sres = SRES.map(([sigla, nome]) => novo({ sigla, nome, municipio_sede_id: null }))
  const sre = (sigla: string) => sres.find((s) => s.sigla === sigla)!.id

  const municipios = MUNICIPIOS.map(([cod_ibge, nome, sigla]) => novo({ cod_ibge, nome, sre_id: sre(sigla) }))
  const municipio = (nome: string) => municipios.find((m) => m.nome === nome)!
  for (const s of sres) {
    const sede = municipios.find((m) => m.nome === s.nome)
    if (sede) s.municipio_sede_id = sede.id
  }

  const escolas = (
    [
      ['31999001', 'E.E. Professora Aurora Fictícia', 'Uberlândia'],
      ['31999002', 'E.E. Rio das Pedras (fictícia)', 'Uberlândia'],
      ['31999003', 'E.E. Serra Verde (fictícia)', 'Montes Claros'],
      ['31999004', 'E.E. Vereda Grande (fictícia)', 'Montes Claros'],
      ['31999005', 'E.E. Coração de Minas (fictícia)', 'Belo Horizonte'],
      ['31999006', 'E.E. Margem do São Francisco (fictícia)', 'Januária'],
    ] as const
  ).map(([cod_inep, nome, mun], i) =>
    novo({
      cod_inep,
      cod_see: String(900100 + i),
      nome,
      municipio_id: municipio(mun).id,
      sre_id: municipio(mun).sre_id,
      endereco: 'Endereço fictício',
      ativo: true,
    }),
  )

  const caixas = escolas.map((e, i) =>
    novo({
      cnpj: cnpjComDigitos(`9900000${i + 1}0001`.padStart(12, '0')),
      razao_social: `Caixa Escolar da ${e.nome}`,
      escola_id: e.id,
      presidente_nome: 'Presidente Fictício(a)',
      banco: 'Banco do Brasil',
      agencia: '0000',
      conta: `0000${i}-0`,
      ativo: true,
    }),
  )

  const nomesAlunos = [
    'Aluno Fictício Um', 'Aluna Fictícia Dois', 'Aluno Fictício Três', 'Aluna Fictícia Quatro',
    'Aluno Fictício Cinco', 'Aluna Fictícia Seis', 'Aluno Fictício Sete', 'Aluna Fictícia Oito',
  ]
  const alunos = nomesAlunos.map((nome, i) =>
    novo({
      nome,
      cod_simade: String(8800001 + i),
      data_nascimento: `20${10 + (i % 6)}-0${(i % 9) + 1}-15`,
      escola_atual_id: escolas[i % escolas.length].id,
      serie: `${(i % 9) + 1}º ano`,
      turno: ['manha', 'tarde', 'integral'][i % 3],
      ativo: true,
    }),
  )

  const transportadores = [
    novo({ tipo_pessoa: 'PJ', cpf_cnpj: cnpjComDigitos('770000010001'), razao_social: 'Transportes Fictícios Ltda', telefone: '(34) 0000-0000', email: 'contato@transportes-ficticios.exemplo', ativo: true }),
    novo({ tipo_pessoa: 'PJ', cpf_cnpj: cnpjComDigitos('770000020001'), razao_social: 'Rota Norte Fictícia ME', telefone: '(38) 0000-0000', email: 'rota@norte-ficticia.exemplo', ativo: true }),
    novo({ tipo_pessoa: 'PF', cpf_cnpj: cpfComDigitos('123456789'), razao_social: 'Motorista Autônomo Fictício', telefone: '(38) 90000-0000', email: null, ativo: true }),
  ]

  const tiposVeiculo = TIPOS_VEICULO.map(([nome, capacidade, adaptado_pcd]) =>
    novo({ nome, capacidade, adaptado_pcd, ativo: true }),
  )
  const tipo = (prefixo: string) => tiposVeiculo.find((t) => String(t.nome).startsWith(prefixo))!.id

  const precos = [
    novo({ sre_id: sre('UDI'), tipo_veiculo_id: tipo('Automóvel'), unidade: 'km', valor: 3.2, vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31', fonte: 'Valor fictício para teste' }),
    novo({ sre_id: sre('UDI'), tipo_veiculo_id: tipo('Van'), unidade: 'km', valor: 5.4, vigencia_inicio: '2026-01-01', vigencia_fim: '2026-12-31', fonte: 'Valor fictício para teste' }),
    novo({ sre_id: sre('MOC'), tipo_veiculo_id: tipo('Veículo adaptado'), unidade: 'mes_veiculo', valor: 9800, vigencia_inicio: '2026-01-01', vigencia_fim: null, fonte: 'Valor fictício para teste' }),
  ]

  const feriados = FERIADOS_2026.map(([data, descricao, abrangencia]) =>
    novo({ data, descricao, abrangencia, municipio_id: null }),
  )

  const usuarios = [
    novo({ nome: 'Ana Administradora (fictícia)', email: 'admin@demo.exemplo', papel: 'admin', sre_id: null, ativo: true }),
    novo({ nome: 'Carlos Central (fictício)', email: 'central@demo.exemplo', papel: 'analista_central', sre_id: null, ativo: true }),
    novo({ nome: 'Sofia Subsecretária (fictícia)', email: 'subsecretaria@demo.exemplo', papel: 'subsecretario', sre_id: null, ativo: true }),
    novo({ nome: 'Diana Diretora DAFI – UDI (fictícia)', email: 'dafi.udi@demo.exemplo', papel: 'diretor_sre', sre_id: sre('UDI'), ativo: true }),
    novo({ nome: 'Sérgio Analista – UDI (fictício)', email: 'analista.udi@demo.exemplo', papel: 'analista_sre', sre_id: sre('UDI'), ativo: true }),
    novo({ nome: 'Mariana Analista – MOC (fictícia)', email: 'analista.moc@demo.exemplo', papel: 'analista_sre', sre_id: sre('MOC'), ativo: true }),
    novo({ nome: 'Prefeitura de Montes Claros (fictícia)', email: 'prefeitura.moc@demo.exemplo', papel: 'municipio', sre_id: null, municipio_id: municipio('Montes Claros').id, ativo: true }),
    novo({ nome: 'Prefeitura de Uberlândia (fictícia)', email: 'prefeitura.udi@demo.exemplo', papel: 'municipio', sre_id: null, municipio_id: municipio('Uberlândia').id, ativo: true }),
  ]

  const hoje = hojeIso()
  const config = criarConfiguracoes(novo)
  const contratos = criarContratosDemonstracao({ novo, hoje, caixas, escolas, sres, municipios, transportadores, usuarios })
  const modulos = criarModulosDemonstracao({
    novo,
    hoje,
    feriados: new Set(feriados.map((f) => String(f.data))),
    config,
    contratos,
    escolas,
    caixas,
    alunos,
    usuarios,
    sres,
    municipios,
    precos,
    tiposVeiculo,
    transportadores,
  })

  const partes: Partial<Record<Colecao, Registro[]>>[] = [
    { sres, municipios, escolas, caixas_escolares: caixas, alunos, transportadores, tipos_veiculo: tiposVeiculo, precos_referencia: precos, feriados, usuarios },
    config,
    contratos,
    modulos,
  ]
  const colecoes = Object.fromEntries(COLECOES.map((c) => [c, partes.flatMap((p) => p[c] ?? [])])) as Record<Colecao, Registro[]>
  return { versao, colecoes, auditoria: [], acessos: [] }
}
