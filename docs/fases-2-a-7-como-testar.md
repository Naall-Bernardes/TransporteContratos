# Fases 2, 4, 5 e 6 — como testar (modo demonstração)

> Alertas por e-mail, riscos e exportação/Power BI foram **removidos** a pedido do usuário (decisão D42).

Tudo roda no navegador, sem banco de dados. **Ao abrir esta versão pela primeira vez, os dados de
demonstração são recriados** (o que você tinha cadastrado antes neste navegador é substituído).
Entre como **Carlos Central** para ver tudo; como **Sérgio (UDI)** ou **Mariana (MOC)** para ver a restrição por SRE.

```bash
npm run dev   # http://localhost:5173
npm test      # 57 testes automáticos
```

## O que há nos dados fictícios

| Onde | Situação preparada |
|---|---|
| Judicial | 8 demandas, uma em cada ponto do fluxo: J01 recém-chegada, J03 caracterização em rascunho, duas em J04 aguardando o subsecretário (MOC, veículo adaptado; MTA, prazo judicial **vencido** e com uma devolução anterior), quatro em J07 execução e fiscalização |
| PTE | Ciclo 2025 encerrado (Januária) · ciclo 2026 aprovado, em execução (Montes Claros, 150 alunos) · ciclo 2027 em adesão (Uberlândia com 5 divergências TER × SIMADE; Januária com aluno duplicado) |
| Contratos | Os 6 instrumentos da Fase 3, agora ligados às demandas e adesões pelo mesmo código único |
| Documentos | ~150 documentos fictícios (ao abrir, o sistema gera um PDF ilustrativo) |

## Roteiro

| # | Onde | Passo | Esperado |
|---|---|---|---|
| **Fase 2 — Documentos** |||
| 1 | Judicial → uma demanda → aba Documentos | "Enviar documento" com um PDF seu | Aparece na lista (v1), com autor, data e tamanho |
| 2 | Mesma lista | Ícone de relógio → nova versão com motivo | Vira v2; a v1 continua acessível (seta ▸) |
| 3 | Mesma lista | Enviar arquivo .docx ou > 20 MB | Recusado com a mensagem do motivo |
| 4 | Mesma lista | "Baixar todos (ZIP)" | ZIP com pastas por tipo de documento |
| 6 | Administração → Auditoria → aba Acessos (LGPD) | — | Cada visualização/download/ZIP registrado |
| **Fase 4 — Judicial** |||
| 7 | Judicial | Ver cartões e semáforo | 3 vermelhas, 1 amarela, 1 com prazo judicial vencido, escalonamento nível 2/3 |
| 8 | Demanda JUD-…-UDI (etapa 3) → Fluxo | Ler checklist | Itens "sempre" em vermelho; laudo/fotos esmaecidos ("não se aplica a este caso") |
| 9 | Aba Alunos → Formulário | "Enviar formulário" em branco | Recusa: "todos os campos devem estar preenchidos"; botão "Não se aplica" preenche |
| 10 | Mesmo formulário | "Exibir dados sensíveis" | Seção 5 aparece; acesso registrado na auditoria |
| 11 | Demanda J01 (UDI) → Fluxo | Entrar como **Sérgio** → "Concluir etapa" | Bloqueado (falta a decisão) e não aparece "concluir com justificativa" |
| 12 | Mesma demanda | Entrar como **Diana (DAFI)** → "Concluir com justificativa" | Avança para J02; justificativa fica no histórico |
| 13–14 | (substituídos pela Rodada 4) | — | — |
| 15 | Aba Contratação | "Registrar contrato" | Contrato nasce com o mesmo código da demanda |
| 16 | (removido — ver D46) | — | — |
| **Fase 5 — PTE** |||
| 17 | PTE → ciclo 2027 → Uberlândia → Conciliação | Ver divergências | Não encontrado, inativo, escola divergente, duplicado |
| 18 | Mesma aba | "Tratar divergência" → justificada | Sai das abertas; mantida ao reexecutar a conciliação |
| 19 | Januária 2027 → Conciliação → Executar | — | Aponta o aluno também informado por Uberlândia |
| 20 | PTE → "Calcular todas" → "Aprovar ciclo" | — | Só aprova se todas tiverem cálculo; depois trava parâmetros e cálculo |
| 21 | Adesão → Termo e repasses → "Gerar termo" | — | Termo criado com o valor aprovado e o cronograma de parcelas |
| 22 | Aba Alunos → "Importar lista TER" | CSV com colunas matricula;nome;inep;km_ida | Importa/atualiza e lista os erros por linha |
| **Fase 6 — Painel** |||
| 23 | Painel | — | Demandas por etapa e SRE × semáforo, tempo médio × SLA, contratos, PTE, documentos pendentes, riscos |
| **Contratos (pendências da Fase 3)** |||
| 29 | Contrato → Pagamentos → "Gerar cronograma" | 12 parcelas mensais | Parcelas somam o valor ainda não previsto |
| 30 | Contrato → Prestação de contas → "Gerar prestações previstas" | Periodicidade semestral | Uma prestação por semestre, sem duplicar |

