// Telas de frota (veículos, condutores/monitores, alocações), catálogo de exigências
// documentais e dados do PTE executados pelo município (contratações, rotas, despesas).

import { opcoes, type CadastroConfig } from '@/features/cadastros/configuracoes'

const rodoviario = (v: Record<string, unknown>) => v.tipo_transporte !== 'aquaviario'
const aquaviario = (v: Record<string, unknown>) => v.tipo_transporte === 'aquaviario'
const doTransportador = (campo: string) => (v: Record<string, unknown>) => v[campo] === 'transportador'
const doMunicipio = (campo: string) => (v: Record<string, unknown>) => v[campo] === 'municipio'

export const FUNCOES = opcoes({ motorista: 'Motorista', monitor: 'Monitor', condutor_embarcacao: 'Condutor de embarcação' })

export const VEICULO: CadastroConfig = {
  colecao: 'veiculos',
  titulo: 'Veículos e embarcações',
  singular: 'veículo',
  descricao: 'Frota que transporta estudantes: dos transportadores contratados e a frota própria dos municípios. Os documentos obrigatórios de cada veículo/condutor são conferidos e enviados dentro do contrato (aba Frota e conformidade) ou da adesão PTE (aba Contratações e frota).',
  ordenarPor: (r) => String(r.placa ?? r.inscricao_capitania ?? ''),
  campos: [
    { nome: 'tipo_transporte', rotulo: 'Transporte', tipo: 'selecao', opcoes: opcoes({ rodoviario: 'Rodoviário', aquaviario: 'Aquaviário (embarcação)' }), padrao: 'rodoviario', naTabela: true },
    { nome: 'placa', rotulo: 'Placa', tipo: 'texto', maxLength: 8, naTabela: true, visivel: rodoviario, obrigatorioSe: rodoviario, ajuda: 'Ex.: ABC1D23' },
    { nome: 'renavam', rotulo: 'RENAVAM', tipo: 'texto', maxLength: 11, visivel: rodoviario },
    { nome: 'inscricao_capitania', rotulo: 'Inscrição na Capitania dos Portos', tipo: 'texto', naTabela: true, visivel: aquaviario, obrigatorioSe: aquaviario },
    { nome: 'tipo_veiculo_id', rotulo: 'Tipo de veículo', tipo: 'referencia', referencia: 'tipos_veiculo', naTabela: true },
    { nome: 'marca_modelo', rotulo: 'Marca / modelo', tipo: 'texto', naTabela: true },
    { nome: 'ano_fabricacao', rotulo: 'Ano de fabricação', tipo: 'numero', naTabela: true, ajuda: 'Referência do Manual PTE/MG: ideal até 7 anos de uso.' },
    { nome: 'lotacao', rotulo: 'Lotação autorizada (passageiros)', tipo: 'numero', naTabela: true, ajuda: 'A que consta na autorização de transporte escolar (CTB art. 137).' },
    { nome: 'adaptado_pcd', rotulo: 'Adaptado para PcD (rampa/plataforma)', tipo: 'booleano', padrao: false, naTabela: true },
    { nome: 'proprietario_tipo', rotulo: 'Pertence a', tipo: 'selecao', opcoes: opcoes({ transportador: 'Transportador contratado', municipio: 'Município (frota própria)' }), padrao: 'transportador', naTabela: true },
    { nome: 'transportador_id', rotulo: 'Transportador', tipo: 'referencia', referencia: 'transportadores', naTabela: true, visivel: doTransportador('proprietario_tipo'), obrigatorioSe: doTransportador('proprietario_tipo') },
    { nome: 'municipio_id', rotulo: 'Município', tipo: 'referencia', referencia: 'municipios', naTabela: true, visivel: doMunicipio('proprietario_tipo'), obrigatorioSe: doMunicipio('proprietario_tipo') },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano', padrao: true, naTabela: true },
  ],
}

const motorista = (v: Record<string, unknown>) => v.funcao === 'motorista'

