// Checklist de documentos obrigatórios por etapa. Alguns documentos só são exigidos
// conforme o caso (ex.: laudo só se o aluno for PcD) — as "condições" vêm dos dados
// da caracterização e da definição de valor.

import type { Registro } from '../dados/tipos'

export const CONDICOES: Record<string, string> = {
  sempre: 'Sempre',
  opcional: 'Opcional',
  se_pcd: 'Se o estudante é PcD / mobilidade reduzida',
  se_dispositivo_ou_acompanhante: 'Se usa dispositivo de mobilidade ou precisa de acompanhante',
  se_obstaculos: 'Se o trajeto tem obstáculos',
  se_rota_nao_atende: 'Se a rota PTE/municipal não atende',
  se_tres_cotacoes: 'Se o valor for definido por 3 cotações',
}

export interface ItemChecklist {
  tipo_documento_id: string
  nome: string
  condicao: string
  exigido: boolean
  atendido: boolean
  quantidade: number
}

interface DadosCondicoes {
  demanda?: Registro
  caracterizacoes: Registro[]
  saude: Registro[]
}

/** Quais condições estão "ligadas" para este processo. */
export function condicoesAtivas(d: DadosCondicoes): Set<string> {
  const c = new Set<string>(['sempre'])
  if (d.saude.some((s) => s.pcd_mobilidade_reduzida)) c.add('se_pcd')
  if (d.saude.some((s) => (s.dispositivo_mobilidade && s.dispositivo_mobilidade !== 'nenhum') || s.necessita_acompanhante))
    c.add('se_dispositivo_ou_acompanhante')
  if (d.caracterizacoes.some((x) => Array.isArray(x.obstaculos) && x.obstaculos.some((o) => o !== 'nenhum'))) c.add('se_obstaculos')
  if (d.caracterizacoes.some((x) => x.rota_existente && x.rota_existente !== 'pode_atender')) c.add('se_rota_nao_atende')
  if (d.demanda?.metodo_valor === 'tres_cotacoes') c.add('se_tres_cotacoes')
  return c
}

export function avaliarChecklist(
  modelos: Registro[],
  tiposDocumento: Registro[],
  documentosDoProcesso: Registro[],
  ativas: Set<string>,
): ItemChecklist[] {
  return modelos.map((m) => {
    const quantidade = documentosDoProcesso.filter((d) => d.tipo_documento_id === m.tipo_documento_id).length
    const exigido = ativas.has(String(m.condicao))
    return {
      tipo_documento_id: String(m.tipo_documento_id),
      nome: String(tiposDocumento.find((t) => t.id === m.tipo_documento_id)?.nome ?? '?'),
      condicao: String(m.condicao),
      exigido,
      atendido: quantidade > 0,
      quantidade,
    }
  })
}

export const documentosFaltantes = (itens: ItemChecklist[]) => itens.filter((i) => i.exigido && !i.atendido)