## Rodada 2 — frota, conformidade legal e PTE (Res. 5.267/2026)

O sistema agora tem dois módulos (seletor no topo do menu): **Transporte Escolar** e **Cadastros**.

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 31 | Painel → Conformidade legal da frota em serviço | Abrir | Cartões com pendências de documentos |
| 32 | Contratos → contrato 001/2026 (UDI) → aba Frota e conformidade | Ver João | Exame toxicológico **vencido** (CTB art. 148-A); laudo semestral a vencer |
| 33 | Mesma aba | "Atualizar" no toxicológico, enviar PDF com data de hoje | Fica "Em dia" (validade = +30 meses) |
| 34 | Contrato 001/2026 (MOC, picape) | — | Laudo semestral vencido; contratado com CNDT vencida |
| 35 | Cadastros → Condutores → Novo motorista nascido em 2010 ou categoria B | Salvar | Recusado (CTB art. 138) |
| 36 | PTE → ciclo 2026 → Montes Claros → Contratações e frota | — | Contrato com Transportes Sertão + frota própria; ônibus SRT1F22 com laudo vencido; motorista da prefeitura sem certidão criminal |
| 37 | Mesma adesão → Rotas / Cálculo | — | 6 rotas; cálculo por rota = R$ 450.000 (memória por rota) |
| 38 | Mesma adesão → Despesas do município | — | 1 despesa sem comprovação há mais de 30 dias úteis (vermelho) |
| 39 | PTE → ciclo 2027 → Uberlândia → Conciliação | — | Divergências de estudantes **e** de rotas: km zero, lotação estourada, custo acima da média, rota urbana |
| 42 | Cadastros → Administração → Exigências documentais | — | Catálogo com base legal e validade, editável |

## Rodada 3 — Judicial/MP por etapas

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 43 | Menu → Judicial / MP | Clicar | Abre o submenu: "Todas as demandas" + as 7 etapas, cada uma com a quantidade de demandas |
| 44 | Submenu "3. Caracterização da demanda" | Clicar | Fila das demandas nessa etapa, com a coluna "O que falta para concluir" |
| 45 | Clicar numa demanda da fila | — | A demanda abre direto na etapa 3, com alunos/formulários, checklist e botão Concluir |
| 46 | Dentro da demanda, menu à esquerda | Clicar em outras etapas | Etapas concluídas mostram o que foi feito; futuras mostram o que será exigido |
| 47 | Dentro da demanda | "Documentos" e "Histórico das etapas" | Todos os documentos do processo e o tempo de cada etapa × SLA |

## Rodada 4 — Autorização do subsecretário e PAF

As antigas etapas 4 (valor/cotações), 5 (OP/PAF) e 6 (liberação) viraram duas: **4. Autorização do subsecretário** e **5. Registro do PAF**. Depois, as etapas de prestação de contas e comprovação do cumprimento também saíram (D46): o fluxo tem **7 etapas** e termina em Execução e fiscalização.

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 48 | Judicial → "4. Autorização do subsecretário" | Clicar | Fila com as demandas MOC e MTA |
| 49 | Demanda MTA → etapa 4, como **Central** | Ler a tela | Dossiê: decisão, prazo judicial vencido em vermelho, alunos com caracterização (veículo, km, 7.9 e 10.5), preços de referência, documentos e a devolução anterior. Sem botões de decisão ("Aguardando a decisão…") e "Concluir etapa" bloqueado |
| 50 | Entrar como **Sofia (Subsecretária)** → mesma demanda | "Devolver para ajuste" sem parecer | Recusado: exige o motivo |
| 51 | Mesma tela | Escrever parecer → "Devolver para ajuste" | Demanda volta para a etapa 3 (Caracterização); a devolução aparece nas "Decisões anteriores" |
| 52 | Demanda MOC → etapa 4, como Sofia | Conferir valor mensal sugerido (soma aprovada pela SRE) e meses → "Aprovar liberação" | Valor total gravado na demanda; avança para a etapa 5 |
| 53 | Entrar como **Central** → demanda MOC → etapa 5 | Preencher número oficial, data de criação, valor e CNPJ | Vigência calculada sozinha (5 anos); o nome da Caixa Escolar aparece abaixo do CNPJ |
| 54 | Mesma tela | Valor acima do autorizado, ou data de criação futura | Recusado com a mensagem do motivo |
| 55 | Mesma tela | "Criar PAF" | Cartão do PAF aparece e a demanda vai para a etapa 6 (Contratos) |