export const CONDUTOR: CadastroConfig = {
  colecao: 'condutores',
  titulo: 'Condutores e monitores',
  singular: 'condutor / monitor',
  descricao: 'Motoristas (CTB art. 138: mais de 21 anos, CNH categoria D, curso especializado), condutores de embarcação e monitores.',
  ordenarPor: (r) => String(r.nome),
  campos: [
    { nome: 'funcao', rotulo: 'Função', tipo: 'selecao', opcoes: FUNCOES, padrao: 'motorista', naTabela: true },
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'texto', naTabela: true },
    { nome: 'cpf', rotulo: 'CPF', tipo: 'cpf_cnpj', naTabela: true },
    { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'data', obrigatorioSe: motorista },
    { nome: 'cnh_numero', rotulo: 'Nº da CNH', tipo: 'texto', visivel: motorista, obrigatorioSe: motorista },
    { nome: 'cnh_categoria', rotulo: 'Categoria da CNH', tipo: 'selecao', opcoes: opcoes({ D: 'D', E: 'E', AD: 'AD', AE: 'AE' }), naTabela: true, visivel: motorista, obrigatorioSe: motorista },
    { nome: 'cnh_validade', rotulo: 'Validade da CNH', tipo: 'data', naTabela: true, visivel: motorista, obrigatorioSe: motorista },
    { nome: 'vinculo_tipo', rotulo: 'Vínculo', tipo: 'selecao', opcoes: opcoes({ transportador: 'Transportador contratado', municipio: 'Município (servidor)' }), padrao: 'transportador' },
    { nome: 'transportador_id', rotulo: 'Transportador', tipo: 'referencia', referencia: 'transportadores', naTabela: true, visivel: doTransportador('vinculo_tipo'), obrigatorioSe: doTransportador('vinculo_tipo') },
    { nome: 'municipio_id', rotulo: 'Município', tipo: 'referencia', referencia: 'municipios', naTabela: true, visivel: doMunicipio('vinculo_tipo'), obrigatorioSe: doMunicipio('vinculo_tipo') },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'texto' },
    { nome: 'ativo', rotulo: 'Ativo', tipo: 'booleano', padrao: true, naTabela: true },
  ],
}

export const ALOCACAO: CadastroConfig = {
  colecao: 'alocacoes',
  titulo: 'Veículos e condutores em serviço',
  singular: 'alocação',
  descricao: 'Quem roda neste contrato. A documentação de cada um é conferida automaticamente.',
  ordenarPor: (r) => String(r.inicio),
  campos: [
    { nome: 'veiculo_id', rotulo: 'Veículo', tipo: 'referencia', referencia: 'veiculos', naTabela: true },
    { nome: 'condutor_id', rotulo: 'Motorista / condutor', tipo: 'referencia', referencia: 'condutores', naTabela: true, filtroReferencia: (c) => c.funcao !== 'monitor' },
    { nome: 'monitor_id', rotulo: 'Monitor', tipo: 'referencia', referencia: 'condutores', naTabela: true, filtroReferencia: (c) => c.funcao === 'monitor' },
    { nome: 'rota', rotulo: 'Rota / trajeto', tipo: 'texto', naTabela: true },
    { nome: 'inicio', rotulo: 'Início', tipo: 'data', naTabela: true },
    { nome: 'fim', rotulo: 'Fim', tipo: 'data', naTabela: true, ajuda: 'Em branco = em serviço.' },
  ],
}

