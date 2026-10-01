// Configurações iniciais (editáveis pelo administrador): etapas dos fluxos com SLA,
// tipos de documento, checklist por etapa e exigências documentais.

import type { Registro } from './tipos'

type Novo = (campos: Record<string, unknown>) => Registro

/** SLA genérico inicial: 5 dias úteis. `null` = etapa contínua (acompanha a vigência). */
const SLA = 5

export const ETAPAS: [modulo: string, ordem: number, codigo: string, nome: string, papel: string, sla: number | null][] = [
  ['JUDICIAL', 1, 'C01', 'Detalhamento da demanda', 'sre', SLA],
  // C06 entrou depois: a ordem é que define a sequência (Detalhamento → Escolha do transporte → Autorização…)
  ['JUDICIAL', 2, 'C06', 'Escolha do transporte', 'sre', SLA],
  ['JUDICIAL', 3, 'C02', 'Autorização', 'subsecretario', SLA],
  ['JUDICIAL', 4, 'C03', 'Registro do PAF', 'central', SLA],
  // Contratos inclui a execução e a fiscalização (aba): etapa contínua, sem SLA próprio
  ['JUDICIAL', 5, 'C04', 'Contratos', 'sre', null],
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
  ['oficio_recebido', 'Ofício recebido (Judiciário, MP, Defensoria…)', 'JUDICIAL'],
  ['oficio_resposta', 'Ofício de resposta', 'JUDICIAL'],
  ['informacao_sre', 'Informação da SRE', 'JUDICIAL'],
  ['cotacao', 'Proposta / cotação de transporte', 'JUDICIAL'],
  ['paf', 'PAF (comprovante)', 'JUDICIAL'],
  ['contrato', 'Contrato', 'JUDICIAL'],
  ['aditivo', 'Termo aditivo', 'AMBOS'],
  ['nota_fiscal', 'Nota fiscal', 'AMBOS'],
  ['relatorio_fiscalizacao', 'Relatório de fiscalização', 'AMBOS'],
  ['prestacao', 'Prestação de contas', 'AMBOS'],
  ['parecer', 'Parecer de análise', 'AMBOS'],
  ['termo_adesao', 'Termo de adesão ao PTE', 'PTE'],
  ['lista_ter', 'Lista de alunos atendidos (TER/MG)', 'PTE'],
  ['termo_convenio', 'Termo / convênio PTE', 'PTE'],
  ['comprovante_repasse', 'Comprovante de repasse (OB)', 'PTE'],
  ['termo_encerramento', 'Termo de encerramento', 'AMBOS'],
  // Prestação de contas do PTE (Decreto 46.946/2016, art. 9º)
  ['pte_oficio', 'Ofício de encaminhamento da prestação de contas (PTE)', 'PTE'],
  ['pte_demonstrativo', 'Demonstrativo da execução da receita e da despesa (Anexo III)', 'PTE'],
  ['pte_relacao_pagamentos', 'Relação de pagamentos efetuados (Anexo IV)', 'PTE'],
  ['pte_declaracao', 'Declaração de cumprimento de obrigações (Anexo V)', 'PTE'],
  ['pte_extratos', 'Extratos bancários da conta específica e aplicações', 'PTE'],
  ['contrato_municipal', 'Contrato do município com o transportador (e aditivos)', 'PTE'],
  ['processo_licitatorio', 'Processo licitatório / dispensa / inexigibilidade', 'PTE'],
  // Veículo
  ['crlv', 'CRLV-e — licenciamento anual do veículo', 'AMBOS'],
  ['autorizacao_escolar', 'Autorização para transporte de escolares (DETRAN/órgão de trânsito)', 'AMBOS'],
  ['laudo_inspecao', 'Laudo de inspeção veicular semestral com ART', 'AMBOS'],
  ['cronotacografo', 'Certificado de verificação do cronotacógrafo (Inmetro)', 'AMBOS'],
  ['fotos_veiculo', 'Registro fotográfico do veículo (faixa ESCOLAR, lanternas)', 'AMBOS'],
  ['seguro_app', 'Apólice de seguro de acidentes pessoais de passageiros (APP)', 'AMBOS'],
  ['tie', 'Título de Inscrição de Embarcação (Capitania dos Portos)', 'AMBOS'],
  ['fotos_coletes', 'Registro fotográfico dos coletes salva-vidas', 'AMBOS'],
  // Condutor
  ['identidade_condutor', 'Documento de identidade do condutor/monitor', 'AMBOS'],
  ['cnh', 'CNH do condutor (categoria D ou E)', 'AMBOS'],
  ['curso_escolar', 'Certificado do curso especializado de condutor de escolares', 'AMBOS'],
  ['certidao_criminal', 'Certidão negativa criminal (homicídio, roubo, estupro e corrupção de menores)', 'AMBOS'],
  ['toxicologico', 'Exame toxicológico (resultado negativo)', 'AMBOS'],
  ['prontuario', 'Extrato do prontuário do condutor (infrações dos últimos 12 meses)', 'AMBOS'],
  ['habilitacao_aquaviario', 'Carteira de habilitação de aquaviário (Capitania dos Portos)', 'AMBOS'],
  // Contratado (habilitação — Res. SEE 3.670/2017, art. 17)
  ['atos_constitutivos', 'Atos constitutivos e alterações (contrato social)', 'JUDICIAL'],
  ['identidade_representante', 'Identidade do representante legal', 'JUDICIAL'],
  ['cnpj_ativo', 'Comprovante de CNPJ ativo', 'JUDICIAL'],
  ['cnd_federal', 'Certidão conjunta negativa de débitos federais e Dívida Ativa da União', 'JUDICIAL'],
  ['cnd_estadual', 'Certidão negativa de débitos estaduais', 'JUDICIAL'],
  ['cnd_municipal', 'Certidão negativa de débitos municipais', 'JUDICIAL'],
  ['crf_fgts', 'Certificado de regularidade do FGTS (CRF)', 'JUDICIAL'],
  ['cndt', 'Certidão negativa de débitos trabalhistas (CNDT)', 'JUDICIAL'],
  ['declaracao_vinculo', 'Declaração negativa de vínculo', 'JUDICIAL'],
  ['cpf_contratado', 'CPF do contratado (pessoa física)', 'JUDICIAL'],
  ['nit_pis', 'Inscrição no INSS — NIT/PIS', 'JUDICIAL'],
  ['outros', 'Outros', 'AMBOS'],
]

