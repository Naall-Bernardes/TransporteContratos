// Demandas judiciais, ciclos PTE e documentos FICTÍCIOS para demonstração.
// Reaproveita os processos dos contratos/termos de seedContratos, para que tudo
// fique amarrado pelo mesmo código único. Datas relativas a "hoje".

import { gerarCodigoUnico } from '../codigoUnico'
import { somarDias } from '../datas'
import { diasUteisEntre, ehDiaUtil } from '../diasUteis'
import { prazoDaEtapa } from '../fluxo/sla'
import { conciliar, calcularRepasse, inconsistenciasRotas } from '../pte/pte'
import { cnpjComDigitos } from '../validacao'
import { criarFabricaFrota } from './seedFrota'
import { CHECKLIST } from './seedConfiguracoes'
import type { Colecao, Registro } from './tipos'

type Novo = (campos: Record<string, unknown>) => Registro

interface Contexto {
  novo: Novo
  hoje: string
  feriados: ReadonlySet<string>
  config: { etapas_modelo: Registro[]; tipos_documento: Registro[]; exigencias_documentais: Registro[] }
  transportadores: Registro[]
  contratos: Record<'processos' | 'instrumentos' | 'fiscalizacoes', Registro[]>
  escolas: Registro[]
  caixas: Registro[]
  alunos: Registro[]
  usuarios: Registro[]
  sres: Registro[]
  municipios: Registro[]
  precos: Registro[]
  tiposVeiculo: Registro[]
}

function subtrairDiasUteis(iso: string, n: number, feriados: ReadonlySet<string>) {
  let atual = iso
  let contados = 0
  while (contados < n) {
    atual = somarDias(atual, -1)
    if (ehDiaUtil(atual, feriados)) contados++
  }
  return atual
}

