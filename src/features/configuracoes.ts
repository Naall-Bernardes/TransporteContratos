// Registro único de configurações de todas as tabelas (usado pela auditoria,
// pela exportação e pela tela genérica de cadastro).

import { ETAPA_MODELO, CHECKLIST, DOCUMENTO, TIPO_DOCUMENTO } from './administracao/configuracoes'
import { CADASTROS, type CadastroConfig, type CampoConfig } from './cadastros/configuracoes'
import { CONFIGS_CONTRATO, ENCERRAMENTO } from './contratos/configuracoes'
import { AUTORIZACAO_SUBSECRETARIO, CARACTERIZACAO, COTACAO, DEMANDA, EXECUCAO, OFICIO, OFICIO_CONSULTA, PAF, RESPONSAVEL, SAUDE } from './judicial/configuracoes'
import { ADESAO, CICLO, DEMANDA_EXTRA, DIVERGENCIA, PTE_ALUNO } from './pte/configuracoes'
import { ALOCACAO, CONDUTOR, CONTRATACAO_MUNICIPAL, DESPESA_PTE, EXIGENCIA, ROTA_PTE, VEICULO } from './frota/configuracoes'
import type { Colecao } from '@/lib/dados/tipos'

const simples = (colecao: Colecao, titulo: string, campos: CampoConfig[] = []): CadastroConfig => ({
  colecao,
  titulo,
  singular: titulo.toLowerCase(),
  descricao: '',
  ordenarPor: (r) => String(r.criado_em),
  campos,
})

const juntar = (...configs: CadastroConfig[]): CadastroConfig => {
  const vistos = new Set<string>()
  return {
    ...configs[0],
    campos: configs.flatMap((c) => c.campos).filter((c) => !vistos.has(c.nome) && vistos.add(c.nome)),
  }
}

export const CONFIGURACOES: Record<Colecao, CadastroConfig> = {
  ...CADASTROS,
  ...CONFIGS_CONTRATO,
  instrumentos: juntar(CONFIGS_CONTRATO.instrumentos, ENCERRAMENTO),
  prestacoes_contas: juntar(CONFIGS_CONTRATO.prestacoes_contas, {
    ...CONFIGS_CONTRATO.prestacoes_contas,
    campos: [
      { nome: 'diligencia_data', rotulo: 'Data da diligência', tipo: 'data' },
      { nome: 'diligencia_prazo', rotulo: 'Prazo da diligência', tipo: 'data' },
      { nome: 'diligencia_descricao', rotulo: 'Diligência', tipo: 'texto' },
      { nome: 'reapresentada_em', rotulo: 'Reapresentada em', tipo: 'data' },
      { nome: 'data_decisao', rotulo: 'Data da decisão', tipo: 'data' },
      { nome: 'analista_id', rotulo: 'Analista', tipo: 'referencia', referencia: 'usuarios' },
      { nome: 'parecer', rotulo: 'Parecer', tipo: 'texto' },
    ],
  }),
  tipos_documento: TIPO_DOCUMENTO,
  documentos: DOCUMENTO,
  documento_versoes: simples('documento_versoes', 'Versões de documento', [
    { nome: 'versao', rotulo: 'Versão', tipo: 'numero' },
    { nome: 'nome_arquivo', rotulo: 'Arquivo', tipo: 'texto' },
    { nome: 'motivo', rotulo: 'Motivo', tipo: 'texto' },
  ]),
  etapas_modelo: ETAPA_MODELO,
  checklist_modelo: CHECKLIST,
  processo_etapas: simples('processo_etapas', 'Etapas do processo', [
    { nome: 'status', rotulo: 'Situação', tipo: 'texto' },
    { nome: 'responsavel_id', rotulo: 'Responsável', tipo: 'referencia', referencia: 'usuarios' },
    { nome: 'iniciada_em', rotulo: 'Iniciada em', tipo: 'data' },
    { nome: 'prazo_sla', rotulo: 'Prazo (SLA)', tipo: 'data' },
    { nome: 'concluida_em', rotulo: 'Concluída em', tipo: 'data' },
    { nome: 'justificativa_avanco', rotulo: 'Justificativa de avanço', tipo: 'texto' },
  ]),
  demandas: juntar(DEMANDA, EXECUCAO, { ...DEMANDA, campos: [{ nome: 'valor_mensal', rotulo: 'Valor mensal autorizado', tipo: 'moeda' }, { nome: 'meses_previstos', rotulo: 'Meses', tipo: 'numero' }, { nome: 'valor_total', rotulo: 'Valor total autorizado', tipo: 'moeda' }] }),
  demanda_alunos: simples('demanda_alunos', 'Alunos da demanda', [{ nome: 'aluno_id', rotulo: 'Aluno', tipo: 'referencia', referencia: 'alunos' }]),
  caracterizacoes: CARACTERIZACAO,
  caracterizacoes_saude: SAUDE,
  responsaveis_legais: RESPONSAVEL,
  oficios: OFICIO,
  oficio_consultas: OFICIO_CONSULTA,
  cotacoes: COTACAO,
  autorizacoes_subsecretario: AUTORIZACAO_SUBSECRETARIO,
  pafs: PAF,
  ciclos_pte: CICLO,
  adesoes_pte: ADESAO,
  pte_alunos: PTE_ALUNO,
  simade_registros: simples('simade_registros', 'Registros SIMADE'),
  divergencias: DIVERGENCIA,
  calculos_repasse: simples('calculos_repasse', 'Cálculos de repasse', [{ nome: 'valor_calculado', rotulo: 'Valor calculado', tipo: 'moeda' }]),
  demandas_extraordinarias: DEMANDA_EXTRA,
  veiculos: VEICULO,
  condutores: CONDUTOR,
  alocacoes: ALOCACAO,
  exigencias_documentais: EXIGENCIA,
  contratacoes_municipais: CONTRATACAO_MUNICIPAL,
  rotas_pte: ROTA_PTE,
  despesas_pte: DESPESA_PTE,
}
