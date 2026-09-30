// Indicadores do painel (função pura: testável e reaproveitável na exportação).

import { situacaoPrazoPrestacao } from './contratos/calculos'
import { feriadosDe } from './dados/servicos'
import type { Colecao, Registro } from './dados/tipos'
import { avaliarEtapa, montarDadosProcesso } from './fluxo/processo'
import { duracaoDiasUteis } from './fluxo/sla'
import { despesasAtrasadas, gruposDeConformidade, situacaoDosInstrumentos, situacaoDosProcessos } from './monitoramento'

export function calcularPainel(lista: (c: Colecao) => Registro[], hoje: string) {
    const feriados = feriadosDe(lista)
    const procs = situacaoDosProcessos(lista, hoje, feriados)
    const demandas = procs.filter((s) => s.demanda)
    const ativas = demandas.filter((s) => s.demanda!.situacao === 'ativa')
    const modelos = lista('etapas_modelo').sort((a, b) => Number(a.ordem) - Number(b.ordem))
    const sigla = (id: unknown) => String(lista('sres').find((s) => s.id === id)?.sigla ?? '—')

    // Judicial por etapa e por SRE × semáforo
    const porEtapa = modelos
      .filter((m) => m.modulo === 'JUDICIAL')
      .map((m) => ({ rotulo: `${m.ordem}. ${m.nome}`, valor: ativas.filter((s) => s.modelo?.id === m.id).length }))
      .filter((i) => i.valor > 0)
    const sres = [...new Set(ativas.map((s) => s.sre_id))]
    const porSre = sres
      .map((id) => ({
        sigla: sigla(id),
        verde: ativas.filter((s) => s.sre_id === id && s.semaforo.cor === 'verde').length,
        amarelo: ativas.filter((s) => s.sre_id === id && s.semaforo.cor === 'amarelo').length,
        vermelho: ativas.filter((s) => s.sre_id === id && s.semaforo.cor === 'vermelho').length,
      }))
      .sort((a, b) => b.vermelho - a.vermelho || a.sigla.localeCompare(b.sigla))

    // Tempo médio por etapa (dias úteis) × SLA — etapas concluídas
    const tempoEtapa = (modulo: string) =>
      modelos
        .filter((m) => m.modulo === modulo)
        .map((m) => {
          const concl = lista('processo_etapas').filter((e) => e.etapa_modelo_id === m.id && e.status === 'concluida')
          const media = concl.length ? concl.reduce((t, e) => t + duracaoDiasUteis(String(e.iniciada_em), String(e.concluida_em), hoje, feriados), 0) / concl.length : 0
          const sla = (m.sla_dias_uteis as number | null) ?? null
          return { rotulo: `${m.codigo} ${m.nome}`, valor: Math.round(media * 10) / 10, texto: concl.length ? `${media.toFixed(1)} d (${concl.length})` : '—', referencia: sla, destaque: !!sla && media > sla }
        })
        // etapas contínuas (sem SLA, ex.: execução) ficam fora: duram meses e distorcem a escala
        .filter((i) => i.valor > 0 && i.referencia !== null)

    // Documentos pendentes por etapa (processos ativos)
    const pendDocs = new Map<string, number>()
    for (const s of procs) {
      if (!s.instancia || !s.modelo || s.semaforo.cor === 'cinza') continue
      const av = avaliarEtapa(montarDadosProcesso(lista, s.processo.id), s.modelo, lista('checklist_modelo'), lista('tipos_documento'))
      if (av.faltantes.length) {
        const chave = `${s.modelo.codigo} ${s.modelo.nome}`
        pendDocs.set(chave, (pendDocs.get(chave) ?? 0) + av.faltantes.length)
      }
    }

    // Contratos
    const inst = situacaoDosInstrumentos(lista, hoje)
    const ativosI = inst.filter((i) => !['encerrado', 'vencido'].includes(i.situacao.faixa))
    const conta = (f: string) => inst.filter((i) => i.situacao.faixa === f).length

    // PTE: ciclo mais recente aprovado (em execução) e ciclo em adesão
    const ciclos = [...lista('ciclos_pte')].sort((a, b) => Number(b.ano) - Number(a.ano))
    const resumoCiclo = (c: (typeof ciclos)[number] | undefined) => {
      if (!c) return null
      const ades = lista('adesoes_pte').filter((a) => a.ciclo_id === c.id)
      const ids = new Set(ades.map((a) => a.id))
      const termos = lista('instrumentos').filter((i) => ades.some((a) => a.processo_id === i.processo_id))
      const tids = new Set(termos.map((t) => t.id))
      return {
        ano: c.ano,
        municipios: ades.length,
        alunos: lista('pte_alunos').filter((a) => ids.has(a.adesao_id as string) && a.ativo !== false).length,
        divergencias: lista('divergencias').filter((d) => ids.has(d.adesao_id as string) && d.status === 'aberta').length,
        calculado: ades.reduce((t, a) => t + Number(lista('calculos_repasse').filter((x) => x.adesao_id === a.id).sort((x, y) => Number(y.versao) - Number(x.versao))[0]?.valor_calculado ?? 0), 0),
        repassado: lista('parcelas').filter((x) => tids.has(x.instrumento_id as string)).reduce((t, x) => t + Number(x.valor_pago || 0), 0),
        prestacoes: lista('prestacoes_contas').filter((x) => tids.has(x.instrumento_id as string) && !['aprovada', 'aprovada_ressalvas', 'reprovada'].includes(String(x.status))).length,
      }
    }

    const ocorrenciasAbertas = lista('risco_ocorrencias').filter((o) => o.status === 'aberta')
    const porRisco = lista('riscos')
      .map((r) => ({ rotulo: `${r.codigo} ${r.titulo}`, valor: ocorrenciasAbertas.filter((o) => o.risco_id === r.id).length }))
      .filter((i) => i.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    // Conformidade legal da frota em serviço (contratos judiciais e contratações do PTE)
    const entidadesEmServico = new Map<string, { pendentes: number; aVencer: number }>()
    for (const g of gruposDeConformidade(lista, hoje))
      for (const e of g.entidades)
        entidadesEmServico.set(`${e.entidade}:${e.registro.id}`, {
          pendentes: e.pendentes.length,
          aVencer: e.itens.filter((i) => i.obrigatoria && i.status === 'a_vencer').length,
        })
    const conformidade = {
      emServico: entidadesEmServico.size,
      comPendencia: [...entidadesEmServico.values()].filter((x) => x.pendentes > 0).length,
      pendencias: [...entidadesEmServico.values()].reduce((t, x) => t + x.pendentes, 0),
      aVencer: [...entidadesEmServico.values()].reduce((t, x) => t + x.aVencer, 0),
      despesasSemComprovacao: despesasAtrasadas(lista, hoje, feriados).length,
    }

    return {
      conformidade,
      ativas: ativas.length,
      vermelho: ativas.filter((s) => s.semaforo.cor === 'vermelho').length,
      amarelo: ativas.filter((s) => s.semaforo.cor === 'amarelo').length,
      judicialVencido: ativas.filter((s) => !s.demanda!.data_inicio_transporte && String(s.demanda!.prazo_judicial) < hoje).length,
      cumpridas: demandas.length - ativas.length,
      porEtapa,
      porSre,
      tempoJudicial: tempoEtapa('JUDICIAL'),
      tempoPte: tempoEtapa('PTE'),
      pendDocs: [...pendDocs.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => a.rotulo.localeCompare(b.rotulo)),
      contratos: {
        ativos: ativosI.length,
        ate90: conta('ate_90'),
        ate60: conta('ate_60'),
        ate30: conta('ate_30'),
        vencidos: conta('vencido'),
        valor: ativosI.reduce((t, i) => t + i.situacao.valor_atual, 0),
        executado: ativosI.reduce((t, i) => t + i.situacao.valor_executado, 0),
        saldo: ativosI.reduce((t, i) => t + i.situacao.saldo, 0),
        prestacoesAtrasadas: lista('prestacoes_contas').filter((x) => situacaoPrazoPrestacao(x, hoje) === 'vencida').length,
      },
      pteExecucao: resumoCiclo(ciclos.find((c) => c.aprovado_em && c.status !== 'encerrado')),
      pteAdesao: resumoCiclo(ciclos.find((c) => !c.aprovado_em)),
      porRisco,
    }
}
