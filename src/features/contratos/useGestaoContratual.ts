import { useMemo } from 'react'
import { alertasInstrumento, type Alerta } from '@/lib/contratos/alertas'
import { calcularSituacao, type SituacaoInstrumento } from '@/lib/contratos/calculos'
import { hojeIso } from '@/lib/diasUteis'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'

export interface InstrumentoComSituacao {
  instrumento: Registro
  processo?: Registro
  situacao: SituacaoInstrumento
  alertas: Alerta[]
  contratante: string
  contratado: string
  sigla_sre: string
}

const doInstrumento = (lista: Registro[] | undefined, id: string) => (lista ?? []).filter((r) => r.instrumento_id === id)

/** Carrega todos os instrumentos visíveis ao usuário, já com situação calculada e alertas. */
export function useGestaoContratual() {
  const { dados, carregando, recarregar } = useTodos()
  const hoje = hojeIso()

  const itens = useMemo<InstrumentoComSituacao[]>(() => {
    const achar = (c: Colecao, id: unknown) => dados[c]?.find((r) => r.id === id)
    return (dados.instrumentos ?? []).map((i) => {
      const situacao = calcularSituacao(i, doInstrumento(dados.aditivos, i.id), doInstrumento(dados.parcelas, i.id), hoje)
      const termo = i.tipo === 'termo_pte'
      return {
        instrumento: i,
        processo: achar('processos', i.processo_id),
        situacao,
        alertas: alertasInstrumento(situacao, doInstrumento(dados.prestacoes_contas, i.id), doInstrumento(dados.ocorrencias, i.id), hoje),
        contratante: termo ? 'Estado de MG / SEE' : String(achar('caixas_escolares', i.caixa_escolar_id)?.razao_social ?? ''),
        contratado: termo
          ? `Município de ${achar('municipios', i.municipio_id)?.nome ?? ''}`
          : String(achar('transportadores', i.transportador_id)?.razao_social ?? ''),
        sigla_sre: String(achar('sres', i.sre_id)?.sigla ?? ''),
      }
    })
  }, [dados, hoje])

  return { dados, itens, carregando, recarregar, hoje, doInstrumento: (c: Colecao, id: string) => doInstrumento(dados[c], id) }
}