## Rodada 5 — Contratos (etapa 6)

A demanda segue o fluxo: aprovada pelo subsecretário → PAF criado → cai em **Contratos**.

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 56 | Faça os passos 52, 53 e 55 com a demanda MOC | — | Ela aparece em Judicial → "Contratos" |
| 57 | Entrar como **Mariana (MOC)** → demanda → etapa Contratos | Ler o formulário "Cadastrar contrato" | Contratante (Caixa Escolar) e valor do PAF já preenchidos; empresa escolhida do cadastro mostra o CNPJ |
| 58 | Mesmo formulário | Escolher "Seguro-garantia" sem valor da garantia | Recusado: "Informe o valor da garantia" |
| 59 | Mesmo formulário | Valor executado maior que o valor contratado | Recusado; o saldo calculado aparece negativo antes de salvar |
| 60 | Preencher corretamente → "Cadastrar contrato" | — | Cartão com empresa, CNPJ, assinatura, vigência, valor, executado, saldo e garantia; seguem veículo/motorista e conformidade |
| 61 | Mesmo cartão | "Atualizar valor executado" → Salvar | Saldo recalculado; o mesmo valor aparece em Contratos e termos |

## Rodada 6 — Ofícios e cumprimento de sentença

O Judicial/MP agora tem dois fluxos: **Ofícios** (tudo que chega e precisa de resposta) e **Cumprimento de sentença** (o que leva à contratação), com 5 etapas: Caracterização → Autorização do subsecretário → Registro do PAF → Contratos → Execução e fiscalização. As antigas etapas Recebimento e Encaminhamento viraram o ofício e o início do cumprimento. Nas rodadas anteriores, onde se lê J03…J07, leia C01…C05.

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 62 | Menu → Judicial / MP (como **Carlos Central**) | Clicar | Submenu: Ofícios (pendentes), Cumprimento de sentença e, abaixo dele, as 5 etapas |
| 63 | Ofícios | Ver cartões e lista | Um ofício em cada situação: aguardando análise, aguardando SRE, informação recebida, respondido; um com prazo vencido |
| 64 | "Novo ofício" | Cadastrar um pedido de informação da Defensoria | Recebe código OFC-2026-…; situação "Aguardando análise" |
| 65 | No ofício novo → "Pedir informação à SRE" | Escolher UDI, escrever o pedido; prazo já vem com 5 dias úteis | Situação "Aguardando informação da SRE"; o botão "Registrar resposta" fica bloqueado |
| 66 | Entrar como **Sérgio (UDI)** → Ofícios | Abrir o ofício | Ele vê só os ofícios encaminhados à UDI; escreve a informação, anexa documento e envia |
| 67 | Entrar como **Mariana (MOC)** | Ofícios | Não vê o ofício encaminhado à UDI |
| 68 | Voltar como Carlos → mesmo ofício | Registrar nº e data da resposta | Situação "Respondido"; semáforo cinza |
| 69 | Ofícios → a intimação da E.E. Rio das Pedras | "Iniciar cumprimento de sentença" | Formulário já traz escola, Caixa Escolar, prazo e resumo; ao salvar abre o cumprimento JUD-…-UDI na Caracterização |
| 70 | Ofícios → reiteração da MTA | Ver bloco "Cumprimento de sentença" | Já vinculada ao cumprimento da MTA; o cumprimento mostra a aba "Ofícios" com a intimação e a reiteração |
| 71 | Um pedido de informação sem vínculo | "Vincular a um cumprimento existente" | Passa a aparecer na aba Ofícios do cumprimento escolhido |
| 72 | Painel | — | Bloco "Ofícios" com pendentes, aguardando SRE, a vencer, vencidos e respondidos |