// [código, nome, aplica_a, condição, tipo de documento, força, validade em meses (null = data de validade do documento; 0 = sem validade), momento, base legal]
export const EXIGENCIAS: [string, string, string, string, string, string, number | null, string, string][] = [
  ['v_crlv', 'CRLV-e (licenciamento anual)', 'veiculo', 'rodoviario', 'crlv', 'lei', null, 'periodico', 'CTB arts. 130 e 131'],
  ['v_autorizacao', 'Autorização para transporte de escolares', 'veiculo', 'rodoviario', 'autorizacao_escolar', 'lei', 6, 'periodico', 'CTB arts. 136 (caput) e 137; Portaria DETRAN-MG 1.498/2019'],
  ['v_laudo', 'Laudo de inspeção semestral com ART', 'veiculo', 'rodoviario', 'laudo_inspecao', 'lei', 6, 'periodico', 'CTB art. 136, II; Portaria DETRAN-MG 1.498/2019'],
  ['v_tacografo', 'Verificação do cronotacógrafo (Inmetro)', 'veiculo', 'rodoviario', 'cronotacografo', 'lei', 24, 'periodico', 'CTB art. 136, IV; verificação metrológica bienal do Inmetro'],
  ['v_fotos', 'Fotos: faixa ESCOLAR e lanternas', 'veiculo', 'rodoviario', 'fotos_veiculo', 'recomendada', 0, 'inicial', 'Evidência do CTB art. 136, III e V'],
  ['v_seguro', 'Seguro de acidentes pessoais de passageiros', 'veiculo', 'todos', 'seguro_app', 'recomendada', null, 'periodico', 'Manual PTE/MG 2016; cláusula contratual'],
  ['e_tie', 'Inscrição da embarcação (TIE)', 'veiculo', 'aquaviario', 'tie', 'lei', 0, 'inicial', 'Normas da Autoridade Marítima; Portaria DPC 85/2005 (Res. SEE/SEGOV 5.267/2026, art. 9º)'],
  ['e_coletes', 'Fotos dos coletes salva-vidas', 'veiculo', 'aquaviario', 'fotos_coletes', 'recomendada', 0, 'inicial', 'Manual PTE/MG 2016'],
  ['c_identidade', 'Documento de identidade (idade > 21 anos)', 'condutor', 'motorista', 'identidade_condutor', 'lei', 0, 'inicial', 'CTB art. 138, I'],
  ['c_cnh', 'CNH categoria D ou E válida', 'condutor', 'motorista', 'cnh', 'lei', null, 'periodico', 'CTB art. 138, II'],
  ['c_curso', 'Curso especializado de condutor de escolares', 'condutor', 'motorista', 'curso_escolar', 'lei', 60, 'periodico', 'CTB art. 138, V; Res. CONTRAN 789/2020 (atualização a cada 5 anos)'],
  ['c_criminal', 'Certidão negativa criminal (art. 329)', 'condutor', 'motorista', 'certidao_criminal', 'lei', 60, 'periodico', 'CTB art. 329 (renovável a cada 5 anos)'],
  ['c_toxicologico', 'Exame toxicológico negativo', 'condutor', 'motorista', 'toxicologico', 'lei', 30, 'periodico', 'CTB art. 148-A, § 2º (a cada 2 anos e 6 meses)'],
  ['c_prontuario', 'Prontuário sem infração gravíssima reincidente (12 meses)', 'condutor', 'motorista', 'prontuario', 'lei', 12, 'periodico', 'CTB art. 138, IV (Lei 14.071/2020)'],
  ['a_habilitacao', 'Habilitação de aquaviário', 'condutor', 'condutor_embarcacao', 'habilitacao_aquaviario', 'lei', null, 'periodico', 'Normas da Autoridade Marítima'],
  ['a_identidade', 'Documento de identidade', 'condutor', 'condutor_embarcacao', 'identidade_condutor', 'lei', 0, 'inicial', 'Normas da Autoridade Marítima'],
  ['m_identidade', 'Documento de identidade do monitor', 'condutor', 'monitor', 'identidade_condutor', 'recomendada', 0, 'inicial', 'Boa prática'],
  ['m_criminal', 'Certidão negativa criminal do monitor', 'condutor', 'monitor', 'certidao_criminal', 'recomendada', 60, 'periodico', 'Boa prática (analogia ao CTB art. 329)'],
  ['pj_atos', 'Atos constitutivos', 'contratado', 'pj', 'atos_constitutivos', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, II, a'],
  ['pj_identidade', 'Identidade do representante legal', 'contratado', 'pj', 'identidade_representante', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, II, b'],
  ['pj_cnpj', 'CNPJ ativo', 'contratado', 'pj', 'cnpj_ativo', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, II, c'],
  ['pj_federal', 'CND federal / Dívida Ativa da União', 'contratado', 'pj', 'cnd_federal', 'see', null, 'periodico', 'Res. SEE 3.670/2017, art. 17, II, d'],
  ['pj_estadual', 'CND estadual', 'contratado', 'pj', 'cnd_estadual', 'see', null, 'periodico', 'Res. SEE 3.670/2017, art. 17, II, e'],
  ['pj_municipal', 'CND municipal', 'contratado', 'pj', 'cnd_municipal', 'see', null, 'periodico', 'Res. SEE 3.670/2017, art. 17, II, f'],
  ['pj_fgts', 'CRF do FGTS', 'contratado', 'pj', 'crf_fgts', 'see', null, 'periodico', 'Res. SEE 3.670/2017, art. 17, II, g'],
  ['pj_cndt', 'CNDT', 'contratado', 'pj', 'cndt', 'see', null, 'periodico', 'Res. SEE 3.670/2017, art. 17, II, k'],
  ['pj_vinculo', 'Declaração negativa de vínculo', 'contratado', 'pj', 'declaracao_vinculo', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, II, j'],
  ['pf_cpf', 'CPF', 'contratado', 'pf', 'cpf_contratado', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, III, a'],
  ['pf_identidade', 'Carteira de identidade', 'contratado', 'pf', 'identidade_representante', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, III, b'],
  ['pf_nit', 'NIT/PIS', 'contratado', 'pf', 'nit_pis', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, III, c'],
  ['pf_vinculo', 'Declaração negativa de vínculo', 'contratado', 'pf', 'declaracao_vinculo', 'see', 0, 'inicial', 'Res. SEE 3.670/2017, art. 17, III, e'],
]

export const CHECKLIST: [etapa: string, documento: string, condicao: string][] = [
  ['C01', 'caracterizacao', 'sempre'],
  ['C01', 'matricula', 'sempre'],
  ['C01', 'identidade', 'sempre'],
  ['C01', 'cpfs', 'sempre'],
  ['C01', 'residencia', 'sempre'],
  ['C01', 'termo_lgpd', 'sempre'],
  ['C01', 'laudo', 'se_pcd'],
  ['C01', 'prescricao', 'se_dispositivo_ou_acompanhante'],
  ['C01', 'fotos', 'se_obstaculos'],
  ['C01', 'mapa', 'opcional'],
  ['C01', 'sem_rota', 'se_rota_nao_atende'],
  ['C06', 'cotacao', 'opcional'],
  ['C03', 'paf', 'opcional'],
  ['C04', 'contrato', 'sempre'],
  ['C04', 'relatorio_fiscalizacao', 'sempre'],
]


export function criarConfiguracoes(novo: Novo) {
  const etapas_modelo = ETAPAS.map(([modulo, ordem, codigo, nome, papel_responsavel, sla]) =>
    novo({ modulo, ordem, codigo, nome, papel_responsavel, sla_dias_uteis: sla }),
  )
  const tipos_documento = TIPOS_DOCUMENTO.map(([codigo, nome, modulo]) => novo({ codigo, nome, modulo, ativo: true }))
  const etapa = (c: string) => etapas_modelo.find((e) => e.codigo === c)!.id
  const tipo = (c: string) => tipos_documento.find((t) => t.codigo === c)!.id
  const checklist_modelo = CHECKLIST.map(([e, d, condicao]) => novo({ etapa_modelo_id: etapa(e), tipo_documento_id: tipo(d), condicao }))
  const exigencias_documentais = EXIGENCIAS.map(([codigo, nome, aplica_a, condicao, doc, forca, validade_meses, momento, base_legal]) =>
    novo({ codigo, nome, aplica_a, condicao, tipo_documento_id: tipo(doc), forca, validade_meses, momento, base_legal, ativo: true }),
  )
  return { etapas_modelo, tipos_documento, checklist_modelo, exigencias_documentais }
}
