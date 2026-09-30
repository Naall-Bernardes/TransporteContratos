// Telas do módulo Judicial/MP. A caracterização espelha o formulário
// FOR_Caracterizacao_Demanda_Transporte_Escolar (a numeração dos itens aparece no rótulo).

import { opcoes, UNIDADES_PRECO, type CadastroConfig, type CampoConfig } from '@/features/cadastros/configuracoes'

const sim = (campo: string) => (v: Record<string, unknown>) => !!v[campo]

export const ORIGENS = opcoes({ judicial: 'Decisão judicial', ministerio_publico: 'Requisição do MP', outro: 'Outro' })
export const SITUACOES_DEMANDA = opcoes({ ativa: 'Ativa', cumprida: 'Cumprida', suspensa: 'Suspensa', encerrada: 'Encerrada' })

export const DEMANDA: CadastroConfig = {
  colecao: 'demandas',
  titulo: 'Demandas judiciais e do MP',
  singular: 'demanda',
  descricao: '',
  ordenarPor: (r) => String(r.prazo_judicial),
  campos: [
    { nome: 'origem', rotulo: '1.4 Origem', tipo: 'selecao', opcoes: ORIGENS, padrao: 'judicial', secao: '1. Identificação da demanda' },
    { nome: 'origem_outro', rotulo: 'Qual?', tipo: 'texto', visivel: (v) => v.origem === 'outro', obrigatorioSe: (v) => v.origem === 'outro' },
    { nome: 'numero_processo_origem', rotulo: '1.1 Nº do processo judicial / procedimento MP', tipo: 'texto' },
    { nome: 'numero_sei', rotulo: '1.2 Nº do processo SEI', tipo: 'texto', emFormulario: true },
    { nome: 'comarca', rotulo: 'Comarca', tipo: 'texto' },
    { nome: 'orgao', rotulo: 'Vara / Promotoria', tipo: 'texto' },
    { nome: 'data_ciencia', rotulo: 'Data de ciência pelo Estado', tipo: 'data' },
    { nome: 'data_recebimento', rotulo: '1.3 Data de recebimento', tipo: 'data' },
    { nome: 'prazo_judicial', rotulo: '1.5 Prazo de cumprimento', tipo: 'data' },
    { nome: 'multa_diaria', rotulo: 'Multa diária (R$)', tipo: 'moeda' },
    { nome: 'prazo_devolucao_formulario', rotulo: '1.6 Devolver o formulário até', tipo: 'data' },
    { nome: 'escola_id', rotulo: '1.9 Escola estadual', tipo: 'referencia', referencia: 'escolas', ajuda: 'SRE e município vêm da escola.' },
    {
      nome: 'caixa_escolar_id',
      rotulo: '1.10 Caixa Escolar',
      tipo: 'referencia',
      referencia: 'caixas_escolares',
      filtroReferencia: (c, v) => !v.escola_id || c.escola_id === v.escola_id,
    },
    { nome: 'responsavel_sre_id', rotulo: '1.11 Responsável pelo acompanhamento na SRE', tipo: 'referencia', referencia: 'usuarios' },
    { nome: 'decisao_resumo', rotulo: 'Resumo da decisão', tipo: 'texto_longo' },
  ],
}

export const ORGAOS_OFICIO = opcoes({
  judiciario: 'Judiciário',
  ministerio_publico: 'Ministério Público',
  defensoria: 'Defensoria Pública',
  conselho_tutelar: 'Conselho Tutelar',
  outro: 'Outro',
})

export const TIPOS_OFICIO = opcoes({
  pedido_informacao: 'Pedido de informação',
  intimacao_cumprimento: 'Intimação para cumprimento de sentença/decisão',
  reiteracao: 'Reiteração / cobrança',
  outro: 'Outro',
})

