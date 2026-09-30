// Regras de integridade dos módulos: documentos, fluxo, Judicial, PTE, alertas e riscos.

import { hojeIso } from '../diasUteis'
import type { ContextoValidacao } from './regrasContratos'
import type { Colecao, ColecaoDocumento, ColecaoFluxo, ColecaoGestao, ColecaoJudicial, ColecaoPte, Consulta, Registro } from './tipos'

export type ColecaoModulo = ColecaoDocumento | ColecaoFluxo | ColecaoJudicial | ColecaoPte | ColecaoGestao
type Campos = Record<string, unknown>
type Erros = Record<string, string>

const vazio = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
const num = (v: unknown) => (vazio(v) ? 0 : Number(v))

export const TAMANHO_MAXIMO_ARQUIVO = 20 * 1024 * 1024
export const TIPOS_ARQUIVO_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export const OBRIGATORIOS_MODULOS: Record<ColecaoModulo, string[]> = {
  tipos_documento: ['codigo', 'nome', 'modulo'],
  documentos: ['processo_id', 'tipo_documento_id', 'data_documento', 'versao_atual'],
  documento_versoes: ['documento_id', 'versao', 'nome_arquivo', 'mime', 'tamanho_bytes'],
  etapas_modelo: ['modulo', 'ordem', 'codigo', 'nome', 'papel_responsavel'],
  checklist_modelo: ['etapa_modelo_id', 'tipo_documento_id', 'condicao'],
  processo_etapas: ['processo_id', 'etapa_modelo_id', 'status'],
  demandas: ['processo_id', 'origem', 'numero_processo_origem', 'comarca', 'data_recebimento', 'data_ciencia', 'prazo_judicial', 'escola_id', 'situacao'],
  demanda_alunos: ['demanda_id', 'aluno_id', 'incluido_em'],
  caracterizacoes: ['demanda_id', 'demanda_aluno_id', 'status'],
  caracterizacoes_saude: ['caracterizacao_id'],
  responsaveis_legais: ['caracterizacao_id'],
  cotacoes: ['demanda_id', 'fornecedor', 'valor_mensal', 'data'],
  autorizacoes_financeiras: ['demanda_id', 'tipo', 'numero', 'data', 'valor'],
  liberacoes_recurso: ['demanda_id', 'data', 'valor'],
  ciclos_pte: ['ano', 'status', 'valor_por_aluno', 'valor_por_km', 'dias_letivos', 'num_parcelas'],
  adesoes_pte: ['processo_id', 'ciclo_id', 'municipio_id', 'data_adesao', 'status'],
  pte_alunos: ['adesao_id', 'cod_simade', 'nome', 'escola_inep', 'km_ida'],
  simade_registros: ['ciclo_id', 'cod_simade', 'escola_inep', 'situacao'],
  divergencias: ['adesao_id', 'cod_simade', 'tipo', 'status'],
  calculos_repasse: ['adesao_id', 'valor_calculado'],
  demandas_extraordinarias: ['adesao_id', 'tipo', 'data_solicitacao', 'justificativa', 'status'],
  alertas: ['chave', 'tipo', 'titulo'],
  riscos: ['codigo', 'titulo', 'categoria', 'probabilidade', 'impacto', 'estrategia', 'status'],
  risco_ocorrencias: ['risco_id', 'data', 'descricao', 'origem', 'status'],
}

