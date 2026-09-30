// Configurações iniciais (editáveis pelo administrador): etapas dos fluxos com SLA,
// tipos de documento, checklist por etapa e registro de riscos.

import type { Registro } from './tipos'

type Novo = (campos: Record<string, unknown>) => Registro

/** SLA genérico inicial: 5 dias úteis. `null` = etapa contínua (acompanha a vigência). */
const SLA = 5

export const ETAPAS: [modulo: string, ordem: number, codigo: string, nome: string, papel: string, sla: number | null][] = [
  ['JUDICIAL', 1, 'J01', 'Recebimento da decisão/ofício (SEI)', 'central', SLA],
  ['JUDICIAL', 2, 'J02', 'Encaminhamento à SRE', 'central', SLA],
  ['JUDICIAL', 3, 'J03', 'Caracterização da demanda', 'sre', SLA],
  ['JUDICIAL', 4, 'J04', 'Definição do valor', 'sre', SLA],
  ['JUDICIAL', 5, 'J05', 'Autorização financeira (OP e PAF)', 'central', SLA],
  ['JUDICIAL', 6, 'J06', 'Liberação do recurso à Caixa Escolar', 'central', SLA],
  ['JUDICIAL', 7, 'J07', 'Contratação pela Caixa Escolar', 'sre', SLA],
  ['JUDICIAL', 8, 'J08', 'Execução e fiscalização', 'sre', null],
  ['JUDICIAL', 9, 'J09', 'Prestação de contas da Caixa Escolar', 'sre', 30],
  ['JUDICIAL', 10, 'J10', 'Comprovação do cumprimento', 'central', SLA],
  ['PTE', 2, 'P02', 'Adesão e cadastro da demanda', 'sre', 15],
  ['PTE', 3, 'P03', 'Definição e repasse', 'central', 15],
  ['PTE', 4, 'P04', 'Execução e monitoramento', 'sre', null],
  ['PTE', 5, 'P05', 'Prestação de contas', 'sre', 30],
]

export const TIPOS_DOCUMENTO: [codigo: string, nome: string, modulo: string][] = [
  ['decisao', 'Decisão judicial / requisição do MP', 'JUDICIAL'],
  ['oficio', 'Ofício / despacho de encaminhamento', 'AMBOS'],
  ['caracterizacao', 'Formulário de caracterização assinado', 'JUDICIAL'],
  ['matricula', 'Comprovante de matrícula / declaração escolar (8.2)', 'JUDICIAL'],
  ['identidade', 'Identidade ou certidão de nascimento do estudante (8.3)', 'JUDICIAL'],
  ['cpfs', 'CPF do estudante e do responsável legal (8.4)', 'JUDICIAL'],
  ['residencia', 'Comprovante de residência até 90 dias (8.5)', 'JUDICIAL'],
  ['laudo', 'Laudo / relatório de deficiência com CID (8.6)', 'JUDICIAL'],
  ['prescricao', 'Prescrição de dispositivo ou acompanhante (8.7)', 'JUDICIAL'],
  ['fotos', 'Registro fotográfico do trajeto (8.8)', 'JUDICIAL'],
  ['mapa', 'Mapa da rota e distância (8.9)', 'JUDICIAL'],
  ['sem_rota', 'Declaração de inexistência de rota PTE/municipal (8.10)', 'JUDICIAL'],
  ['termo_lgpd', 'Termo de ciência e consentimento LGPD (8.11)', 'JUDICIAL'],
  ['cotacao', 'Cotação de preço', 'JUDICIAL'],
  ['op', 'Ordem de Pagamento (OP)', 'JUDICIAL'],
  ['paf', 'PAF', 'JUDICIAL'],
  ['liberacao', 'Comprovante de liberação do recurso', 'JUDICIAL'],
  ['contrato', 'Contrato', 'JUDICIAL'],
  ['aditivo', 'Termo aditivo', 'AMBOS'],
  ['nota_fiscal', 'Nota fiscal', 'AMBOS'],
  ['relatorio_fiscalizacao', 'Relatório de fiscalização', 'AMBOS'],
  ['prestacao', 'Prestação de contas', 'AMBOS'],
  ['parecer', 'Parecer de análise', 'AMBOS'],
  ['relatorio_cumprimento', 'Relatório de cumprimento (AGE/Judiciário)', 'JUDICIAL'],
  ['termo_adesao', 'Termo de adesão ao PTE', 'PTE'],
  ['lista_ter', 'Lista de alunos atendidos (TER/MG)', 'PTE'],
  ['termo_convenio', 'Termo / convênio PTE', 'PTE'],
  ['comprovante_repasse', 'Comprovante de repasse (OB)', 'PTE'],
  ['termo_encerramento', 'Termo de encerramento', 'AMBOS'],
  ['outros', 'Outros', 'AMBOS'],
]