export const OFICIO: CadastroConfig = {
  colecao: 'oficios',
  titulo: 'Ofícios',
  singular: 'ofício',
  descricao: '',
  ordenarPor: (r) => String(r.prazo_resposta),
  campos: [
    { nome: 'numero', rotulo: 'Nº do ofício', tipo: 'texto', naTabela: true },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'selecao', opcoes: TIPOS_OFICIO, padrao: 'pedido_informacao', naTabela: true },
    { nome: 'orgao_tipo', rotulo: 'Órgão remetente', tipo: 'selecao', opcoes: ORGAOS_OFICIO, padrao: 'judiciario', naTabela: true },
    { nome: 'orgao_nome', rotulo: 'Vara / promotoria / unidade', tipo: 'texto', obrigatorioSe: (v) => v.orgao_tipo === 'outro' },
    { nome: 'comarca', rotulo: 'Comarca', tipo: 'texto', obrigatorioSe: (v) => v.tipo === 'intimacao_cumprimento' },
    { nome: 'numero_processo_judicial', rotulo: 'Nº do processo judicial / procedimento', tipo: 'texto', obrigatorioSe: (v) => v.tipo === 'intimacao_cumprimento' },
    { nome: 'numero_sei', rotulo: 'Nº do processo SEI', tipo: 'texto' },
    { nome: 'data_recebimento', rotulo: 'Data de recebimento', tipo: 'data', naTabela: true },
    { nome: 'prazo_resposta', rotulo: 'Prazo de resposta', tipo: 'data', naTabela: true },
    { nome: 'assunto', rotulo: 'Assunto', tipo: 'texto_longo', naTabela: true },
    { nome: 'escola_id', rotulo: 'Escola envolvida (opcional)', tipo: 'referencia', referencia: 'escolas', ajuda: 'Sugere a SRE quando for preciso pedir informação.' },
    { nome: 'resposta_numero', rotulo: 'Nº do ofício de resposta', tipo: 'texto', naTabela: true, emFormulario: false },
    { nome: 'resposta_data', rotulo: 'Data da resposta', tipo: 'data', naTabela: true, emFormulario: false },
  ],
}

export const OFICIO_CONSULTA: CadastroConfig = {
  colecao: 'oficio_consultas',
  titulo: 'Pedidos de informação à SRE',
  singular: 'pedido de informação',
  descricao: '',
  ordenarPor: (r) => String(r.solicitada_em),
  campos: [
    { nome: 'pergunta', rotulo: 'O que a SRE deve informar', tipo: 'texto_longo', naTabela: true },
    { nome: 'solicitada_em', rotulo: 'Pedido em', tipo: 'data', naTabela: true },
    { nome: 'prazo', rotulo: 'Prazo da SRE', tipo: 'data', naTabela: true },
    { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: opcoes({ pendente: 'Aguardando SRE', respondida: 'Respondida' }), naTabela: true },
    { nome: 'resposta', rotulo: 'Informação da SRE', tipo: 'texto_longo', naTabela: true },
    { nome: 'respondida_em', rotulo: 'Respondida em', tipo: 'data', naTabela: true },
  ],
}

/** Dados pedidos ao iniciar o cumprimento (o resto vem do ofício). */
export const INICIO_CUMPRIMENTO: CadastroConfig = {
  ...DEMANDA,
  campos: DEMANDA.campos
    .filter((c) => ['escola_id', 'caixa_escolar_id', 'responsavel_sre_id', 'prazo_devolucao_formulario', 'prazo_judicial', 'multa_diaria', 'decisao_resumo'].includes(c.nome))
    .map((c) => (['escola_id', 'responsavel_sre_id', 'prazo_judicial'].includes(c.nome) ? { ...c, obrigatorioSe: () => true } : c)),
}

export const AUTORIZACAO_SUBSECRETARIO: CadastroConfig = {
  colecao: 'autorizacoes_subsecretario',
  titulo: 'Autorizações do subsecretário',
  singular: 'autorização',
  descricao: '',
  ordenarPor: (r) => String(r.criado_em),
  campos: [
    { nome: 'decisao', rotulo: 'Decisão', tipo: 'selecao', opcoes: opcoes({ aprovada: 'Liberação aprovada', devolvida: 'Devolvida para ajuste' }), naTabela: true },
    { nome: 'data', rotulo: 'Data', tipo: 'data', naTabela: true },
    { nome: 'subsecretario_id', rotulo: 'Subsecretário(a)', tipo: 'referencia', referencia: 'usuarios', naTabela: true },
    { nome: 'valor_mensal', rotulo: 'Valor mensal autorizado (R$)', tipo: 'moeda', naTabela: true },
    { nome: 'meses', rotulo: 'Meses', tipo: 'numero', naTabela: true },
    { nome: 'valor_total', rotulo: 'Valor total autorizado (R$)', tipo: 'moeda', naTabela: true },
    { nome: 'parecer', rotulo: 'Parecer / motivo', tipo: 'texto_longo', naTabela: true },
  ],
}

