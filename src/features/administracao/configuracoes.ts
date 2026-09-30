// Configurações de sistema (somente administrador): tipos de documento, etapas/SLA e checklist;
// e a tela de documentos (para rótulos da auditoria).

import { opcoes, type CadastroConfig } from '@/features/cadastros/configuracoes'
import { CONDICOES } from '@/lib/fluxo/checklist'

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
    { nome: 'papel_responsavel', rotulo: 'Quem atua', tipo: 'selecao', opcoes: opcoes({ central: 'Órgão central', subsecretario: 'Subsecretário(a)', sre: 'SRE' }), naTabela: true },
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
