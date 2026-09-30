# Fases 2, 4, 5, 6 e 7 — como testar (modo demonstração)

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
| Judicial | 8 demandas, uma em cada ponto do fluxo: J01 recém-chegada, J03 caracterização em rascunho, J04 com prazo judicial **vencido** (MTA), J05 com OP e sem PAF e etapa **vencida** (MOC), J08 execução, J09 prestação de contas |
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
| 5 | Menu Documentos | Buscar por aluno "Nove", por código "MOC", por período | Filtra; ZIP do resultado |
| 6 | Administração → Auditoria → aba Acessos (LGPD) | — | Cada visualização/download/ZIP registrado |
| **Fase 4 — Judicial** |||
| 7 | Judicial | Ver cartões e semáforo | 3 vermelhas, 1 amarela, 1 com prazo judicial vencido, escalonamento nível 2/3 |
| 8 | Demanda JUD-…-UDI (etapa 3) → Fluxo | Ler checklist | Itens "sempre" em vermelho; laudo/fotos esmaecidos ("não se aplica a este caso") |
| 9 | Aba Alunos → Formulário | "Enviar formulário" em branco | Recusa: "todos os campos devem estar preenchidos"; botão "Não se aplica" preenche |
| 10 | Mesmo formulário | "Exibir dados sensíveis" | Seção 5 aparece; acesso registrado na auditoria |
| 11 | Demanda J01 (UDI) → Fluxo | Entrar como **Sérgio** → "Concluir etapa" | Bloqueado (falta a decisão) e não aparece "concluir com justificativa" |
| 12 | Mesma demanda | Entrar como **Diana (DAFI)** → "Concluir com justificativa" | Avança para J02; justificativa fica no histórico |
| 13 | Demanda J05 (MOC) | Tentar concluir | Bloqueado: "Registre o PAF" (requisito de dados não dispensável) |
| 14 | Aba Valor | Incluir cotações | A menor fica destacada; "Definir valor" já sugere a menor |
| 15 | Aba Contratação | "Registrar contrato" | Contrato nasce com o mesmo código da demanda |
| 16 | Aba Cumprimento | "Visualizar / imprimir relatório" | Relatório para AGE/Judiciário com cronologia e evidências |
| **Fase 5 — PTE** |||
| 17 | PTE → ciclo 2027 → Uberlândia → Conciliação | Ver divergências | Não encontrado, inativo, escola divergente, duplicado |
| 18 | Mesma aba | "Tratar divergência" → justificada | Sai das abertas; mantida ao reexecutar a conciliação |
| 19 | Januária 2027 → Conciliação → Executar | — | Aponta o aluno também informado por Uberlândia |
| 20 | PTE → "Calcular todas" → "Aprovar ciclo" | — | Só aprova se todas tiverem cálculo; depois trava parâmetros e cálculo |
| 21 | Adesão → Termo e repasses → "Gerar termo" | — | Termo criado com o valor aprovado e o cronograma de parcelas |
| 22 | Aba Alunos → "Importar lista TER" | CSV com colunas matricula;nome;inep;km_ida | Importa/atualiza e lista os erros por linha |
| **Fase 6 — Painel, alertas, exportação** |||
| 23 | Painel | — | Demandas por etapa e SRE × semáforo, tempo médio × SLA, contratos, PTE, documentos pendentes, riscos |
| 24 | Alertas por e-mail → "Processar alertas agora" | Clicar 2 vezes | 1ª gera ~11 e-mails com destinatários por nível; 2ª não duplica |
| 25 | Exportação / Power BI | "Baixar tudo (ZIP)" | CSVs de todas as tabelas + visões vw_demandas, vw_etapas, vw_instrumentos |
| **Fase 7 — Riscos e auditoria** |||
| 26 | Riscos → "Verificar gatilhos agora" | — | Ocorrências automáticas (prazo judicial, contrato vencido, prestação atrasada…) |
| 27 | Riscos → Matriz | — | Riscos posicionados por probabilidade × impacto |
| 28 | Auditoria | Filtrar por usuário e período; exportar | Alterações com antes/depois |
| **Contratos (pendências da Fase 3)** |||
| 29 | Contrato → Pagamentos → "Gerar cronograma" | 12 parcelas mensais | Parcelas somam o valor ainda não previsto |
| 30 | Contrato → Prestação de contas → "Gerar prestações previstas" | Periodicidade semestral | Uma prestação por semestre, sem duplicar |