export const PAF: CadastroConfig = {
  colecao: 'pafs',
  titulo: 'PAF',
  singular: 'PAF',
  descricao: '',
  ordenarPor: (r) => String(r.data_criacao),
  campos: [
    { nome: 'numero', rotulo: 'Número oficial do PAF', tipo: 'texto', naTabela: true },
    { nome: 'data_criacao', rotulo: 'Data de criação do PAF', tipo: 'data', naTabela: true },
    { nome: 'data_vigencia', rotulo: 'Data de vigência (5 anos)', tipo: 'data', naTabela: true, emFormulario: false },
    { nome: 'valor', rotulo: 'Valor financeiro (R$)', tipo: 'moeda', naTabela: true },
    { nome: 'cnpj_destinatario', rotulo: 'CNPJ de destino', tipo: 'cpf_cnpj', naTabela: true },
  ],
}

export const EXECUCAO: CadastroConfig = {
  colecao: 'demandas',
  titulo: 'Início do transporte',
  singular: 'início do transporte',
  descricao: '',
  ordenarPor: () => '',
  campos: [{ nome: 'data_inicio_transporte', rotulo: 'Data de início efetivo do transporte', tipo: 'data', obrigatorioSe: () => true, ajuda: 'Com o transporte iniciado, o prazo judicial é considerado cumprido.' }],
}

// ---------- Caracterização (formulário) ----------