export const CHECKLIST: [etapa: string, documento: string, condicao: string][] = [
  ['J01', 'decisao', 'sempre'],
  ['J02', 'oficio', 'opcional'],
  ['J03', 'caracterizacao', 'sempre'],
  ['J03', 'matricula', 'sempre'],
  ['J03', 'identidade', 'sempre'],
  ['J03', 'cpfs', 'sempre'],
  ['J03', 'residencia', 'sempre'],
  ['J03', 'termo_lgpd', 'sempre'],
  ['J03', 'laudo', 'se_pcd'],
  ['J03', 'prescricao', 'se_dispositivo_ou_acompanhante'],
  ['J03', 'fotos', 'se_obstaculos'],
  ['J03', 'mapa', 'opcional'],
  ['J03', 'sem_rota', 'se_rota_nao_atende'],
  ['J04', 'cotacao', 'se_tres_cotacoes'],
  ['J05', 'op', 'sempre'],
  ['J05', 'paf', 'sempre'],
  ['J06', 'liberacao', 'sempre'],
  ['J07', 'contrato', 'sempre'],
  ['J08', 'relatorio_fiscalizacao', 'sempre'],
  ['J09', 'prestacao', 'sempre'],
  ['J09', 'parecer', 'sempre'],
  ['P02', 'termo_adesao', 'sempre'],
  ['P02', 'lista_ter', 'sempre'],
  ['P03', 'termo_convenio', 'sempre'],
  ['P03', 'comprovante_repasse', 'sempre'],
  ['P04', 'relatorio_fiscalizacao', 'sempre'],
  ['P05', 'prestacao', 'sempre'],
  ['P05', 'parecer', 'sempre'],
]