export const REFERENCIAS_MODULOS: { origem: Colecao; campo: string; alvo: Colecao }[] = [
  { origem: 'documentos', campo: 'processo_id', alvo: 'processos' },
  { origem: 'documentos', campo: 'tipo_documento_id', alvo: 'tipos_documento' },
  { origem: 'documentos', campo: 'aluno_id', alvo: 'alunos' },
  { origem: 'documentos', campo: 'instrumento_id', alvo: 'instrumentos' },
  { origem: 'documentos', campo: 'aditivo_id', alvo: 'aditivos' },
  { origem: 'documentos', campo: 'prestacao_id', alvo: 'prestacoes_contas' },
  { origem: 'documento_versoes', campo: 'documento_id', alvo: 'documentos' },
  { origem: 'checklist_modelo', campo: 'etapa_modelo_id', alvo: 'etapas_modelo' },
  { origem: 'checklist_modelo', campo: 'tipo_documento_id', alvo: 'tipos_documento' },
  { origem: 'processo_etapas', campo: 'processo_id', alvo: 'processos' },
  { origem: 'processo_etapas', campo: 'etapa_modelo_id', alvo: 'etapas_modelo' },
  { origem: 'processo_etapas', campo: 'responsavel_id', alvo: 'usuarios' },
  { origem: 'demandas', campo: 'processo_id', alvo: 'processos' },
  { origem: 'demandas', campo: 'escola_id', alvo: 'escolas' },
  { origem: 'demandas', campo: 'caixa_escolar_id', alvo: 'caixas_escolares' },
  { origem: 'demandas', campo: 'responsavel_sre_id', alvo: 'usuarios' },
  { origem: 'demandas', campo: 'preco_referencia_id', alvo: 'precos_referencia' },
  { origem: 'demandas', campo: 'cotacao_escolhida_id', alvo: 'cotacoes' },
  { origem: 'demanda_alunos', campo: 'demanda_id', alvo: 'demandas' },
  { origem: 'demanda_alunos', campo: 'aluno_id', alvo: 'alunos' },
  { origem: 'caracterizacoes', campo: 'demanda_id', alvo: 'demandas' },
  { origem: 'caracterizacoes', campo: 'demanda_aluno_id', alvo: 'demanda_alunos' },
  { origem: 'caracterizacoes', campo: 'tipo_veiculo_indicado_id', alvo: 'tipos_veiculo' },
  { origem: 'caracterizacoes', campo: 'tipo_veiculo_aprovado_id', alvo: 'tipos_veiculo' },
  { origem: 'caracterizacoes', campo: 'analista_id', alvo: 'usuarios' },
  { origem: 'caracterizacoes_saude', campo: 'caracterizacao_id', alvo: 'caracterizacoes' },
  { origem: 'responsaveis_legais', campo: 'caracterizacao_id', alvo: 'caracterizacoes' },
  { origem: 'cotacoes', campo: 'demanda_id', alvo: 'demandas' },
  { origem: 'autorizacoes_financeiras', campo: 'demanda_id', alvo: 'demandas' },
  { origem: 'liberacoes_recurso', campo: 'demanda_id', alvo: 'demandas' },
  { origem: 'adesoes_pte', campo: 'processo_id', alvo: 'processos' },
  { origem: 'adesoes_pte', campo: 'ciclo_id', alvo: 'ciclos_pte' },
  { origem: 'adesoes_pte', campo: 'municipio_id', alvo: 'municipios' },
  { origem: 'pte_alunos', campo: 'adesao_id', alvo: 'adesoes_pte' },
  { origem: 'simade_registros', campo: 'ciclo_id', alvo: 'ciclos_pte' },
  { origem: 'divergencias', campo: 'adesao_id', alvo: 'adesoes_pte' },
  { origem: 'calculos_repasse', campo: 'adesao_id', alvo: 'adesoes_pte' },
  { origem: 'demandas_extraordinarias', campo: 'adesao_id', alvo: 'adesoes_pte' },
  { origem: 'riscos', campo: 'responsavel_id', alvo: 'usuarios' },
  { origem: 'risco_ocorrencias', campo: 'risco_id', alvo: 'riscos' },
  { origem: 'risco_ocorrencias', campo: 'processo_id', alvo: 'processos' },
  { origem: 'risco_ocorrencias', campo: 'instrumento_id', alvo: 'instrumentos' },
]

export const UNICOS_MODULOS: Partial<Record<Colecao, { campos: string[]; mensagem: string }[]>> = {
  tipos_documento: [{ campos: ['codigo'], mensagem: 'Código já utilizado.' }],
  documento_versoes: [{ campos: ['versao', 'documento_id'], mensagem: 'Versão já existe.' }],
  etapas_modelo: [{ campos: ['codigo'], mensagem: 'Código de etapa já utilizado.' }],
  checklist_modelo: [{ campos: ['tipo_documento_id', 'etapa_modelo_id'], mensagem: 'Documento já está no checklist desta etapa.' }],
  processo_etapas: [{ campos: ['etapa_modelo_id', 'processo_id'], mensagem: 'Etapa já existe neste processo.' }],
  demandas: [{ campos: ['processo_id'], mensagem: 'Processo já vinculado a outra demanda.' }],
  demanda_alunos: [{ campos: ['aluno_id', 'demanda_id'], mensagem: 'Aluno já incluído nesta demanda.' }],
  caracterizacoes: [{ campos: ['demanda_aluno_id'], mensagem: 'Já existe caracterização para este aluno nesta demanda.' }],
  caracterizacoes_saude: [{ campos: ['caracterizacao_id'], mensagem: 'Já registrado.' }],
  responsaveis_legais: [{ campos: ['caracterizacao_id'], mensagem: 'Já registrado.' }],
  autorizacoes_financeiras: [{ campos: ['numero', 'tipo', 'demanda_id'], mensagem: 'Número já registrado.' }],
  ciclos_pte: [{ campos: ['ano'], mensagem: 'Já existe ciclo para este ano.' }],
  adesoes_pte: [{ campos: ['municipio_id', 'ciclo_id'], mensagem: 'Município já aderiu a este ciclo.' }],
  pte_alunos: [{ campos: ['cod_simade', 'adesao_id'], mensagem: 'Aluno já consta na lista deste município.' }],
  simade_registros: [{ campos: ['cod_simade', 'ciclo_id'], mensagem: 'Matrícula já importada neste ciclo.' }],
  alertas: [{ campos: ['chave'], mensagem: 'Alerta já gerado.' }],
  riscos: [{ campos: ['codigo'], mensagem: 'Código de risco já utilizado.' }],
  risco_ocorrencias: [{ campos: ['chave_automatica'], mensagem: 'Ocorrência automática já registrada.' }],
}