export const EXIGENCIA: CadastroConfig = {
  colecao: 'exigencias_documentais',
  titulo: 'Exigências documentais',
  singular: 'exigência',
  descricao: 'Documentos obrigatórios de veículos, condutores e contratados, com base legal e periodicidade (ver docs/02-exigencias-documentais.md).',
  ordenarPor: (r) => `${r.aplica_a}${r.codigo}`,
  campos: [
    { nome: 'codigo', rotulo: 'Código', tipo: 'texto', naTabela: true },
    { nome: 'nome', rotulo: 'Exigência', tipo: 'texto', naTabela: true },
    { nome: 'aplica_a', rotulo: 'Aplica-se a', tipo: 'selecao', opcoes: opcoes({ veiculo: 'Veículo', condutor: 'Condutor/monitor', contratado: 'Contratado' }), naTabela: true },
    {
      nome: 'condicao',
      rotulo: 'Quando',
      tipo: 'selecao',
      naTabela: true,
      opcoes: opcoes({ todos: 'Sempre', rodoviario: 'Veículo rodoviário', aquaviario: 'Embarcação', motorista: 'Motorista', condutor_embarcacao: 'Condutor de embarcação', monitor: 'Monitor', pj: 'Pessoa jurídica', pf: 'Pessoa física' }),
    },
    { nome: 'tipo_documento_id', rotulo: 'Tipo de documento', tipo: 'referencia', referencia: 'tipos_documento' },
    { nome: 'forca', rotulo: 'Força', tipo: 'selecao', opcoes: opcoes({ lei: 'Lei (bloqueia)', see: 'Norma SEE (bloqueia)', recomendada: 'Recomendada (só avisa)' }), naTabela: true },
    { nome: 'validade_meses', rotulo: 'Validade (meses)', tipo: 'numero', naTabela: true, ajuda: 'Em branco = usa a data de validade impressa no documento; 0 = não vence.' },
    { nome: 'momento', rotulo: 'Momento', tipo: 'selecao', opcoes: opcoes({ inicial: 'Inicial (contratação)', periodico: 'Periódico' }), naTabela: true },
    { nome: 'base_legal', rotulo: 'Base legal', tipo: 'texto_longo', naTabela: true },
    { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano', padrao: true },
  ],
}

const terceirizado = (v: Record<string, unknown>) => v.tipo === 'terceirizado'

export const CONTRATACAO_MUNICIPAL: CadastroConfig = {
  colecao: 'contratacoes_municipais',
  titulo: 'Como o município executa o transporte',
  singular: 'contratação / frota própria',
  descricao: 'Serviços terceirizados contratados pelo município (Lei 14.133/2021) e frota própria, mantidos com recursos do PTE.',
  ordenarPor: (r) => String(r.tipo),
  campos: [
    { nome: 'tipo', rotulo: 'Forma', tipo: 'selecao', opcoes: opcoes({ terceirizado: 'Serviço terceirizado', frota_propria: 'Frota própria do município' }), padrao: 'terceirizado', naTabela: true },
    { nome: 'transportador_id', rotulo: 'Contratado', tipo: 'referencia', referencia: 'transportadores', naTabela: true, visivel: terceirizado, obrigatorioSe: terceirizado },
    { nome: 'numero_contrato', rotulo: 'Nº do contrato', tipo: 'texto', naTabela: true, visivel: terceirizado, obrigatorioSe: terceirizado },
    {
      nome: 'modalidade',
      rotulo: 'Modalidade',
      tipo: 'selecao',
      visivel: terceirizado,
      obrigatorioSe: terceirizado,
      naTabela: true,
      opcoes: opcoes({ pregao: 'Pregão', concorrencia: 'Concorrência', credenciamento: 'Credenciamento', dispensa: 'Dispensa', inexigibilidade: 'Inexigibilidade', ata_rp: 'Adesão a ata de registro de preços', outro: 'Outro' }),
    },
    { nome: 'numero_processo', rotulo: 'Nº do processo licitatório', tipo: 'texto', visivel: terceirizado },
    { nome: 'data_assinatura', rotulo: 'Assinatura', tipo: 'data', visivel: terceirizado },
    { nome: 'vigencia_inicio', rotulo: 'Início da vigência', tipo: 'data', naTabela: true, visivel: terceirizado, obrigatorioSe: terceirizado },
    { nome: 'vigencia_fim', rotulo: 'Fim da vigência', tipo: 'data', naTabela: true, visivel: terceirizado, obrigatorioSe: terceirizado },
    { nome: 'valor', rotulo: 'Valor do contrato (R$)', tipo: 'moeda', naTabela: true, visivel: terceirizado, obrigatorioSe: terceirizado },
    { nome: 'objeto', rotulo: 'Objeto / rotas atendidas', tipo: 'texto_longo', naTabela: true },
    { nome: 'fiscal_nome', rotulo: 'Fiscal do contrato no município', tipo: 'texto', naTabela: true },
    { nome: 'ativo', rotulo: 'Ativa', tipo: 'booleano', padrao: true },
  ],
}

export const ROTA_PTE: CadastroConfig = {
  colecao: 'rotas_pte',
  titulo: 'Rotas (TER/MG)',
  singular: 'rota',
  descricao: 'Rotas casa–escola–casa informadas no Sistema Transcolar Rural. Base do cálculo do repasse (Res. 5.267/2026, art. 14).',
  ordenarPor: (r) => String(r.codigo),
  campos: [
    { nome: 'codigo', rotulo: 'Rota', tipo: 'texto', naTabela: true },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
    { nome: 'turno', rotulo: 'Turno', tipo: 'selecao', opcoes: opcoes({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' }), naTabela: true },
    { nome: 'km_diario', rotulo: 'Km por dia (percurso total)', tipo: 'numero', naTabela: true },
    { nome: 'custo_km', rotulo: 'Custo por km (R$)', tipo: 'moeda', naTabela: true, ajuda: 'Parâmetro de custo informado pelo município.' },
    { nome: 'total_passageiros', rotulo: 'Passageiros (total)', tipo: 'numero', naTabela: true, ajuda: 'Inclui estudantes de outras redes.' },
    { nome: 'capacidade', rotulo: 'Capacidade do veículo', tipo: 'numero', naTabela: true },
    { nome: 'contratacao_id', rotulo: 'Operada por', tipo: 'referencia', referencia: 'contratacoes_municipais' },
    { nome: 'veiculo_id', rotulo: 'Veículo', tipo: 'referencia', referencia: 'veiculos' },
    { nome: 'urbana', rotulo: 'Rota urbana', tipo: 'booleano', padrao: false, naTabela: true },
    { nome: 'ativa', rotulo: 'Ativa', tipo: 'booleano', padrao: true, naTabela: true },
  ],
}

export const DESPESA_PTE: CadastroConfig = {
  colecao: 'despesas_pte',
  titulo: 'Despesas do município (conta PTE)',
  singular: 'despesa',
  descricao: 'Pagamentos feitos pelo município com recursos do PTE. Comprovante (NF-e) em até 30 dias úteis da transação (Res. 5.267/2026, art. 22).',
  ordenarPor: (r) => String(r.data_transacao),
  campos: [
    { nome: 'data_transacao', rotulo: 'Data da transação', tipo: 'data', naTabela: true },
    { nome: 'favorecido', rotulo: 'Favorecido', tipo: 'texto', naTabela: true },
    { nome: 'cpf_cnpj', rotulo: 'CPF/CNPJ do favorecido', tipo: 'cpf_cnpj' },
    {
      nome: 'categoria',
      rotulo: 'Categoria (art. 5º)',
      tipo: 'selecao',
      naTabela: true,
      opcoes: opcoes({ servico_terceirizado: 'Serviço terceirizado', combustivel: 'Combustível e lubrificantes', manutencao: 'Manutenção / peças / pneus', seguro_licenciamento: 'Seguro, licenciamento, impostos', embarcacao: 'Embarcação', outros: 'Outros' }),
    },
    { nome: 'contratacao_id', rotulo: 'Contratação / frota', tipo: 'referencia', referencia: 'contratacoes_municipais' },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
    { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'moeda', naTabela: true },
    { nome: 'nf_numero', rotulo: 'Nº da NF-e', tipo: 'texto', naTabela: true },
    { nome: 'data_comprovacao', rotulo: 'Comprovado no BB Gestão Ágil em', tipo: 'data', naTabela: true },
  ],
}