export function criarModulosDemonstracao(c: Contexto): Partial<Record<Colecao, Registro[]>> {
  const { novo, hoje, feriados } = c
  const d = (n: number) => somarDias(hoje, n)
  const out: Partial<Record<Colecao, Registro[]>> = {}
  const push = (col: Colecao, r: Registro) => {
    ;(out[col] ??= []).push(r)
    return r
  }
  const usuario = (email: string) => c.usuarios.find((u) => u.email === email)!.id
  const sre = (sigla: string) => c.sres.find((s) => s.sigla === sigla)!.id
  const escola = (trecho: string) => c.escolas.find((e) => String(e.nome).includes(trecho))!
  const caixaDa = (e: Registro) => c.caixas.find((x) => x.escola_id === e.id)!
  const tipoVeiculo = (p: string) => c.tiposVeiculo.find((t) => String(t.nome).startsWith(p))!.id
  const tipoDoc = (codigo: string) => c.config.tipos_documento.find((t) => t.codigo === codigo)!.id
  const modelos = (modulo: string) => c.config.etapas_modelo.filter((m) => m.modulo === modulo).sort((a, b) => Number(a.ordem) - Number(b.ordem))
  const codigos = c.contratos.processos.map((p) => String(p.codigo))
  const instrumento = (numero: string, trecho: string) =>
    c.contratos.instrumentos.find((i) => i.numero === numero && String(i.objeto).includes(trecho))!

  function novoProcesso(modulo: 'JUDICIAL' | 'PTE', ano: number, chave: string, campos: Record<string, unknown>) {
    const codigo = gerarCodigoUnico(modulo, ano, chave, codigos)
    codigos.push(codigo)
    return push('processos', novo({ codigo, modulo, ano, ...campos }))
  }

  /**
   * Cria o histórico de etapas: as anteriores concluídas (duração em dias úteis) e a atual
   * em andamento desde `inicioAtual`. Sem etapa atual (`null`) = processo encerrado.
   */
  function historico(processoId: string, modulo: string, atual: string | null, inicioAtual: string, responsavel: string | null, duracoes: Record<string, number> = {}) {
    const lista = modelos(modulo)
    const idx = atual ? lista.findIndex((m) => m.codigo === atual) : lista.length
    // etapas sempre começam em dia útil
    while (!ehDiaUtil(inicioAtual, feriados)) inicioAtual = somarDias(inicioAtual, -1)
    let cursor = inicioAtual
    for (let i = idx - 1; i >= 0; i--) {
      const m = lista[i]
      const dur = duracoes[String(m.codigo)] ?? 3 + ((i * 7) % 5)
      const iniciada = subtrairDiasUteis(cursor, dur, feriados)
      push('processo_etapas', novo({
        processo_id: processoId,
        etapa_modelo_id: m.id,
        status: 'concluida',
        responsavel_id: responsavel,
        iniciada_em: iniciada,
        prazo_sla: prazoDaEtapa(iniciada, m.sla_dias_uteis as number | null, feriados),
        concluida_em: cursor,
      }))
      cursor = iniciada
    }
    if (atual) {
      const m = lista[idx]
      push('processo_etapas', novo({
        processo_id: processoId,
        etapa_modelo_id: m.id,
        status: 'em_andamento',
        responsavel_id: responsavel,
        iniciada_em: inicioAtual,
        prazo_sla: prazoDaEtapa(inicioAtual, m.sla_dias_uteis as number | null, feriados),
      }))
    }
    return cursor // data de início do processo
  }

  /** Documentos fictícios (sem arquivo real — o PDF é gerado ao abrir). */
  function documentos(processoId: string, etapas: string[], data: string, extras: string[] = [], omitir: string[] = []) {
    const codigosDoc = CHECKLIST.filter(([e, , cond]) => etapas.includes(e) && (cond === 'sempre' || extras.includes(e + ':' + cond))).map(([e, doc]) => [e, doc])
    for (const [etapa, doc] of codigosDoc) {
      if (omitir.includes(doc)) continue
      const documento = push('documentos', novo({
        processo_id: processoId,
        tipo_documento_id: tipoDoc(doc),
        numero_sei: `SEI ${9100000 + (out.documentos?.length ?? 0)}`,
        data_documento: data,
        etapa_codigo: etapa,
        versao_atual: 1,
        observacao: 'Documento fictício de demonstração.',
      }))
      push('documento_versoes', novo({
        documento_id: documento.id,
        versao: 1,
        nome_arquivo: `${doc}.pdf`,
        mime: 'application/pdf',
        tamanho_bytes: 40000 + ((out.documentos?.length ?? 0) * 3731) % 90000,
        hash_sha256: null,
        arquivo_demo: true,
      }))
    }
  }

  // Alunos adicionais para as demandas novas
  const extras = [
    ['Aluno Fictício Nove', 'Aurora'],
    ['Aluna Fictícia Dez', 'Serra Verde'],
    ['Aluno Fictício Onze', 'Coração de Minas'],
    ['Aluna Fictícia Doze', 'Rio das Pedras'],
  ].map(([nome, esc], i) =>
    push('alunos', novo({ nome, cod_simade: String(8800101 + i), data_nascimento: `201${2 + i}-0${i + 2}-10`, escola_atual_id: escola(esc).id, serie: `${6 + i}º ano`, turno: 'manha', ativo: true })),
  )
  const aluno = (nome: string) => [...c.alunos, ...extras].find((a) => a.nome === nome)!

  const CARACTERIZACAO_COMPLETA = {
    turma_ano: '7º ano A',
    turno: 'manha',
    horario_entrada: '07:00',
    horario_saida: '11:30',
    dias_semana: ['seg', 'ter', 'qua', 'qui', 'sex'],
    contraturno: false,
    escola_mais_proxima: 'A própria escola (única com a série na região)',
    endereco_residencia: 'Comunidade rural fictícia, km 12 da estrada vicinal',
    ponto_referencia: 'Próximo à capela (fictício)',
    zona: 'rural',
    distancia_km_ida: 14,
    tempo_ida_min: 35,
    viagens_dia: '2',
    tipo_via: 'terra',
    condicao_via: 'ruim_chuva',
    obstaculos: ['atoleiro'],
    veiculo_chega_residencia: true,
    exige_4x4: 'periodo_chuvoso',
    rota_existente: 'nao_atende_horario',
    outros_estudantes_trajeto: false,
    viavel_mesmo_veiculo: true,
    lotacao: 2,
    km_diario_total: 56,
    dias_letivos_periodo: 200,
    requisitos: ['cnh_d_curso', 'detran_inspecao', 'cinto_todos'],
    justificativa_tecnica: 'Estrada de terra com atoleiro no período chuvoso; veículo leve com tração (fictício).',
    periodo_atendimento: 'ano_letivo',
  }

  interface DemandaSeed {
    processo_id?: string
    sre: string
    escola: string
    alunos: string[]
    etapa: string
    inicioEtapa: string
    prazo_judicial: string
    origem: string
    responsavel: string | null
    valor?: { metodo: string; mensal: number; meses: number; cotacoes?: number[]; preco?: Registro }
    financeiro?: { op?: boolean; paf?: boolean; liberacao?: boolean }
    inicioTransporte?: string
    statusCaracterizacao: string
    pcd?: boolean
    relatorio?: boolean
    docsExtras?: string[]
    omitir?: string[]
    /** Duração (dias úteis) de etapas já concluídas, ex.: execução até a prestação de contas. */
    duracoes?: Record<string, number>
  }

  function demanda(s: DemandaSeed) {
    const esc = escola(s.escola)
    const inicioProcesso = subtrairDiasUteis(s.inicioEtapa, 4 * Number(s.etapa.slice(1)), feriados)
    const processo =
      s.processo_id !== undefined
        ? c.contratos.processos.find((p) => p.id === s.processo_id)!
        : novoProcesso('JUDICIAL', Number(inicioProcesso.slice(0, 4)), String(c.sres.find((x) => x.id === esc.sre_id)!.sigla), {
            numero_sei: `1260.01.00${String(codigos.length).padStart(5, '0')}/2026-${s.sre === 'MOC' ? '26' : '01'}`,
            sre_id: esc.sre_id,
            municipio_id: null,
          })
    const inicio = historico(processo.id, 'JUDICIAL', s.etapa, s.inicioEtapa, s.responsavel, s.duracoes)
    const dem = push('demandas', novo({
      processo_id: processo.id,
      sre_id: esc.sre_id,
      origem: s.origem,
      numero_processo_origem: s.origem === 'judicial' ? `5000${codigos.length}12-34.2026.8.13.0${100 + codigos.length}` : `MPMG-0${codigos.length}24.26.000123-4`,
      comarca: String(c.municipios.find((m) => m.id === esc.municipio_id)?.nome ?? ''),
      orgao: s.origem === 'judicial' ? 'Vara da Infância e da Juventude (fictícia)' : 'Promotoria de Justiça da Educação (fictícia)',
      data_recebimento: inicio,
      data_ciencia: somarDias(inicio, -2),
      prazo_judicial: s.prazo_judicial,
      multa_diaria: s.origem === 'judicial' ? 1000 : null,
      decisao_resumo: 'Determina ao Estado fornecer transporte escolar adequado ao(s) estudante(s) (texto fictício).',
      prazo_devolucao_formulario: prazoDaEtapa(inicio, 10, feriados),
      escola_id: esc.id,
      caixa_escolar_id: caixaDa(esc).id,
      responsavel_sre_id: s.responsavel,
      situacao: 'ativa',
      metodo_valor: s.valor?.metodo ?? null,
      preco_referencia_id: s.valor?.preco?.id ?? null,
      valor_mensal: s.valor?.mensal ?? null,
      meses_previstos: s.valor?.meses ?? null,
      valor_total: s.valor ? s.valor.mensal * s.valor.meses : null,
      data_inicio_transporte: s.inicioTransporte ?? null,
      relatorio_gerado_em: s.relatorio ? hoje : null,
    }))
    for (const nome of s.alunos) {
      const da = push('demanda_alunos', novo({ demanda_id: dem.id, aluno_id: aluno(nome).id, incluido_em: inicio }))
      const completa = s.statusCaracterizacao !== 'rascunho'
      const car = push('caracterizacoes', novo({
        demanda_id: dem.id,
        demanda_aluno_id: da.id,
        status: s.statusCaracterizacao,
        ...(completa ? CARACTERIZACAO_COMPLETA : { turma_ano: '6º ano', turno: 'manha', zona: 'rural', distancia_km_ida: 9 }),
        tipo_veiculo_indicado_id: completa ? tipoVeiculo(s.pcd ? 'Veículo adaptado' : 'Automóvel') : null,
        tipo_veiculo_aprovado_id: s.statusCaracterizacao === 'aprovada' ? tipoVeiculo(s.pcd ? 'Veículo adaptado' : 'Automóvel') : null,
        data_inicio_pretendida: completa ? somarDias(inicio, 20) : null,
        valor_estimado_mensal: completa ? (s.valor?.mensal ?? 4000) : null,
        analista_id: s.statusCaracterizacao === 'aprovada' ? s.responsavel ?? usuario('central@demo.exemplo') : null,
        data_recebimento_formulario: completa ? somarDias(inicio, 5) : null,
        documentacao_completa: completa,
      }))
      push('caracterizacoes_saude', novo({
        caracterizacao_id: car.id,
        pcd_mobilidade_reduzida: !!s.pcd,
        pcd_especificacao: s.pcd ? 'Deficiência física, usa cadeira de rodas (fictício)' : null,
        dispositivo_mobilidade: s.pcd ? 'cadeira_manual_dobravel' : 'nenhum',
        transferencia_assento: s.pcd ? 'com_auxilio' : 'sozinho',
        necessita_rampa_plataforma: !!s.pcd,
        necessita_acompanhante: !!s.pcd,
        tipo_acompanhante: s.pcd ? 'familiar' : null,
        dispositivo_retencao: 'nao',
        medicacao_trajeto: false,
      }))
      push('responsaveis_legais', novo({
        caracterizacao_id: car.id,
        nome: `Responsável por ${nome} (fictício)`,
        grau_parentesco: 'Mãe',
        telefone_principal: '(00) 90000-0000',
        email: null,
        acompanha_trajeto: s.pcd ? 'sempre' : 'nao',
      }))
    }
    for (const [i, v] of (s.valor?.cotacoes ?? []).entries())
      push('cotacoes', novo({ demanda_id: dem.id, fornecedor: `Fornecedor fictício ${String.fromCharCode(65 + i)}`, valor_mensal: v, data: somarDias(inicio, 12 + i) }))
    const f = s.financeiro ?? {}
    const valorTotal = s.valor ? s.valor.mensal * s.valor.meses : 0
    if (f.op) push('autorizacoes_financeiras', novo({ demanda_id: dem.id, tipo: 'OP', numero: `OP ${2026}${String(codigos.length).padStart(4, '0')}`, data: somarDias(inicio, 22), valor: valorTotal }))
    if (f.paf) push('autorizacoes_financeiras', novo({ demanda_id: dem.id, tipo: 'PAF', numero: `PAF ${2026}.${String(codigos.length).padStart(3, '0')}`, data: somarDias(inicio, 22), valor: valorTotal }))
    if (f.liberacao) push('liberacoes_recurso', novo({ demanda_id: dem.id, data: somarDias(inicio, 27), valor: valorTotal, numero_ordem_bancaria: `2026OB${String(codigos.length).padStart(5, '0')}` }))

    const lista = modelos('JUDICIAL').map((m) => String(m.codigo))
    const concluidas = lista.slice(0, lista.indexOf(s.etapa))
    const extrasDoc = [...(s.docsExtras ?? []), ...(s.pcd ? ['J03:se_pcd', 'J03:se_dispositivo_ou_acompanhante'] : []), 'J03:se_obstaculos', 'J03:se_rota_nao_atende']
    if (s.valor?.metodo === 'tres_cotacoes') extrasDoc.push('J04:se_tres_cotacoes')
    documentos(processo.id, concluidas, somarDias(inicio, 3), s.statusCaracterizacao === 'rascunho' ? [] : extrasDoc, s.omitir)
    return dem
  }

  const c1 = instrumento('001/2026', '2 estudantes')
  const c2 = instrumento('002/2026', 'adaptado')
  const c3 = instrumento('001/2026', 'rural')
  const c4 = instrumento('003/2026', 'MP')
  const precoMocAdaptado = c.precos.find((p) => p.sre_id === sre('MOC'))!
  const sergio = usuario('analista.udi@demo.exemplo')
  const mariana = usuario('analista.moc@demo.exemplo')

  const execucao = (inst: Registro, fim: string) => ({ J08: diasUteisEntre(String(inst.vigencia_inicio), fim, feriados) })
  demanda({ duracoes: execucao(c1, d(-45)), processo_id: c1.processo_id as string, sre: 'UDI', escola: 'Aurora', alunos: ['Aluno Fictício Um', 'Aluno Fictício Sete'], etapa: 'J09', inicioEtapa: d(-45), prazo_judicial: somarDias(String(c1.vigencia_inicio), 3), origem: 'judicial', responsavel: sergio, valor: { metodo: 'tres_cotacoes', mensal: 12000, meses: 8, cotacoes: [12000, 12800, 13500] }, financeiro: { op: true, paf: true, liberacao: true }, inicioTransporte: String(c1.vigencia_inicio), statusCaracterizacao: 'aprovada', docsExtras: ['J08:sempre'], omitir: ['parecer'] })
  demanda({ processo_id: c2.processo_id as string, sre: 'UDI', escola: 'Rio das Pedras', alunos: ['Aluna Fictícia Dois'], etapa: 'J08', inicioEtapa: String(c2.vigencia_inicio), prazo_judicial: somarDias(String(c2.vigencia_inicio), 2), origem: 'judicial', responsavel: sergio, valor: { metodo: 'tres_cotacoes', mensal: 10000, meses: 6, cotacoes: [10000, 10400, 11000] }, financeiro: { op: true, paf: true, liberacao: true }, inicioTransporte: String(c2.vigencia_inicio), statusCaracterizacao: 'aprovada', pcd: true })
  demanda({ duracoes: execucao(c3, d(-10)), processo_id: c3.processo_id as string, sre: 'MOC', escola: 'Serra Verde', alunos: ['Aluno Fictício Três'], etapa: 'J09', inicioEtapa: d(-10), prazo_judicial: somarDias(String(c3.vigencia_inicio), 5), origem: 'judicial', responsavel: mariana, valor: { metodo: 'tres_cotacoes', mensal: 6000, meses: 12, cotacoes: [6000, 6300, 7100] }, financeiro: { op: true, paf: true, liberacao: true }, inicioTransporte: String(c3.vigencia_inicio), statusCaracterizacao: 'aprovada' })
  demanda({ processo_id: c4.processo_id as string, sre: 'MOC', escola: 'Vereda Grande', alunos: ['Aluna Fictícia Quatro'], etapa: 'J08', inicioEtapa: d(-30), prazo_judicial: d(-28), origem: 'ministerio_publico', responsavel: mariana, valor: { metodo: 'tres_cotacoes', mensal: 3500, meses: 12, cotacoes: [3500, 3900, 4200] }, financeiro: { op: true, paf: true, liberacao: true }, inicioTransporte: d(-30), statusCaracterizacao: 'aprovada' })
  // Novas, sem contrato ainda
  demanda({ sre: 'UDI', escola: 'Aurora', alunos: ['Aluno Fictício Nove'], etapa: 'J03', inicioEtapa: d(-3), prazo_judicial: d(9), origem: 'ministerio_publico', responsavel: sergio, statusCaracterizacao: 'rascunho' })
  demanda({ sre: 'MOC', escola: 'Serra Verde', alunos: ['Aluna Fictícia Dez'], etapa: 'J05', inicioEtapa: d(-11), prazo_judicial: d(5), origem: 'judicial', responsavel: mariana, valor: { metodo: 'preco_referencia', mensal: 9800, meses: 10, preco: precoMocAdaptado }, financeiro: { op: true }, statusCaracterizacao: 'aprovada', pcd: true, omitir: ['paf'] })
  demanda({ sre: 'UDI', escola: 'Rio das Pedras', alunos: ['Aluna Fictícia Doze'], etapa: 'J01', inicioEtapa: d(-1), prazo_judicial: d(20), origem: 'judicial', responsavel: null, statusCaracterizacao: 'rascunho' })
  demanda({ sre: 'MTA', escola: 'Coração de Minas', alunos: ['Aluno Fictício Onze'], etapa: 'J04', inicioEtapa: d(-9), prazo_judicial: d(-2), origem: 'judicial', responsavel: usuario('central@demo.exemplo'), valor: { metodo: 'tres_cotacoes', mensal: 0, meses: 0, cotacoes: [5200, 5900] }, statusCaracterizacao: 'enviada' })
  // a demanda MOC em J05 já tem a OP digitalizada; falta o PAF
  documentos(out.demandas![5].processo_id as string, ['J05'], d(-5), [], ['paf'])
  // a demanda MTA ainda não tem valor definido
  const dMta = out.demandas!.at(-1)!
  Object.assign(dMta, { valor_mensal: null, meses_previstos: null, valor_total: null })

  // ---------- PTE ----------
  const t1 = instrumento('TC 015/2026', 'Repasse')
  const t2 = instrumento('TC 022/2025', 'ciclo anterior')
  const moc = c.municipios.find((m) => m.nome === 'Montes Claros')!
  const udi = c.municipios.find((m) => m.nome === 'Uberlândia')!
  const jan = c.municipios.find((m) => m.nome === 'Januária')!

  const ciclo2025 = push('ciclos_pte', novo({ ano: 2025, status: 'encerrado', dias_letivos: 200, num_parcelas: 10, data_abertura: somarDias(String(t2.vigencia_inicio), -90), data_fim_adesao: somarDias(String(t2.vigencia_inicio), -40), vigencia_inicio: t2.vigencia_inicio, vigencia_fim: t2.vigencia_fim, aprovado_em: somarDias(String(t2.vigencia_inicio), -20), aprovado_por: usuario('central@demo.exemplo') }))
  const ciclo2026 = push('ciclos_pte', novo({ ano: 2026, status: 'aprovado', dias_letivos: 200, num_parcelas: 10, data_abertura: somarDias(String(t1.vigencia_inicio), -100), data_fim_adesao: somarDias(String(t1.vigencia_inicio), -45), vigencia_inicio: t1.vigencia_inicio, vigencia_fim: t1.vigencia_fim, aprovado_em: somarDias(String(t1.vigencia_inicio), -15), aprovado_por: usuario('central@demo.exemplo') }))
  const ciclo2027 = push('ciclos_pte', novo({ ano: 2027, status: 'adesao', dias_letivos: 200, num_parcelas: 10, data_abertura: d(-20), data_fim_adesao: d(20), vigencia_inicio: '2027-02-01', vigencia_fim: '2027-12-20', observacao: 'Dados do TER/MG considerados até 31/03 (Res. 5.267/2026, art. 17).' }))

  function adesao(ciclo: Registro, municipio: Registro, processoId: string | null, etapa: string | null, inicioEtapa: string, status: string) {
    const processo = processoId
      ? c.contratos.processos.find((p) => p.id === processoId)!
      : novoProcesso('PTE', Number(ciclo.ano), String(municipio.cod_ibge), { numero_sei: `1260.01.00${String(codigos.length).padStart(5, '0')}/${ciclo.ano}-10`, sre_id: municipio.sre_id, municipio_id: municipio.id })
    const inicio = historico(processo.id, 'PTE', etapa, inicioEtapa, municipio.sre_id === sre('UDI') ? sergio : municipio.sre_id === sre('MOC') ? mariana : null)
    return push('adesoes_pte', novo({ processo_id: processo.id, ciclo_id: ciclo.id, municipio_id: municipio.id, sre_id: municipio.sre_id, data_adesao: inicio, status, numero_sei: processo.numero_sei, conciliado_em: etapa === 'P02' ? null : inicio }))
  }

  const alunosPte = (ad: Registro, qtd: number, escolaInep: string, prefixo: number, km: (i: number) => number, rota: (i: number) => string | null = () => null) =>
    Array.from({ length: qtd }, (_, i) =>
      push('pte_alunos', novo({ adesao_id: ad.id, cod_simade: String(prefixo + i), nome: `Estudante PTE fictício ${prefixo + i}`, escola_inep: escolaInep, km_ida: km(i), rota_codigo: rota(i), zona: 'rural', turno: i % 2 ? 'tarde' : 'manha', origem: 'TER', ativo: true })),
    )
  const rotas = (ad: Registro, lista: [codigo: string, km: number, custo: number, passageiros: number, capacidade: number, urbana?: boolean][]) =>
    lista.map(([codigo, km_diario, custo_km, total_passageiros, capacidade, urbana]) =>
      push('rotas_pte', novo({ adesao_id: ad.id, codigo, descricao: `Rota ${codigo} (fictícia)`, turno: 'manha', km_diario, custo_km, total_passageiros, capacidade, urbana: !!urbana, ativa: true })),
    )

  // 2025 – Januária, encerrado
  const aJan25 = adesao(ciclo2025, jan, t2.processo_id as string, null, String(t2.encerrado_em), 'encerrado')
  alunosPte(aJan25, 60, escola('Margem').cod_inep as string, 7700001, (i) => 2 + (i % 4))
  push('calculos_repasse', novo({ adesao_id: aJan25.id, versao: 1, qtd_alunos_informados: 60, qtd_alunos_validos: 60, km_diario_total: 0, valor_calculado: t2.valor_global, memoria: 'Cálculo do ciclo anterior (fictício).', calculado_em: String(ciclo2025.aprovado_em) }))
  documentos(aJan25.processo_id as string, ['P02', 'P03', 'P04', 'P05'], String(t2.vigencia_inicio))

  // 2026 – Montes Claros, em execução
  const aMoc26 = adesao(ciclo2026, moc, t1.processo_id as string, 'P04', String(t1.vigencia_inicio), 'execucao')
  const rotasMoc = rotas(aMoc26, [['R01', 120, 4.5, 30, 44], ['R02', 90, 4.5, 30, 44], ['R03', 110, 4.5, 30, 44], ['R04', 80, 4.5, 30, 44], ['R05', 100, 4.5, 30, 44], ['R06', 100, 4.5, 30, 44]])
  const listaMoc = alunosPte(aMoc26, 150, escola('Vereda').cod_inep as string, 7710001, () => 2.5, (i) => String(rotasMoc[Math.floor(i / 25)].codigo))
  for (const a of listaMoc) push('simade_registros', novo({ ciclo_id: ciclo2026.id, cod_simade: a.cod_simade, nome: a.nome, escola_inep: a.escola_inep, municipio_ibge: moc.cod_ibge, situacao: 'ativo' }))
  const { rotas: _r26, ...calc26 } = calcularRepasse(rotasMoc, listaMoc, new Set(), new Set(), { dias_letivos: 200 })
  void _r26
  push('calculos_repasse', novo({ adesao_id: aMoc26.id, versao: 1, ...calc26, calculado_em: somarDias(String(t1.vigencia_inicio), -25) }))
  documentos(aMoc26.processo_id as string, ['P02', 'P03'], somarDias(String(t1.vigencia_inicio), -30))
  for (let i = 0; i < 3; i++)
    push('fiscalizacoes', novo({ instrumento_id: t1.id, competencia: somarDias(String(t1.vigencia_inicio), 30 * i).slice(0, 7), dias_rodados: 21, alunos_transportados: 148 - i, km_rodados: 15750, conformidade: 'conforme', fiscal_id: mariana, data_registro: somarDias(String(t1.vigencia_inicio), 30 * (i + 1)) }))

  // 2027 – Uberlândia (com divergências) e Januária (duplicidade), em adesão
  const aUdi27 = adesao(ciclo2027, udi, null, 'P02', d(-6), 'aderido')
  const inepAurora = escola('Aurora').cod_inep as string
  const inepRio = escola('Rio das Pedras').cod_inep as string
  const rotasUdi = rotas(aUdi27, [['R1', 64, 4.8, 12, 16], ['R2', 0, 4.8, 6, 16], ['R3', 22, 4.2, 8, 16, true], ['R4', 58, 9.6, 20, 16]])
  const listaUdi = alunosPte(aUdi27, 12, inepAurora, 7720001, (i) => 3 + i, (i) => (i < 7 ? 'R1' : i < 9 ? 'R2' : 'R4'))
  Object.assign(aUdi27, { pnate_estadual: 3200, saldo_reprogramado: 1500 })
  const aJan27 = adesao(ciclo2027, jan, null, 'P02', d(-4), 'aderido')
  rotas(aJan27, [['J1', 48, 5.1, 10, 16], ['J2', 36, 5.1, 8, 16]])
  const listaJan = alunosPte(aJan27, 6, escola('Margem').cod_inep as string, 7730001, () => 4, (i) => (i < 4 ? 'J1' : 'J2'))
  listaJan.push(push('pte_alunos', novo({ adesao_id: aJan27.id, cod_simade: '7720003', nome: 'Estudante PTE fictício 7720003', escola_inep: inepAurora, km_ida: 5, zona: 'rural', turno: 'manha', origem: 'TER', ativo: true })))
  const simade27 = [...listaUdi, ...listaJan.slice(0, 6)]
    .filter((a) => !['7720011', '7720012'].includes(String(a.cod_simade)))
    .map((a) =>
      push('simade_registros', novo({
        ciclo_id: ciclo2027.id,
        cod_simade: a.cod_simade,
        nome: a.nome,
        escola_inep: a.cod_simade === '7720005' ? inepRio : a.escola_inep,
        municipio_ibge: a.adesao_id === aUdi27.id ? udi.cod_ibge : jan.cod_ibge,
        situacao: a.cod_simade === '7720008' ? 'transferido' : 'ativo',
      })),
    )
  const todasRotas27 = out.rotas_pte!.filter((r) => r.adesao_id === aUdi27.id || r.adesao_id === aJan27.id)
  const media27 = todasRotas27.reduce((t, r) => t + Number(r.custo_km), 0) / todasRotas27.length
  for (const div of [
    ...conciliar(listaUdi, simade27, listaJan.map((a) => ({ aluno: a, municipio: 'Januária' }))),
    ...inconsistenciasRotas(rotasUdi, listaUdi, media27),
  ])
    push('divergencias', novo({ adesao_id: aUdi27.id, ...div, status: 'aberta' }))
  out.adesoes_pte!.find((a) => a.id === aUdi27.id)!.conciliado_em = d(-2)
  documentos(aUdi27.processo_id as string, ['P02'], d(-6), [], ['lista_ter'])
  documentos(aJan27.processo_id as string, ['P02'], d(-4))

  // ---------- Frota e conformidade documental ----------
  const f = criarFabricaFrota(novo, hoje, c.config.exigencias_documentais)
  const tipo = (p: string) => c.tiposVeiculo.find((t) => String(t.nome).startsWith(p))!.id
  const transp = (trecho: string) => c.transportadores.find((t) => String(t.razao_social).includes(trecho))!

  // Judicial — contratados pelas Caixas Escolares (habilitação: Res. SEE 3.670/2017)
  const tFict = transp('Transportes Fictícios')
  const tNorte = transp('Rota Norte')
  const tAuto = transp('Motorista Autônomo')
  f.documentar('contratado', tFict, { pj_fgts: 'a_vencer' })
  f.documentar('contratado', tNorte, { pj_cndt: 'vencido' })
  f.documentar('contratado', tAuto)

  const vanUdi = f.veiculo({ placa: 'QWE1A23', renavam: '12345678901', tipo_veiculo_id: tipo('Van'), marca_modelo: 'Van escolar 16 lug. (fictícia)', ano_fabricacao: 2019, lotacao: 15, proprietario_tipo: 'transportador', transportador_id: tFict.id }, { v_laudo: 'a_vencer', v_seguro: 'ausente' })
  const adaptadoUdi = f.veiculo({ placa: 'RTY2B34', renavam: '23456789012', tipo_veiculo_id: tipo('Veículo adaptado'), marca_modelo: 'Van com plataforma elevatória (fictícia)', ano_fabricacao: 2021, lotacao: 10, adaptado_pcd: true, proprietario_tipo: 'transportador', transportador_id: tFict.id })
  const joao = f.condutor({ nome: 'João Motorista (fictício)', vinculo_tipo: 'transportador', transportador_id: tFict.id }, { c_toxicologico: 'vencido' })
  const pedro = f.condutor({ nome: 'Pedro Motorista (fictício)', vinculo_tipo: 'transportador', transportador_id: tFict.id })
  const maria = f.condutor({ nome: 'Maria Monitora (fictícia)', funcao: 'monitor', vinculo_tipo: 'transportador', transportador_id: tFict.id, cnh_numero: null, cnh_categoria: null, cnh_validade: null })
  f.alocar({ instrumento_id: c1.id, veiculo_id: vanUdi.id, condutor_id: joao.id, rota: 'Comunidade rural → E.E. Professora Aurora', inicio: c1.vigencia_inicio })
  f.alocar({ instrumento_id: c2.id, veiculo_id: adaptadoUdi.id, condutor_id: pedro.id, monitor_id: maria.id, rota: 'Residência → E.E. Rio das Pedras', inicio: c2.vigencia_inicio })

  const picape = f.veiculo({ placa: 'MOC4C56', renavam: '34567890123', tipo_veiculo_id: tipo('Veículo com tração'), marca_modelo: 'Picape 4x4 adaptada (fictícia)', ano_fabricacao: 2020, lotacao: 4, proprietario_tipo: 'transportador', transportador_id: tNorte.id }, { v_laudo: 'vencido' })
  const antonio = f.condutor({ nome: 'Antônio Motorista (fictício)', vinculo_tipo: 'transportador', transportador_id: tNorte.id }, { c_curso: 'a_vencer' })
  f.alocar({ instrumento_id: c3.id, veiculo_id: picape.id, condutor_id: antonio.id, rota: 'Zona rural → E.E. Serra Verde', inicio: c3.vigencia_inicio })

  const carro = f.veiculo({ placa: 'AUT5D67', renavam: '45678901234', tipo_veiculo_id: tipo('Automóvel'), marca_modelo: 'Automóvel escolar (fictício)', ano_fabricacao: 2022, lotacao: 4, proprietario_tipo: 'transportador', transportador_id: tAuto.id })
  const autonomo = f.condutor({ nome: 'Motorista Autônomo (fictício)', cpf: tAuto.cpf_cnpj, vinculo_tipo: 'transportador', transportador_id: tAuto.id })
  f.alocar({ instrumento_id: c4.id, veiculo_id: carro.id, condutor_id: autonomo.id, rota: 'Residência → E.E. Vereda Grande', inicio: c4.vigencia_inicio })

  // PTE — quem o município contratou, frota própria, rotas e despesas
  const novosTransp = [
    novo({ tipo_pessoa: 'PJ', cpf_cnpj: cnpjComDigitos('880000010001'), razao_social: 'Transportes Sertão Fictício Ltda', telefone: '(38) 0000-0001', email: null, ativo: true }),
    novo({ tipo_pessoa: 'PJ', cpf_cnpj: cnpjComDigitos('880000020001'), razao_social: 'Cooperativa Rural de Transporte Fictícia', telefone: '(34) 0000-0002', email: null, ativo: true }),
  ]
  out.transportadores = novosTransp
  const [sertao, coop] = novosTransp

  const cMoc = push('contratacoes_municipais', novo({ adesao_id: aMoc26.id, tipo: 'terceirizado', transportador_id: sertao.id, numero_contrato: '045/2026', modalidade: 'pregao', numero_processo: 'PE 012/2026', data_assinatura: somarDias(String(t1.vigencia_inicio), -10), vigencia_inicio: t1.vigencia_inicio, vigencia_fim: t1.vigencia_fim, valor: 380000, objeto: 'Rotas R01 a R04 (fictício)', fiscal_nome: 'Fiscal municipal (fictício)', ativo: true }))
  const cMocFrota = push('contratacoes_municipais', novo({ adesao_id: aMoc26.id, tipo: 'frota_propria', objeto: 'Rotas R05 e R06 com ônibus da prefeitura (fictício)', fiscal_nome: 'Fiscal municipal (fictício)', ativo: true }))
  const onibus1 = f.veiculo({ placa: 'SRT1F22', renavam: '56789012345', tipo_veiculo_id: tipo('Ônibus'), marca_modelo: 'Ônibus rural (fictício)', ano_fabricacao: 2016, lotacao: 44, proprietario_tipo: 'transportador', transportador_id: sertao.id }, { v_laudo: 'vencido', v_tacografo: 'a_vencer' })
  const onibus2 = f.veiculo({ placa: 'SRT2G33', renavam: '67890123456', tipo_veiculo_id: tipo('Ônibus'), marca_modelo: 'Ônibus rural (fictício)', ano_fabricacao: 2018, lotacao: 44, proprietario_tipo: 'transportador', transportador_id: sertao.id })
  const onibusPref = f.veiculo({ placa: 'MOC0E11', renavam: '78901234567', tipo_veiculo_id: tipo('Ônibus'), marca_modelo: 'Ônibus escolar Caminho da Escola (fictício)', ano_fabricacao: 2020, lotacao: 44, proprietario_tipo: 'municipio', municipio_id: moc.id }, { v_seguro: 'ausente' })
  const mot1 = f.condutor({ nome: 'Carlos Motorista Sertão (fictício)', vinculo_tipo: 'transportador', transportador_id: sertao.id }, { c_cnh: 'a_vencer' })
  const mot2 = f.condutor({ nome: 'Ana Motorista Sertão (fictícia)', vinculo_tipo: 'transportador', transportador_id: sertao.id, data_nascimento: '1990-08-20' })
  const motPref = f.condutor({ nome: 'José Motorista da Prefeitura (fictício)', vinculo_tipo: 'municipio', municipio_id: moc.id }, { c_criminal: 'ausente' })
  f.alocar({ contratacao_id: cMoc.id, veiculo_id: onibus1.id, condutor_id: mot1.id, rota: 'R01 e R02', inicio: t1.vigencia_inicio })
  f.alocar({ contratacao_id: cMoc.id, veiculo_id: onibus2.id, condutor_id: mot2.id, rota: 'R03 e R04', inicio: t1.vigencia_inicio })
  f.alocar({ contratacao_id: cMocFrota.id, veiculo_id: onibusPref.id, condutor_id: motPref.id, rota: 'R05 e R06', inicio: t1.vigencia_inicio })
  for (const [codigo, veic, contr] of [['R01', onibus1, cMoc], ['R02', onibus1, cMoc], ['R03', onibus2, cMoc], ['R04', onibus2, cMoc], ['R05', onibusPref, cMocFrota], ['R06', onibusPref, cMocFrota]] as const)
    Object.assign(rotasMoc.find((r) => r.codigo === codigo)!, { veiculo_id: veic.id, contratacao_id: contr.id })

  // Despesas do município (comprovação em até 30 dias úteis — art. 22, § 1º)
  for (let i = 0; i < 7; i++) {
    const data = somarDias(`${Number(String(t1.vigencia_inicio).slice(0, 4))}-03-05`, 30 * i)
    const semComprovacao = i === 5
    push('despesas_pte', novo({ adesao_id: aMoc26.id, contratacao_id: cMoc.id, data_transacao: data, favorecido: sertao.razao_social, cpf_cnpj: sertao.cpf_cnpj, categoria: 'servico_terceirizado', descricao: `Serviço de transporte — medição ${i + 1} (fictício)`, valor: 31000, nf_numero: semComprovacao ? null : `NF-e ${1200 + i}`, data_comprovacao: semComprovacao ? null : somarDias(data, 12) }))
    push('despesas_pte', novo({ adesao_id: aMoc26.id, contratacao_id: cMocFrota.id, data_transacao: somarDias(data, 3), favorecido: 'Posto de Combustível Fictício Ltda', cpf_cnpj: cnpjComDigitos('990000990001'), categoria: 'combustivel', descricao: 'Diesel — ônibus da prefeitura (fictício)', valor: 6800, nf_numero: `NF-e ${5400 + i}`, data_comprovacao: somarDias(data, 8) }))
  }

  // UDI 2027 — cooperativa contratada
  const cUdi = push('contratacoes_municipais', novo({ adesao_id: aUdi27.id, tipo: 'terceirizado', transportador_id: coop.id, numero_contrato: '010/2027', modalidade: 'credenciamento', numero_processo: 'Credenciamento 002/2026', data_assinatura: d(-5), vigencia_inicio: '2027-02-01', vigencia_fim: '2027-12-20', valor: 96000, objeto: 'Rotas R1 a R4 (fictício)', fiscal_nome: 'Fiscal municipal (fictício)', ativo: true }))
  const vanCoop = f.veiculo({ placa: 'COP3H44', renavam: '89012345678', tipo_veiculo_id: tipo('Van'), marca_modelo: 'Van escolar (fictícia)', ano_fabricacao: 2023, lotacao: 16, proprietario_tipo: 'transportador', transportador_id: coop.id })
  const motCoop = f.condutor({ nome: 'Rita Motorista Cooperativa (fictícia)', vinculo_tipo: 'transportador', transportador_id: coop.id })
  f.alocar({ contratacao_id: cUdi.id, veiculo_id: vanCoop.id, condutor_id: motCoop.id, rota: 'R1 a R4', inicio: d(-5) })

  Object.assign(out, {
    veiculos: f.veiculos,
    condutores: f.condutores,
    alocacoes: f.alocacoes,
    documentos: [...(out.documentos ?? []), ...f.documentos],
    documento_versoes: [...(out.documento_versoes ?? []), ...f.versoes],
  })
  return out
}
