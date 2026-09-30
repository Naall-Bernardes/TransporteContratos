// Configurações de sistema (somente administrador): tipos de documento, etapas/SLA e checklist;
// e telas de riscos, documentos e alertas (para rótulos da auditoria).

import { opcoes, type CadastroConfig } from '@/features/cadastros/configuracoes'
import { CONDICOES } from '@/lib/fluxo/checklist'
import { GATILHOS } from '@/lib/monitoramento'

const MODULOS = opcoes({ JUDICIAL: 'Judicial/MP', PTE: 'PTE', AMBOS: 'Ambos' })

export const TIPO_DOCUMENTO: CadastroConfig = {
  colecao: 'tipos_documento',
  titulo: 'Tipos de documento',
  singular: 'tipo de documento',
  descricao: 'Tipos usados no repositório e no checklist das etapas.',
  ordenarPor: (r) => String(r.nome),
  campos: [
    { nome: 'codigo', rotulo: 'Código', tipo: 'texto', naTabela: true },
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
    { nome: 'modulo', rotulo: 'Módulo', tipo: 'selecao', opcoes: MODULOS, naTabela: true },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano', padrao: true, naTabela: true },
  ],
}

export const ETAPA_MODELO: CadastroConfig = {
  colecao: 'etapas_modelo',
  titulo: 'Etapas e SLA',
  singular: 'etapa',
  descricao: 'Prazos (SLA) em dias úteis de cada etapa. Em branco = etapa contínua, sem prazo (ex.: execução).',
  ordenarPor: (r) => `${r.modulo}${String(r.ordem).padStart(2, '0')}`,
  campos: [
    { nome: 'modulo', rotulo: 'Módulo', tipo: 'selecao', opcoes: MODULOS.slice(0, 2), naTabela: true },
    { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero', naTabela: true },
    { nome: 'codigo', rotulo: 'Código', tipo: 'texto', naTabela: true },
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', naTabela: true },
    { nome: 'papel_responsavel', rotulo: 'Quem atua', tipo: 'selecao', opcoes: opcoes({ central: 'Órgão central', sre: 'SRE' }), naTabela: true },
    { nome: 'sla_dias_uteis', rotulo: 'SLA (dias úteis)', tipo: 'numero', naTabela: true },
  ],
}

export const CHECKLIST: CadastroConfig = {
  colecao: 'checklist_modelo',
  titulo: 'Checklist por etapa',
  singular: 'item do checklist',
  descricao: 'Documentos obrigatórios de cada etapa. A etapa só avança com o checklist completo (ou justificativa do Diretor DAFI/órgão central).',
  ordenarPor: (r) => String(r.etapa_modelo_id),
  campos: [
    { nome: 'etapa_modelo_id', rotulo: 'Etapa', tipo: 'referencia', referencia: 'etapas_modelo', naTabela: true },
    { nome: 'tipo_documento_id', rotulo: 'Documento', tipo: 'referencia', referencia: 'tipos_documento', naTabela: true },
    { nome: 'condicao', rotulo: 'Quando é exigido', tipo: 'selecao', opcoes: opcoes(CONDICOES), padrao: 'sempre', naTabela: true },
  ],
}

export const CATEGORIAS_RISCO = opcoes({
  prazo: 'Prazo',
  financeiro: 'Financeiro',
  contratual: 'Contratual',
  operacional: 'Operacional',
  seguranca_aluno: 'Segurança do estudante',
  conformidade: 'Conformidade',
  conformidade_lgpd: 'LGPD',
  informacao: 'Informação/dados',
})

export const RISCO: CadastroConfig = {
  colecao: 'riscos',
  titulo: 'Registro de riscos',
  singular: 'risco',
  descricao: '',
  ordenarPor: (r) => String(r.codigo),
  campos: [
    { nome: 'codigo', rotulo: 'Código', tipo: 'texto', naTabela: true },
    { nome: 'titulo', rotulo: 'Risco', tipo: 'texto', naTabela: true },
    { nome: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: CATEGORIAS_RISCO, naTabela: true },
    { nome: 'modulo', rotulo: 'Módulo', tipo: 'selecao', opcoes: MODULOS },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto_longo' },
    { nome: 'causa', rotulo: 'Causas', tipo: 'texto_longo' },
    { nome: 'consequencia', rotulo: 'Consequências', tipo: 'texto_longo' },
    { nome: 'probabilidade', rotulo: 'Probabilidade (1–5)', tipo: 'numero', naTabela: true },
    { nome: 'impacto', rotulo: 'Impacto (1–5)', tipo: 'numero', naTabela: true },
    { nome: 'nivel', rotulo: 'Nível (P×I)', tipo: 'numero', naTabela: true, emFormulario: false },
    { nome: 'estrategia', rotulo: 'Estratégia', tipo: 'selecao', opcoes: opcoes({ evitar: 'Evitar', mitigar: 'Mitigar', transferir: 'Transferir', aceitar: 'Aceitar' }), naTabela: true },
    { nome: 'plano_acao', rotulo: 'Plano de ação', tipo: 'texto_longo' },
    { nome: 'responsavel_id', rotulo: 'Responsável', tipo: 'referencia', referencia: 'usuarios' },
    { nome: 'gatilho', rotulo: 'Gatilho automático', tipo: 'selecao', opcoes: opcoes(GATILHOS), ajuda: 'Em branco = só registro manual.' },
    { nome: 'etapas', rotulo: 'Etapas do fluxo relacionadas', tipo: 'multipla', opcoes: opcoes({ J01: 'J01', J02: 'J02', J03: 'J03', J04: 'J04', J05: 'J05', J06: 'J06', J07: 'J07', J08: 'J08', J09: 'J09', J10: 'J10', P02: 'P02', P03: 'P03', P04: 'P04', P05: 'P05' }) },
    { nome: 'data_revisao', rotulo: 'Próxima revisão', tipo: 'data' },
    { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: opcoes({ ativo: 'Ativo', monitorado: 'Monitorado', encerrado: 'Encerrado' }), padrao: 'ativo', naTabela: true },
  ],
}

export const OCORRENCIA_RISCO: CadastroConfig = {
  colecao: 'risco_ocorrencias',
  titulo: 'Ocorrências de risco',
  singular: 'ocorrência de risco',
  descricao: '',
  ordenarPor: (r) => String(r.data),
  campos: [
    { nome: 'risco_id', rotulo: 'Risco', tipo: 'referencia', referencia: 'riscos', naTabela: true },
    { nome: 'data', rotulo: 'Data', tipo: 'data', naTabela: true },
    { nome: 'processo_id', rotulo: 'Processo (código único)', tipo: 'referencia', referencia: 'processos', naTabela: true },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto_longo', naTabela: true },
    { nome: 'origem', rotulo: 'Origem', tipo: 'selecao', opcoes: opcoes({ manual: 'Manual', automatica: 'Automática' }), padrao: 'manual', naTabela: true, emFormulario: false },
    { nome: 'impacto_real', rotulo: 'Impacto verificado', tipo: 'texto_longo' },
    { nome: 'acao_tomada', rotulo: 'Ação tomada', tipo: 'texto_longo' },
    { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: opcoes({ aberta: 'Aberta', tratada: 'Tratada', encerrada: 'Encerrada' }), padrao: 'aberta', naTabela: true },
  ],
}

export const DOCUMENTO: CadastroConfig = {
  colecao: 'documentos',
  titulo: 'Documentos',
  singular: 'documento',
  descricao: '',
  ordenarPor: (r) => String(r.data_documento),
  campos: [
    { nome: 'tipo_documento_id', rotulo: 'Tipo de documento', tipo: 'referencia', referencia: 'tipos_documento' },
    { nome: 'numero_sei', rotulo: 'Nº SEI do documento', tipo: 'texto' },
    { nome: 'data_documento', rotulo: 'Data do documento', tipo: 'data' },
    { nome: 'etapa_codigo', rotulo: 'Etapa', tipo: 'texto' },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'texto_longo' },
    { nome: 'versao_atual', rotulo: 'Versão', tipo: 'numero' },
  ],
}
