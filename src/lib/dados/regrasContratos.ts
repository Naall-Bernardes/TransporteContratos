// Regras de integridade da gestão contratual (equivalem a CHECKs e triggers do banco).

import { calcularSituacao, TRANSICOES_PRESTACAO, vigenciaAntesDoAditivo, ESTADOS_FINAIS_PRESTACAO } from '../contratos/calculos'
import { formatarData, formatarMoeda } from '../formatacao'
import type { Colecao, ColecaoContrato, Consulta, Registro, Usuario } from './tipos'

type Campos = Record<string, unknown>
type Erros = Record<string, string>

export interface ContextoValidacao {
  consulta: Consulta
  /** Registros de outra coleção ligados ao mesmo instrumento (exclui o próprio registro). */
  irmaos: (colecao: ColecaoContrato, instrumentoId: unknown) => Registro[]
  /** Todos os registros de uma coleção (exceto o próprio registro em validação). */
  lista: (colecao: Colecao) => Registro[]
  /** Versão anterior do registro (undefined = inclusão). */
  anterior?: Registro
  usuario: Usuario
  usuarioEhAdmin: boolean
}

const vazio = (v: unknown) => v === null || v === undefined || v === ''
const num = (v: unknown) => (vazio(v) ? 0 : Number(v))
const ENCERRADOS = ['encerrado', 'rescindido']

export const ROTULO_STATUS_PRESTACAO: Record<string, string> = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  em_diligencia: 'Em diligência',
  reapresentada: 'Reapresentada',
  aprovada: 'Aprovada',
  aprovada_ressalvas: 'Aprovada com ressalvas',
  reprovada: 'Reprovada',
}

export function normalizarContrato(colecao: ColecaoContrato, d: Campos, consulta: Consulta): Campos {
  switch (colecao) {
    case 'instrumentos':
      if (d.tipo === 'contrato_caixa') {
        d.municipio_id = null
        const escola = consulta('escolas', consulta('caixas_escolares', d.caixa_escolar_id)?.escola_id)
        if ('caixa_escolar_id' in d) d.sre_id = (escola?.sre_id as string | undefined) ?? null
      } else if (d.tipo === 'termo_pte') {
        d.caixa_escolar_id = null
        d.transportador_id = null
        if ('municipio_id' in d) d.sre_id = (consulta('municipios', d.municipio_id)?.sre_id as string | undefined) ?? null
      }
      if ('situacao_final' in d && d.situacao_final)
        d.status = d.situacao_final === 'rescindido' ? 'rescindido' : 'encerrado'
      break
    case 'aditivos':
      if (!d.altera_prazo) d.nova_vigencia_fim = null
      if (!d.altera_valor) d.valor_variacao = null
      break
    case 'ocorrencias':
      if (!d.notificacao_data) {
        d.notificacao_prazo = null
        d.notificacao_respondida_em = null
      }
      break
  }
  return d
}

function instrumentoBloqueado(r: Registro, ctx: ContextoValidacao, erros: Erros) {
  const inst = ctx.consulta('instrumentos', r.instrumento_id)
  if (inst && ENCERRADOS.includes(String(inst.status)) && !ctx.usuarioEhAdmin)
    erros._geral = 'O instrumento está encerrado: não aceita novos lançamentos nem alterações.'
  return inst
}