/**
 * Campos da caracterização que precisam estar preenchidos para "enviar" o formulário
 * (orientação 1: campo não aplicável deve ser marcado "não se aplica", não deixado em branco).
 */
export const CAMPOS_ENVIO_CARACTERIZACAO = [
  'turma_ano', 'turno', 'horario_entrada', 'horario_saida', 'dias_semana', 'escola_mais_proxima',
  'endereco_residencia', 'ponto_referencia', 'zona', 'distancia_km_ida', 'tempo_ida_min', 'viagens_dia',
  'tipo_via', 'condicao_via', 'obstaculos', 'exige_4x4', 'rota_existente', 'tipo_veiculo_indicado_id',
  'lotacao', 'km_diario_total', 'dias_letivos_periodo', 'requisitos', 'justificativa_tecnica',
  'periodo_atendimento', 'data_inicio_pretendida', 'valor_estimado_mensal',
]

export function normalizarModulo(colecao: ColecaoModulo, d: Campos, consulta: Consulta): Campos {
  switch (colecao) {
    case 'demandas': {
      if ('escola_id' in d) {
        const escola = consulta('escolas', d.escola_id)
        d.sre_id = escola?.sre_id ?? null
      }
      if (d.origem !== 'outro' && 'origem' in d) d.origem_outro = null
      if (!vazio(d.valor_mensal) && !vazio(d.meses_previstos)) d.valor_total = Math.round(num(d.valor_mensal) * num(d.meses_previstos) * 100) / 100
      break
    }
    case 'adesoes_pte':
      if ('municipio_id' in d) d.sre_id = consulta('municipios', d.municipio_id)?.sre_id ?? null
      break
    case 'pte_alunos':
    case 'simade_registros':
      if (d.cod_simade) d.cod_simade = String(d.cod_simade).replace(/\D/g, '')
      if (d.escola_inep) d.escola_inep = String(d.escola_inep).replace(/\D/g, '')
      break
    case 'risco_ocorrencias':
      if (vazio(d.origem) && !('id' in d && d.id)) d.origem = 'manual'
      break
    case 'riscos':
      if (!vazio(d.probabilidade) && !vazio(d.impacto)) d.nivel = num(d.probabilidade) * num(d.impacto)
      break
  }
  return d
}