const TURNOS = opcoes({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' })
const DIAS = opcoes({ seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' })

export const STATUS_CARACTERIZACAO = opcoes({ rascunho: 'Rascunho', enviada: 'Enviada', em_diligencia: 'Em diligência', aprovada: 'Aprovada' })

const S2 = '2. Identificação do estudante (complemento)'
const S4 = '4. Endereço de origem e características do trajeto'
const S6 = '6. Estudantes no mesmo trajeto'
const S7 = '7. Proposta de atendimento (escola / Caixa Escolar)'
const S8 = '8.12 Documentos pendentes'
const S9 = '9. Declaração'
const S10 = '10. Análise da SRE / unidade central'

export const CAMPOS_CARACTERIZACAO: CampoConfig[] = [
  { secao: S2, nome: 'turma_ano', rotulo: '2.6 Turma / ano', tipo: 'texto' },
  { secao: S2, nome: 'turno', rotulo: '2.7 Turno', tipo: 'selecao', opcoes: TURNOS },
  { secao: S2, nome: 'horario_entrada', rotulo: '2.8 Horário de entrada', tipo: 'hora' },
  { secao: S2, nome: 'horario_saida', rotulo: '2.9 Horário de saída', tipo: 'hora' },
  { secao: S2, nome: 'dias_semana', rotulo: '2.10 Dias da semana em que estuda', tipo: 'multipla', opcoes: DIAS },
  { secao: S2, nome: 'contraturno', rotulo: '2.11 Frequenta contraturno, atividade complementar ou estágio', tipo: 'booleano' },
  { secao: S2, nome: 'contraturno_detalhe', rotulo: 'Dias e horários do contraturno', tipo: 'texto', visivel: sim('contraturno') },
  { secao: S2, nome: 'escola_mais_proxima', rotulo: '2.12 Escola mais próxima da residência e motivo de não ser atendido nela', tipo: 'texto_longo', naoSeAplica: true },

  { secao: S4, nome: 'endereco_residencia', rotulo: '4.1 Endereço completo (rua, nº, comunidade, distrito, CEP)', tipo: 'texto_longo' },
  { secao: S4, nome: 'ponto_referencia', rotulo: '4.2 Ponto de referência', tipo: 'texto', naoSeAplica: true },
  { secao: S4, nome: 'latitude', rotulo: '4.3 Latitude', tipo: 'texto' },
  { secao: S4, nome: 'longitude', rotulo: '4.3 Longitude', tipo: 'texto' },
  { secao: S4, nome: 'link_mapa', rotulo: '4.3 Link do mapa', tipo: 'texto' },
  { secao: S4, nome: 'zona', rotulo: '4.4 Zona', tipo: 'selecao', opcoes: opcoes({ urbana: 'Urbana', rural: 'Rural' }) },
  { secao: S4, nome: 'distancia_km_ida', rotulo: '4.5 Distância residência–escola (km, só ida)', tipo: 'numero' },
  { secao: S4, nome: 'tempo_ida_min', rotulo: '4.6 Tempo estimado de deslocamento (min, só ida)', tipo: 'numero' },
  { secao: S4, nome: 'viagens_dia', rotulo: '4.7 Nº de viagens por dia', tipo: 'selecao', opcoes: opcoes({ '2': '2 (ida e volta)', '4': '4', outro: 'Outro' }) },
  { secao: S4, nome: 'tipo_via', rotulo: '4.8 Tipo de via predominante', tipo: 'selecao', opcoes: opcoes({ asfalto: 'Asfalto', cascalho: 'Cascalho', terra: 'Terra', misto: 'Trecho misto' }) },
  { secao: S4, nome: 'condicao_via', rotulo: '4.9 Condição da via', tipo: 'selecao', opcoes: opcoes({ boa: 'Boa', regular: 'Regular', ruim_chuva: 'Ruim / intransitável na chuva' }) },
  {
    secao: S4,
    nome: 'obstaculos',
    rotulo: '4.10 Obstáculos no trajeto',
    tipo: 'multipla',
    opcoes: opcoes({
      ponte_restricao_peso: 'Ponte com restrição de peso',
      balsa: 'Balsa / embarcação',
      aclive: 'Aclive acentuado',
      atoleiro: 'Atoleiro na chuva',
      passagem_molhada: 'Passagem molhada',
      largura_insuficiente: 'Largura insuficiente',
      nenhum: 'Nenhum',
    }),
  },
  { secao: S4, nome: 'veiculo_chega_residencia', rotulo: '4.11 O veículo consegue chegar até a residência', tipo: 'booleano', padrao: true },
  { secao: S4, nome: 'distancia_ponto_embarque_m', rotulo: 'Distância até o ponto de embarque (m)', tipo: 'numero', visivel: (v) => !v.veiculo_chega_residencia },
  { secao: S4, nome: 'exige_4x4', rotulo: '4.12 Trecho exige tração 4x4', tipo: 'selecao', opcoes: opcoes({ nao: 'Não', ano_todo: 'Sim, o ano todo', periodo_chuvoso: 'Sim, só no período chuvoso' }) },
  {
    secao: S4,
    nome: 'rota_existente',
    rotulo: '4.13 Rota do PTE/MG ou municipal que atenda o trajeto',
    tipo: 'selecao',
    opcoes: opcoes({ nao_existe: 'Não existe rota', nao_atende_horario: 'Existe, mas não atende o horário', nao_atende_endereco: 'Existe, mas não atende o endereço', pode_atender: 'Existe e pode atender' }),
  },
  { secao: S4, nome: 'rota_identificacao', rotulo: 'Identificação da rota', tipo: 'texto', visivel: (v) => v.rota_existente === 'pode_atender' },

  { secao: S6, nome: 'outros_estudantes_trajeto', rotulo: '6.1 Há outros estudantes da rede estadual no mesmo trajeto', tipo: 'booleano' },
  { secao: S6, nome: 'outros_estudantes_qtd', rotulo: 'Quantidade', tipo: 'numero', visivel: sim('outros_estudantes_trajeto') },
  { secao: S6, nome: 'outros_com_demanda_judicial', rotulo: '6.2 Há demanda judicial para algum deles', tipo: 'booleano', visivel: sim('outros_estudantes_trajeto') },
  { secao: S6, nome: 'estudantes_trajeto', rotulo: '6.3 Identificação (nome, matrícula, turno, endereço)', tipo: 'texto_longo', visivel: sim('outros_estudantes_trajeto') },
  { secao: S6, nome: 'viavel_mesmo_veiculo', rotulo: '6.4 É viável atender todos no mesmo veículo', tipo: 'booleano', padrao: true },
  { secao: S6, nome: 'viabilidade_justificativa', rotulo: 'Justificativa', tipo: 'texto_longo', visivel: (v) => !v.viavel_mesmo_veiculo },

  { secao: S7, nome: 'tipo_veiculo_indicado_id', rotulo: '7.1 Tipo de veículo indicado', tipo: 'referencia', referencia: 'tipos_veiculo' },
  { secao: S7, nome: 'lotacao', rotulo: '7.2 Lotação necessária (passageiros)', tipo: 'numero' },
  { secao: S7, nome: 'km_diario_total', rotulo: '7.3 Km diário total (ida e volta)', tipo: 'numero' },
  { secao: S7, nome: 'dias_letivos_periodo', rotulo: '7.4 Nº de dias letivos no período', tipo: 'numero' },
  {
    secao: S7,
    nome: 'requisitos',
    rotulo: '7.5 Requisitos obrigatórios do serviço',
    tipo: 'multipla',
    opcoes: opcoes({
      cnh_d_curso: 'CNH D + curso de transporte escolar',
      detran_inspecao: 'Autorização DETRAN + inspeção semestral',
      cinto_todos: 'Cinto em todos os assentos',
      retencao_infantil: 'Dispositivo de retenção infantil',
      acompanhante: 'Acompanhante',
      veiculo_acessivel: 'Veículo acessível',
    }),
  },
  { secao: S7, nome: 'justificativa_tecnica', rotulo: '7.6 Justificativa técnica da escolha do veículo (itens 4 e 5)', tipo: 'texto_longo' },
  { secao: S7, nome: 'periodo_atendimento', rotulo: '7.7 Período previsto de atendimento', tipo: 'selecao', opcoes: opcoes({ ano_letivo: 'Ano letivo', ate_nova_decisao: 'Até nova decisão', outro: 'Outro' }) },
  { secao: S7, nome: 'data_inicio_pretendida', rotulo: '7.8 Data pretendida de início', tipo: 'data' },
  { secao: S7, nome: 'valor_estimado_mensal', rotulo: '7.9 Valor estimado mensal (R$)', tipo: 'moeda' },

  { secao: S8, nome: 'documentos_pendentes', rotulo: 'Documentos pendentes', tipo: 'texto_longo', naoSeAplica: true },
  { secao: S8, nome: 'prazo_entrega_pendentes', rotulo: 'Prazo para entrega', tipo: 'data' },

  { secao: S9, nome: 'local_data_declaracao', rotulo: 'Local e data', tipo: 'texto' },
  { secao: S9, nome: 'diretor_nome_masp', rotulo: 'Diretor(a) da escola — nome e MASP', tipo: 'texto' },
  { secao: S9, nome: 'presidente_caixa_nome', rotulo: 'Presidente da Caixa Escolar', tipo: 'texto' },
  { secao: S9, nome: 'responsavel_ciente', rotulo: 'Responsável legal assinou a ciência', tipo: 'booleano' },

  { secao: S10, nome: 'data_recebimento_formulario', rotulo: '10.1 Recebimento do formulário', tipo: 'data' },
  { secao: S10, nome: 'documentacao_completa', rotulo: '10.2 Documentação completa', tipo: 'booleano' },
  { secao: S10, nome: 'data_diligencia', rotulo: 'Diligência em', tipo: 'data', visivel: (v) => !v.documentacao_completa },
  { secao: S10, nome: 'analista_id', rotulo: '10.3 Analista responsável', tipo: 'referencia', referencia: 'usuarios' },
  { secao: S10, nome: 'tipo_veiculo_aprovado_id', rotulo: '10.4 Tipo de veículo aprovado', tipo: 'referencia', referencia: 'tipos_veiculo' },
  { secao: S10, nome: 'valor_referencia_aprovado', rotulo: '10.5 Valor de referência aprovado (R$)', tipo: 'moeda' },
  { secao: S10, nome: 'parecer', rotulo: '10.6 Parecer e encaminhamento', tipo: 'texto_longo' },
]

export const CARACTERIZACAO: CadastroConfig = {
  colecao: 'caracterizacoes',
  titulo: 'Caracterização da demanda',
  singular: 'caracterização',
  descricao: '',
  ordenarPor: () => '',
  campos: [...CAMPOS_CARACTERIZACAO, { nome: 'status', rotulo: 'Situação', tipo: 'selecao', opcoes: STATUS_CARACTERIZACAO, emFormulario: false }],
}

export const RESPONSAVEL: CadastroConfig = {
  colecao: 'responsaveis_legais',
  titulo: '3. Responsável legal',
  singular: 'responsável legal',
  descricao: 'CPF não é armazenado aqui (fica no documento 8.4).',
  ordenarPor: () => '',
  campos: [
    { nome: 'nome', rotulo: '3.1 Nome completo', tipo: 'texto' },
    { nome: 'grau_parentesco', rotulo: '3.2 Grau de parentesco', tipo: 'texto' },
    { nome: 'telefone_principal', rotulo: '3.4 Telefone principal', tipo: 'texto' },
    { nome: 'telefone_alternativo', rotulo: '3.5 Telefone alternativo', tipo: 'texto' },
    { nome: 'email', rotulo: '3.6 E-mail', tipo: 'email' },
    { nome: 'acompanha_trajeto', rotulo: '3.7 Acompanha o estudante no trajeto', tipo: 'selecao', opcoes: opcoes({ sempre: 'Sim, sempre', as_vezes: 'Às vezes', nao: 'Não' }) },
    { nome: 'observacoes', rotulo: '3.8 Observações do responsável', tipo: 'texto_longo' },
  ],
}

export const SAUDE: CadastroConfig = {
  colecao: 'caracterizacoes_saude',
  titulo: '5. Condições do estudante (dados sensíveis)',
  singular: 'condições do estudante',
  descricao: '',
  ordenarPor: () => '',
  campos: [
    { nome: 'pcd_mobilidade_reduzida', rotulo: '5.1 Pessoa com deficiência ou mobilidade reduzida', tipo: 'booleano' },
    { nome: 'pcd_especificacao', rotulo: 'Especificar (anexar laudo — item 8.6)', tipo: 'texto_longo', visivel: sim('pcd_mobilidade_reduzida') },
    {
      nome: 'dispositivo_mobilidade',
      rotulo: '5.2 Dispositivo de mobilidade',
      tipo: 'selecao',
      padrao: 'nenhum',
      opcoes: opcoes({ nenhum: 'Não utiliza', cadeira_manual_dobravel: 'Cadeira de rodas manual dobrável', cadeira_motorizada: 'Cadeira motorizada', andador: 'Andador', muletas: 'Muletas', outro: 'Outro' }),
    },
    { nome: 'dispositivo_medidas_peso', rotulo: '5.3 Medidas e peso do dispositivo', tipo: 'texto', visivel: (v) => !!v.dispositivo_mobilidade && v.dispositivo_mobilidade !== 'nenhum' },
    { nome: 'transferencia_assento', rotulo: '5.4 Transfere-se sozinho para o assento', tipo: 'selecao', opcoes: opcoes({ sozinho: 'Sim', com_auxilio: 'Com auxílio', nao_transfere: 'Não (permanece na cadeira)' }) },
    { nome: 'necessita_rampa_plataforma', rotulo: '5.5 Necessita rampa ou plataforma elevatória', tipo: 'booleano' },
    { nome: 'necessita_acompanhante', rotulo: '5.6 Necessita de acompanhante no trajeto', tipo: 'booleano' },
    { nome: 'tipo_acompanhante', rotulo: 'Quem acompanha', tipo: 'selecao', opcoes: opcoes({ familiar: 'Familiar', cuidador: 'Cuidador', profissional_apoio: 'Profissional de apoio da escola' }), visivel: sim('necessita_acompanhante') },
    { nome: 'dispositivo_retencao', rotulo: '5.7 Dispositivo de retenção', tipo: 'selecao', padrao: 'nao', opcoes: opcoes({ nao: 'Não', bebe_conforto: 'Bebê conforto', cadeirinha: 'Cadeirinha', booster: 'Assento de elevação' }) },
    { nome: 'altura_cm', rotulo: 'Altura (cm)', tipo: 'numero', visivel: (v) => !!v.dispositivo_retencao && v.dispositivo_retencao !== 'nao' },
    { nome: 'peso_kg', rotulo: 'Peso (kg)', tipo: 'numero', visivel: (v) => !!v.dispositivo_retencao && v.dispositivo_retencao !== 'nao' },
    { nome: 'condicoes_saude_procedimento', rotulo: '5.8 Condições de saúde que exigem cuidado e procedimento', tipo: 'texto_longo', naoSeAplica: true },
    { nome: 'medicacao_trajeto', rotulo: '5.9 Usa medicação durante o transporte', tipo: 'booleano' },
    { nome: 'medicacao_detalhe', rotulo: 'Qual e horário', tipo: 'texto', visivel: sim('medicacao_trajeto') },
    { nome: 'condicao_sensorial_comportamental', rotulo: '5.10 Condição sensorial ou comportamental que exija adequação', tipo: 'texto_longo', naoSeAplica: true },
    { nome: 'tempo_max_permanencia_min', rotulo: '5.11 Tempo máximo no veículo (min)', tipo: 'numero' },
    { nome: 'observacoes_escola', rotulo: '5.12 Outras observações da escola', tipo: 'texto_longo', naoSeAplica: true },
  ],
}

export { UNIDADES_PRECO }