> Atualização: **Ofícios** virou item próprio do menu (fora de Judicial/MP, endereço `/oficios`) e, dentro de Judicial/MP, "Cumprimento de sentença" passou a se chamar **Contratações**.

## Rodada 7 — Ofício como chamado (central ⇄ regional)

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 73 | Carlos → Ofícios → um ofício "Aguardando análise" | Ver quadro "Tramitação" | "Com o órgão central" e os botões **Enviar à regional** e **Concluir ofício** |
| 74 | "Enviar à regional" | Escolher a SRE, escrever o pedido | Passa para "Com a regional"; histórico ganha "Enviado à regional" |
| 75 | Entrar como a analista da regional → Ofícios | — | A lista já abre em "Aguardando SRE"; ao abrir o ofício, aparece o pedido, o campo de informações e "Documentos desta resposta" |
| 76 | Preencher, anexar um PDF, "Enviar ao órgão central" | — | Histórico: "Regional respondeu — voltou ao órgão central", com o documento listado |
| 77 | Voltar como Carlos | "Devolver à regional" pedindo complemento | Volta para a regional; o histórico mostra os dois pedidos e respostas |
| 78 | Depois da nova resposta | "Concluir ofício" com nº e data | "Concluído"; histórico fecha com a resposta ao órgão |


> Atualização: o menu "Judicial / MP" foi extinto; o item passa a se chamar **Contratações**, com as 5 etapas logo abaixo.

> Atualização: em **Contratações**, a primeira tela do submenu é **Cadastro a partir de ofício** (`/judicial/novo`): lista as intimações sem contratação, com o botão **Cadastrar contratação**.

> Atualização: o item passou a se chamar **Cadastro**: botão **Cadastrar contratação** no topo (escolhe o ofício de intimação e preenche o formulário) e tabela com todas as contratações já cadastradas e o status de cada uma.

## Rodada 8 — Cadastrar demanda de transporte

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 79 | Contratações → Demandas de transporte | Ver tabela | Todas as demandas com processo, SEI, ofício de origem, processo judicial, escola, data de cadastro, **prioridade** e status |
| 80 | "Cadastrar demanda de transporte" | Escolher a intimação da E.E. Rio das Pedras | Bloco 1 traz automáticos (processo, comarca/vara, órgão, recebimento); bloco 2 já traz a escola, SRE, município e endereço |
| 81 | Clicar em "Cadastrar" sem preencher | — | Campos obrigatórios marcados em vermelho, inclusive dentro de cada aluno |
| 82 | Aluno 1: escolher do cadastro; Aluno 2: "+ Aluno ainda não cadastrado" | Preencher necessidade de transporte de cada um | Veículo acessível = Sim mostra "Utiliza cadeira de rodas?" |
| 83 | Tipo de determinação = Liminar | Ver "Prioridade" | Urgente (sentença com prazo folgado = Alta) |
| 84 | Cadastrar | — | Abre a demanda na Caracterização; os formulários de caracterização já vêm com turno, horários, dias, endereço e acessibilidade; o aluno novo aparece em Cadastros → Alunos |

> Atualização: **Execução e fiscalização** virou uma aba dentro de **Contratos** (abas Contrato · Execução e fiscalização). O submenu de Contratações fica: Demandas de transporte, Caracterização da demanda, Autorização, Registro do PAF e Contratos.

> Atualização (D52): o cadastro da demanda ficou só com o que vem no ofício; a necessidade de transporte de cada aluno é preenchida pela SRE/escola na etapa **Detalhamento da demanda** (antes "Caracterização da demanda").

| # | Onde | Passo | Esperado |
|---|---|---|---|
| 85 | Contratações → Demandas de transporte → Cadastrar | Ver o bloco 3 | Só "Alunos" (buscar no cadastro ou novo); aviso de que a necessidade é preenchida no Detalhamento |
| 86 | Após cadastrar, como **Sérgio (UDI)** → Detalhamento da demanda | Ver cartões dos alunos | Cada aluno com "Necessidade de transporte" para preencher; "O que falta" avisa os alunos sem necessidade |
| 87 | Preencher e "Salvar necessidade" | — | Cartão vira resumo; o "Formulário completo" já traz turno, horários, dias, endereço, acessibilidade e responsável |