export function validarModulo(colecao: ColecaoModulo, r: Registro, ctx: ContextoValidacao): Erros {
  const erros: Erros = {}
  const hoje = hojeIso()

  switch (colecao) {
    case 'documento_versoes':
      if (!TIPOS_ARQUIVO_ACEITOS.includes(String(r.mime))) erros.mime = 'Formato não aceito. Envie PDF ou imagem (JPG, PNG, WEBP).'
      if (num(r.tamanho_bytes) > TAMANHO_MAXIMO_ARQUIVO) erros.tamanho_bytes = 'Arquivo acima de 20 MB.'
      if (ctx.anterior) erros._geral = 'Versões de documento não podem ser alteradas.'
      break

    case 'documentos':
      if (r.data_documento && String(r.data_documento) > hoje) erros.data_documento = 'Data do documento no futuro.'
      break

    case 'demandas':
      if (r.origem === 'outro' && vazio(r.origem_outro)) erros.origem_outro = 'Descreva a origem.'
      if (r.data_ciencia && r.data_recebimento && String(r.data_ciencia) > String(r.data_recebimento))
        erros.data_ciencia = 'A ciência não pode ser posterior ao recebimento na SEE.'
      if (r.prazo_judicial && r.data_ciencia && String(r.prazo_judicial) < String(r.data_ciencia))
        erros.prazo_judicial = 'O prazo é anterior à data de ciência.'
      if (r.metodo_valor === 'tres_cotacoes' && !vazio(r.cotacao_escolhida_id)) {
        const cot = ctx.lista('cotacoes').filter((c) => c.demanda_id === r.id)
        if (cot.length < 3) erros.metodo_valor = 'São necessárias ao menos 3 cotações.'
      }
      if (r.metodo_valor === 'preco_referencia' && vazio(r.preco_referencia_id) && !vazio(r.valor_mensal))
        erros.preco_referencia_id = 'Informe o preço de referência usado.'
      break

    case 'caracterizacoes':
      if (r.status === 'enviada' || r.status === 'aprovada') {
        const faltam = CAMPOS_ENVIO_CARACTERIZACAO.filter((c) => vazio(r[c]))
        if (faltam.length) {
          for (const c of faltam) erros[c] = 'Preencha ou marque "não se aplica".'
          erros._geral = `Para enviar, todos os campos devem estar preenchidos (${faltam.length} em branco).`
        }
      }
      if (r.status === 'aprovada') {
        if (vazio(r.tipo_veiculo_aprovado_id)) erros.tipo_veiculo_aprovado_id = 'Informe o veículo aprovado.'
        if (vazio(r.analista_id)) erros.analista_id = 'Informe o analista.'
      }
      if (r.veiculo_chega_residencia === false && vazio(r.distancia_ponto_embarque_m))
        erros.distancia_ponto_embarque_m = 'Informe a distância até o ponto de embarque.'
      break

    case 'caracterizacoes_saude':
      if (r.pcd_mobilidade_reduzida && vazio(r.pcd_especificacao)) erros.pcd_especificacao = 'Especifique a deficiência/mobilidade.'
      if (r.medicacao_trajeto && vazio(r.medicacao_detalhe)) erros.medicacao_detalhe = 'Informe a medicação e o horário.'
      break

    case 'cotacoes':
      if (num(r.valor_mensal) <= 0) erros.valor_mensal = 'O valor deve ser maior que zero.'
      break

    case 'autorizacoes_financeiras':
    case 'liberacoes_recurso':
      if (num(r.valor) <= 0) erros.valor = 'O valor deve ser maior que zero.'
      break

    case 'ciclos_pte':
      for (const c of ['valor_por_aluno', 'valor_por_km', 'dias_letivos', 'num_parcelas'])
        if (!vazio(r[c]) && num(r[c]) < 0) erros[c] = 'Não pode ser negativo.'
      if (ctx.anterior?.aprovado_em && !ctx.usuarioEhAdmin) {
        const mudouParametro = ['valor_por_aluno', 'valor_por_km', 'dias_letivos', 'num_parcelas'].some((c) => ctx.anterior![c] !== r[c])
        if (mudouParametro) erros._geral = 'Ciclo aprovado: os parâmetros de cálculo não podem mais ser alterados.'
      }
      break

    case 'pte_alunos': {
      if (num(r.km_ida) < 0) erros.km_ida = 'Não pode ser negativo.'
      const adesao = ctx.consulta('adesoes_pte', r.adesao_id)
      const ciclo = ctx.consulta('ciclos_pte', adesao?.ciclo_id)
      if (ciclo?.aprovado_em && r.origem !== 'extraordinaria' && !ctx.usuarioEhAdmin)
        erros._geral = 'Ciclo já aprovado: inclusões só por demanda extraordinária.'
      break
    }

    case 'divergencias':
      if (r.status === 'justificada' && vazio(r.resolucao)) erros.resolucao = 'Registre a justificativa.'
      break

    case 'calculos_repasse': {
      const adesao = ctx.consulta('adesoes_pte', r.adesao_id)
      const ciclo = ctx.consulta('ciclos_pte', adesao?.ciclo_id)
      if (ciclo?.aprovado_em && !ctx.anterior) erros._geral = 'Ciclo já aprovado: o cálculo não pode ser refeito (use reanálise).'
      break
    }

    case 'demandas_extraordinarias':
      if (r.status !== 'solicitada') {
        if (vazio(r.data_decisao)) erros.data_decisao = 'Informe a data da decisão.'
        if (vazio(r.parecer)) erros.parecer = 'Registre o parecer.'
      }
      if (r.tipo === 'inclusao_aluno' && num(r.qtd_alunos) <= 0) erros.qtd_alunos = 'Informe quantos alunos.'
      break

    case 'riscos':
      for (const c of ['probabilidade', 'impacto'])
        if (!vazio(r[c]) && (num(r[c]) < 1 || num(r[c]) > 5)) erros[c] = 'De 1 a 5.'
      break
  }
  return erros
}
