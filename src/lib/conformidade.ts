// Conformidade legal da frota: para cada veículo, condutor/monitor e contratado, verifica
// cada documento exigido (CTB, CONTRAN, DETRAN, SEE) e diz se está em dia, a vencer,
// vencido ou ausente. Catálogo em `exigencias_documentais` (docs/02-exigencias-documentais.md).

import { diasCorridos } from './contratos/calculos'
import { somarMeses } from './datas'
import type { Colecao, Registro } from './dados/tipos'

export type StatusDocumento = 'em_dia' | 'a_vencer' | 'vencido' | 'ausente'
export type Entidade = 'veiculo' | 'condutor' | 'contratado'

/** Faltando até este nº de dias para vencer, o documento fica "a vencer". */
export const AVISO_VENCIMENTO_DIAS = 30

export interface ItemConformidade {
  exigencia: Registro
  status: StatusDocumento
  validade: string | null
  documento?: Registro
  /** true = exigência legal/normativa (bloqueia); false = recomendada (só avisa). */
  obrigatoria: boolean
}

export interface ConformidadeEntidade {
  entidade: Entidade
  registro: Registro
  rotulo: string
  itens: ItemConformidade[]
  pendentes: ItemConformidade[]
}

/** Quais "condições" do catálogo se aplicam a este registro. */
export function condicoesDe(entidade: Entidade, r: Registro): Set<string> {
  const c = new Set(['todos'])
  if (entidade === 'veiculo') c.add(String(r.tipo_transporte ?? 'rodoviario'))
  if (entidade === 'condutor') c.add(String(r.funcao ?? 'motorista'))
  if (entidade === 'contratado') c.add(r.tipo_pessoa === 'PF' ? 'pf' : 'pj')
  return c
}

const CAMPO: Record<Entidade, string> = { veiculo: 'veiculo_id', condutor: 'condutor_id', contratado: 'transportador_id' }

/** Validade de um documento: a informada nele ou a calculada pela periodicidade da exigência. */
export function validadeDocumento(doc: Registro, exigencia: Registro): string | null {
  if (doc.data_validade) return String(doc.data_validade)
  const meses = exigencia.validade_meses
  if (meses === null || meses === undefined || meses === '' || Number(meses) === 0) return null
  return somarMeses(String(doc.data_documento), Number(meses))
}

export function avaliarEntidade(
  entidade: Entidade,
  registro: Registro,
  exigencias: Registro[],
  documentos: Registro[],
  hoje: string,
  rotulo = '',
): ConformidadeEntidade {
  const condicoes = condicoesDe(entidade, registro)
  const itens = exigencias
    .filter((e) => e.ativo !== false && e.aplica_a === entidade && condicoes.has(String(e.condicao)))
    .map((exigencia): ItemConformidade => {
      const docs = documentos
        .filter((d) => d[CAMPO[entidade]] === registro.id && d.tipo_documento_id === exigencia.tipo_documento_id)
        .sort((a, b) => String(b.data_documento).localeCompare(String(a.data_documento)))
      const obrigatoria = exigencia.forca !== 'recomendada'
      const doc = docs[0]
      if (!doc) return { exigencia, status: 'ausente', validade: null, obrigatoria }
      const validade = validadeDocumento(doc, exigencia)
      let status: StatusDocumento = 'em_dia'
      if (validade) {
        const dias = diasCorridos(hoje, validade)
        status = dias < 0 ? 'vencido' : dias <= AVISO_VENCIMENTO_DIAS ? 'a_vencer' : 'em_dia'
      }
      return { exigencia, status, validade, documento: doc, obrigatoria }
    })
  return { entidade, registro, rotulo, itens, pendentes: itens.filter((i) => i.obrigatoria && (i.status === 'vencido' || i.status === 'ausente')) }
}

export const ROTULO_STATUS_DOC: Record<StatusDocumento, string> = {
  em_dia: 'Em dia',
  a_vencer: 'A vencer',
  vencido: 'Vencido',
  ausente: 'Não enviado',
}

type Lista = (c: Colecao) => Registro[]

/** Alocações vigentes (sem fim ou com fim no futuro) de um contrato ou contratação municipal. */
export function alocacoesVigentes(lista: Lista, filtro: { instrumento_id?: string; contratacao_id?: string }, hoje: string) {
  return lista('alocacoes').filter(
    (a) =>
      (filtro.instrumento_id ? a.instrumento_id === filtro.instrumento_id : a.contratacao_id === filtro.contratacao_id) &&
      (!a.fim || String(a.fim) >= hoje),
  )
}

export const rotuloVeiculo = (v: Registro) => `${v.placa ?? v.inscricao_capitania ?? 'Veículo'}${v.marca_modelo ? ` · ${v.marca_modelo}` : ''}`
export const rotuloCondutor = (c: Registro) => `${c.nome} (${c.funcao === 'monitor' ? 'monitor' : c.funcao === 'condutor_embarcacao' ? 'condutor de embarcação' : 'motorista'})`

/**
 * Conformidade de tudo que roda num contrato (Judicial) ou numa contratação do município (PTE):
 * o contratado (habilitação — só no Judicial), veículos, condutores e monitores alocados.
 */
export function conformidadeDoContexto(
  lista: Lista,
  filtro: { instrumento_id?: string; contratacao_id?: string },
  hoje: string,
  transportadorId?: unknown,
): ConformidadeEntidade[] {
  const exigencias = lista('exigencias_documentais')
  const documentos = lista('documentos')
  const acha = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
  const aloc = alocacoesVigentes(lista, filtro, hoje)
  const resultado: ConformidadeEntidade[] = []
  const contratado = transportadorId ? acha('transportadores', transportadorId) : undefined
  if (contratado) resultado.push(avaliarEntidade('contratado', contratado, exigencias, documentos, hoje, String(contratado.razao_social)))
  for (const id of new Set(aloc.map((a) => a.veiculo_id).filter(Boolean))) {
    const v = acha('veiculos', id)
    if (v) resultado.push(avaliarEntidade('veiculo', v, exigencias, documentos, hoje, rotuloVeiculo(v)))
  }
  for (const id of new Set(aloc.flatMap((a) => [a.condutor_id, a.monitor_id]).filter(Boolean))) {
    const c = acha('condutores', id)
    if (c) resultado.push(avaliarEntidade('condutor', c, exigencias, documentos, hoje, rotuloCondutor(c)))
  }
  return resultado
}

export const totalPendencias = (r: ConformidadeEntidade[]) => r.reduce((t, e) => t + e.pendentes.length, 0)
