// Situação consolidada: etapa atual + semáforo de cada processo, situação dos instrumentos,
// conformidade documental da frota em serviço e despesas do PTE sem comprovação.
// Usado pelo painel, pela página inicial e pelas listas.

import { conformidadeDoContexto, type ConformidadeEntidade } from './conformidade'
import { somarDiasUteis } from './diasUteis'
import { calcularSituacao, type SituacaoInstrumento } from './contratos/calculos'
import type { Colecao, Registro } from './dados/tipos'
import { etapaAtual, montarDadosProcesso } from './fluxo/processo'
import { calcularSemaforo, type Semaforo } from './fluxo/sla'

type Lista = (c: Colecao) => Registro[]

export interface SituacaoProcesso {
  processo: Registro
  demanda?: Registro
  adesao?: Registro
  instancia?: Registro
  modelo?: Registro
  semaforo: Semaforo
  sre_id: string | null
}

export function situacaoDosProcessos(lista: Lista, hoje: string, feriados: ReadonlySet<string>): SituacaoProcesso[] {
  const modelos = lista('etapas_modelo')
  return lista('processos')
    .map((processo) => {
      const d = montarDadosProcesso(lista, processo.id)
      if (!d.demanda && !d.adesao) return null
      const { instancia, modelo } = etapaAtual(d, modelos)
      const encerrado = d.demanda ? d.demanda.situacao !== 'ativa' : d.adesao?.status === 'encerrado'
      const semaforo = calcularSemaforo(
        {
          prazoJudicial: d.demanda?.prazo_judicial as string | undefined,
          inicioTransporte: d.demanda?.data_inicio_transporte as string | undefined,
          prazoEtapa: instancia?.prazo_sla as string | undefined,
          encerrado,
        },
        hoje,
        feriados,
      )
      return { processo, demanda: d.demanda, adesao: d.adesao, instancia, modelo, semaforo, sre_id: (processo.sre_id as string) ?? null }
    })
    .filter(Boolean) as SituacaoProcesso[]
}

export function situacaoDosInstrumentos(lista: Lista, hoje: string): { instrumento: Registro; situacao: SituacaoInstrumento }[] {
  return lista('instrumentos').map((instrumento) => ({
    instrumento,
    situacao: calcularSituacao(
      instrumento,
      lista('aditivos').filter((a) => a.instrumento_id === instrumento.id),
      lista('parcelas').filter((p) => p.instrumento_id === instrumento.id),
      hoje,
    ),
  }))
}

interface GrupoConformidade {
  codigo: string
  descricao: string
  processo_id: string | null
  instrumento_id: string | null
  sre_id: string | null
  responsaveis: unknown[]
  entidades: ConformidadeEntidade[]
}

/** Conformidade por contrato judicial (Caixa × transportador) e por contratação do município (PTE). */
export function gruposDeConformidade(lista: Lista, hoje: string): GrupoConformidade[] {
  const codigoDe = (id: unknown) => String(lista('processos').find((p) => p.id === id)?.codigo ?? '')
  const grupos: GrupoConformidade[] = []
  for (const { instrumento: i, situacao } of situacaoDosInstrumentos(lista, hoje)) {
    if (i.tipo !== 'contrato_caixa' || situacao.faixa === 'encerrado') continue
    grupos.push({
      codigo: codigoDe(i.processo_id),
      descricao: `Contrato ${i.numero}`,
      processo_id: (i.processo_id as string) ?? null,
      instrumento_id: i.id,
      sre_id: (i.sre_id as string) ?? null,
      responsaveis: [i.gestor_id, i.fiscal_id],
      entidades: conformidadeDoContexto(lista, { instrumento_id: i.id }, hoje, i.transportador_id),
    })
  }
  for (const c of lista('contratacoes_municipais').filter((x) => x.ativo !== false)) {
    const adesao = lista('adesoes_pte').find((a) => a.id === c.adesao_id)
    if (!adesao || adesao.status === 'encerrado') continue
    const municipio = lista('municipios').find((m) => m.id === adesao.municipio_id)
    const instancia = lista('processo_etapas').find((e) => e.processo_id === adesao.processo_id && e.status === 'em_andamento')
    grupos.push({
      codigo: codigoDe(adesao.processo_id),
      descricao: `PTE ${municipio?.nome ?? ''} — ${c.tipo === 'frota_propria' ? 'frota própria' : `contrato ${c.numero_contrato ?? ''}`}`,
      processo_id: (adesao.processo_id as string) ?? null,
      instrumento_id: null,
      sre_id: (adesao.sre_id as string) ?? null,
      responsaveis: [instancia?.responsavel_id],
      entidades: conformidadeDoContexto(lista, { contratacao_id: c.id }, hoje),
    })
  }
  return grupos
}

/** Despesas do PTE sem comprovação após 30 dias úteis da transação. */
export function despesasAtrasadas(lista: Lista, hoje: string, feriados: ReadonlySet<string>) {
  return lista('despesas_pte')
    .map((despesa) => {
      const prazo = somarDiasUteis(String(despesa.data_transacao), 30, feriados)
      const adesao = lista('adesoes_pte').find((a) => a.id === despesa.adesao_id)
      return {
        despesa,
        prazo,
        atrasada: !despesa.data_comprovacao && prazo < hoje,
        comprovadaForaDoPrazo: !!despesa.data_comprovacao && String(despesa.data_comprovacao) > prazo,
        processo_id: (adesao?.processo_id as string) ?? null,
        sre_id: (adesao?.sre_id as string) ?? null,
        codigo: String(lista('processos').find((p) => p.id === adesao?.processo_id)?.codigo ?? ''),
      }
    })
    .filter((d) => d.atrasada)
}