export function validarContrato(colecao: ColecaoContrato, r: Registro, ctx: ContextoValidacao): Erros {
  const erros: Erros = {}

  switch (colecao) {
    case 'instrumentos': {
      if (ctx.anterior && ENCERRADOS.includes(String(ctx.anterior.status)) && !ctx.usuarioEhAdmin)
        erros._geral = 'Instrumento encerrado. Só o administrador pode alterá-lo.'
      if (r.tipo === 'contrato_caixa') {
        if (vazio(r.caixa_escolar_id)) erros.caixa_escolar_id = 'Campo obrigatório.'
        if (vazio(r.transportador_id)) erros.transportador_id = 'Campo obrigatório.'
      }
      if (r.tipo === 'termo_pte' && vazio(r.municipio_id)) erros.municipio_id = 'Campo obrigatório.'
      if (!vazio(r.valor_global) && num(r.valor_global) <= 0) erros.valor_global = 'O valor deve ser maior que zero.'
      if (r.vigencia_fim && r.vigencia_inicio && String(r.vigencia_fim) < String(r.vigencia_inicio))
        erros.vigencia_fim = 'O fim da vigência é anterior ao início.'
      if (!vazio(r.valor_executado) && num(r.valor_executado) < 0) erros.valor_executado = 'O valor executado não pode ser negativo.'
      const s = calcularSituacao(r, ctx.anterior ? ctx.irmaos('aditivos', r.id) : [], ctx.anterior ? ctx.irmaos('parcelas', r.id) : [], '2000-01-01')
      if (s.saldo < 0) {
        if (!vazio(r.valor_executado)) erros.valor_executado = `O valor executado passa do valor do contrato (${formatarMoeda(s.valor_atual)}).`
        else if (ctx.anterior) erros.valor_global = `Com este valor o saldo fica negativo (já executado: ${formatarMoeda(s.valor_executado)}).`
      }
      if (r.tipo_garantia && r.tipo_garantia !== 'sem_garantia' && (vazio(r.valor_garantia) || num(r.valor_garantia) <= 0))
        erros.valor_garantia = 'Informe o valor da garantia.'
      // Encerramento
      if (ENCERRADOS.includes(String(r.status))) {
        if (vazio(r.encerrado_em)) erros.encerrado_em = 'Informe a data de encerramento.'
        if (vazio(r.situacao_final)) erros.situacao_final = 'Informe a situação final.'
        if (r.situacao_final === 'concluido_com_pendencias' && vazio(r.pendencias_encerramento))
          erros.pendencias_encerramento = 'Descreva as pendências.'
      }
      break
    }

    case 'aditivos': {
      const inst = instrumentoBloqueado(r, ctx, erros)
      if (!inst) break
      if (!r.altera_prazo && !r.altera_valor && !r.altera_rota_veiculo)
        erros._geral = 'Marque ao menos um objeto do aditivo: prazo, valor ou rota/veículo.'
      const outros = ctx.irmaos('aditivos', r.instrumento_id)
      const fimAnterior = vigenciaAntesDoAditivo(inst, [...outros, r], r.id)
      if (r.data_assinatura && String(r.data_assinatura) > fimAnterior)
        erros.data_assinatura = `Assinado após o fim da vigência (${formatarData(fimAnterior)}): o instrumento já estava extinto.`
      if (r.altera_prazo) {
        if (vazio(r.nova_vigencia_fim)) erros.nova_vigencia_fim = 'Informe a nova data de término.'
        else if (String(r.nova_vigencia_fim) <= fimAnterior)
          erros.nova_vigencia_fim = `A nova data deve ser posterior à vigência atual (${formatarData(fimAnterior)}).`
      }
      if (r.altera_valor) {
        if (num(r.valor_variacao) === 0) erros.valor_variacao = 'Informe o acréscimo (+) ou a supressão (−).'
        else {
          const s = calcularSituacao(inst, [...outros, r], ctx.irmaos('parcelas', r.instrumento_id), '2000-01-01')
          if (s.saldo < 0)
            erros.valor_variacao = `A supressão deixaria o valor abaixo do já executado (${formatarMoeda(s.valor_executado)}).`
        }
      }
      if (r.altera_rota_veiculo && vazio(r.descricao)) erros.descricao = 'Descreva a alteração de rota/veículo.'
      break
    }

    case 'parcelas': {
      const inst = instrumentoBloqueado(r, ctx, erros)
      if (!inst) break
      if (!vazio(r.valor_previsto) && num(r.valor_previsto) <= 0) erros.valor_previsto = 'O valor deve ser maior que zero.'
      if (vazio(r.valor_pago) !== vazio(r.data_pagamento)) {
        if (vazio(r.valor_pago)) erros.valor_pago = 'Informe o valor pago.'
        else erros.data_pagamento = 'Informe a data do pagamento.'
      }
      if (!vazio(r.valor_pago)) {
        const s = calcularSituacao(inst, ctx.irmaos('aditivos', r.instrumento_id), [...ctx.irmaos('parcelas', r.instrumento_id), r], '2000-01-01')
        if (s.saldo < 0)
          erros.valor_pago = `Pagamento excede o saldo contratual (saldo disponível: ${formatarMoeda(s.saldo + num(r.valor_pago))}).`
      }
      break
    }

    case 'fiscalizacoes': {
      const inst = instrumentoBloqueado(r, ctx, erros)
      if (!inst) break
      const s = calcularSituacao(inst, ctx.irmaos('aditivos', r.instrumento_id), [], '2000-01-01')
      const comp = String(r.competencia ?? '')
      if (comp && (comp < String(inst.vigencia_inicio).slice(0, 7) || comp > s.vigencia_fim_atual.slice(0, 7)))
        erros.competencia = 'Competência fora da vigência do instrumento.'
      if (!vazio(r.dias_rodados) && (num(r.dias_rodados) < 0 || num(r.dias_rodados) > 31))
        erros.dias_rodados = 'Entre 0 e 31 dias.'
      for (const c of ['alunos_transportados', 'km_rodados'])
        if (!vazio(r[c]) && num(r[c]) < 0) erros[c] = 'Não pode ser negativo.'
      break
    }

    case 'ocorrencias':
      if (r.notificacao_prazo && r.notificacao_data && String(r.notificacao_prazo) < String(r.notificacao_data))
        erros.notificacao_prazo = 'O prazo de resposta é anterior à notificação.'
      break

    case 'prestacoes_contas': {
      const de = String(ctx.anterior?.status ?? '')
      const para = String(r.status)
      if (!ctx.anterior && para !== 'pendente') erros._geral = 'A prestação de contas deve ser criada como "Pendente".'
      if (ctx.anterior && de !== para && !TRANSICOES_PRESTACAO[de]?.includes(para))
        erros._geral =
          de === 'reapresentada' && para === 'em_diligencia'
            ? 'A diligência é de ciclo único: após a reapresentação, a prestação deve ser decidida.'
            : `Mudança de situação não permitida: ${ROTULO_STATUS_PRESTACAO[de]} → ${ROTULO_STATUS_PRESTACAO[para]}.`
      if (ctx.anterior && de === para && ESTADOS_FINAIS_PRESTACAO.includes(de) && !ctx.usuarioEhAdmin)
        erros._geral = 'Prestação de contas já decidida. Só o administrador pode alterá-la.'

      const exige = (campo: string, msg = 'Campo obrigatório.') => vazio(r[campo]) && (erros[campo] = msg)
      if (para !== 'pendente') exige('data_entrega', 'Informe a data de entrega.')
      if (['em_diligencia', 'reapresentada'].includes(para) || (ESTADOS_FINAIS_PRESTACAO.includes(para) && r.diligencia_data)) {
        exige('diligencia_data')
        exige('diligencia_descricao')
        exige('diligencia_prazo')
      }
      if (para === 'reapresentada' || (ESTADOS_FINAIS_PRESTACAO.includes(para) && r.diligencia_data)) exige('reapresentada_em')
      if (ESTADOS_FINAIS_PRESTACAO.includes(para)) {
        exige('data_decisao')
        exige('analista_id')
        exige('parecer')
      }
      if (r.diligencia_prazo && r.diligencia_data && String(r.diligencia_prazo) < String(r.diligencia_data))
        erros.diligencia_prazo = 'O prazo é anterior à data da diligência.'
      break
    }
  }
  return erros
}