// [código, título, categoria, módulo, P, I, estratégia, gatilho, etapas]
const RISCOS: [string, string, string, string, number, number, string, string | null, string[], string, string][] = [
  ['R-01', 'Descumprimento de prazo judicial', 'prazo', 'JUDICIAL', 3, 5, 'mitigar', 'prazo_judicial_vencido', ['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07'],
    'Fluxo lento entre SEE, SRE, escola e Caixa Escolar', 'Multa diária, responsabilização do gestor, dano ao estudante'],
  ['R-02', 'Etapa do fluxo acima do SLA', 'prazo', 'AMBOS', 4, 3, 'mitigar', 'sla_vencido_nivel3', [], 'Sobrecarga, falta de responsável definido', 'Atraso em cascata no atendimento'],
  ['R-03', 'Caracterização incompleta ou documentação pendente', 'operacional', 'JUDICIAL', 4, 3, 'mitigar', null, ['J03'],
    'Formulário devolvido sem anexos', 'Suspensão da análise e risco ao prazo judicial'],
  ['R-04', 'Valor contratado acima da menor cotação/referência', 'financeiro', 'JUDICIAL', 2, 4, 'evitar', 'valor_acima_cotacao', ['J04'],
    'Escolha de fornecedor sem justificativa', 'Apontamento de órgãos de controle'],
  ['R-05', 'Atraso na emissão de OP/PAF ou na liberação do recurso', 'financeiro', 'JUDICIAL', 3, 4, 'mitigar', 'sla_etapa_5_6', ['J05', 'J06'],
    'Disponibilidade orçamentária, fila de pagamentos', 'Caixa Escolar sem recurso para contratar'],
  ['R-06', 'Contrato vencido sem aditivo com transporte em curso', 'contratual', 'AMBOS', 3, 5, 'evitar', 'contrato_vencido_sem_aditivo', ['J08'],
    'Falta de acompanhamento da vigência', 'Serviço sem cobertura contratual; pagamento irregular'],
  ['R-07', 'Interrupção do transporte', 'operacional', 'AMBOS', 3, 5, 'mitigar', 'ocorrencia_interrupcao', ['J08', 'P04'],
    'Quebra de veículo, abandono do contratado', 'Estudante sem acesso à escola; descumprimento judicial'],
  ['R-08', 'Veículo ou condutor sem requisitos legais', 'seguranca_aluno', 'AMBOS', 2, 5, 'evitar', 'ocorrencia_veiculo_irregular', ['J07', 'J08', 'P04'],
    'Falta de verificação de CNH D, curso e vistoria DETRAN', 'Risco à integridade física dos estudantes'],
  ['R-09', 'Prestação de contas não entregue no prazo', 'conformidade', 'AMBOS', 3, 3, 'mitigar', 'prestacao_vencida', ['J09', 'P05'],
    'Desconhecimento do prazo, falta de documentos', 'Bloqueio de novos repasses; tomada de contas'],
  ['R-10', 'Divergência TER × SIMADE não resolvida', 'informacao', 'PTE', 3, 3, 'mitigar', 'divergencia_aberta_prazo', ['P02'],
    'Cadastros desatualizados no município ou no SIMADE', 'Repasse calculado sobre base incorreta'],
  ['R-11', 'Saldo contratual insuficiente', 'financeiro', 'AMBOS', 2, 3, 'mitigar', 'saldo_menor_10pct', ['J08', 'P04'],
    'Execução acima do previsto, reajuste', 'Interrupção por falta de pagamento'],
  ['R-12', 'Acesso indevido a dados pessoais de estudantes', 'conformidade_lgpd', 'AMBOS', 2, 4, 'mitigar', null, ['J03'],
    'Compartilhamento por canais informais (WhatsApp, e-mail pessoal)', 'Violação da LGPD; dano a menores'],
]

export function criarConfiguracoes(novo: Novo, responsavelId: string) {
  const etapas_modelo = ETAPAS.map(([modulo, ordem, codigo, nome, papel_responsavel, sla]) =>
    novo({ modulo, ordem, codigo, nome, papel_responsavel, sla_dias_uteis: sla }),
  )
  const tipos_documento = TIPOS_DOCUMENTO.map(([codigo, nome, modulo]) => novo({ codigo, nome, modulo, ativo: true }))
  const etapa = (c: string) => etapas_modelo.find((e) => e.codigo === c)!.id
  const tipo = (c: string) => tipos_documento.find((t) => t.codigo === c)!.id
  const checklist_modelo = CHECKLIST.map(([e, d, condicao]) => novo({ etapa_modelo_id: etapa(e), tipo_documento_id: tipo(d), condicao }))
  const riscos = RISCOS.map(([codigo, titulo, categoria, modulo, probabilidade, impacto, estrategia, gatilho, etapas, causa, consequencia]) =>
    novo({
      codigo,
      titulo,
      categoria,
      modulo,
      probabilidade,
      impacto,
      nivel: probabilidade * impacto,
      estrategia,
      gatilho,
      etapas,
      causa,
      consequencia,
      plano_acao: 'Monitorar pelo painel e tratar as ocorrências abertas (definir plano específico).',
      responsavel_id: responsavelId,
      status: 'ativo',
    }),
  )
  return { etapas_modelo, tipos_documento, checklist_modelo, riscos }
}
