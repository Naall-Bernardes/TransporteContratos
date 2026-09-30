# Fase 3 — Gestão contratual (modo demonstração)

Feita antes da Fase 2 (documentos) a pedido do usuário. Até o repositório existir, os anexos
(aditivo, NF, OB, termo de encerramento) são referenciados pelo **nº SEI do documento**.

## O que existe

| Tela | Conteúdo |
|---|---|
| **Gestão contratual** (lista) | Painel com ativos, a vencer em 90/60/30 dias, vencidos, prestações atrasadas, alertas críticos, valor contratado/executado/saldo. Filtros por situação, tipo e busca (código, nº, SEI, partes). Exportação CSV para Power BI. |
| **Detalhe do instrumento** | Cabeçalho com código único + SEI, indicadores (vigência atual, valor atual, % executado, saldo) e alertas. Abas abaixo. |
| Dados | Partes, CNPJ via cadastro, objeto, nº, assinatura, vigência, valor, dotação, gestor e fiscal |
| Aditivos | Prazo, acréscimo/supressão, rota/veículo, com documento SEI. **Recalculam vigência e valor automaticamente.** |
| Pagamentos / Repasses | Parcelas previstas e pagas, totais, parcela atrasada em vermelho |
| Fiscalização | Registro mensal: dias rodados, alunos, km, avaliação (conforme / ressalvas / não conforme) |
| Ocorrências | Falhas na execução + notificação ao contratado com prazo e data de resposta |
| Prestação de contas | Fluxo com botões: pendente → em análise → (diligência → reapresentada, **uma vez só**) → aprovada / com ressalvas / reprovada |
| Encerramento | Verifica pendências automaticamente (saldo, parcelas, prestação não decidida, ocorrências abertas) e registra o termo; o instrumento fica bloqueado |
| Linha do tempo | Todos os eventos em ordem cronológica, por cor |

## Regras que o sistema impõe

1. Vigência atual = fim original ou nova data do último aditivo de prazo; valor atual = original + acréscimos − supressões. **Nunca são digitados.**
2. Aditivo **assinado depois do fim da vigência é recusado** (instrumento já extinto).
3. Aditivo de prazo precisa estender a vigência; supressão não pode deixar o valor abaixo do já pago.
4. Total pago não pode ultrapassar o valor atual (saldo nunca fica negativo).
5. Acréscimos acima de 25% do valor original geram **alerta** (não bloqueiam).
6. Prestação de contas não pula etapas e só admite **uma** diligência.
7. Instrumento encerrado não aceita lançamentos; só o administrador altera.
8. Ao cadastrar um instrumento, o sistema gera o **código único**: `JUD-ano-SRE-0001` (contrato) ou `PTE-ano-IBGE-001` (termo).
9. Analista/diretor de SRE vê e edita só os instrumentos da sua regional.

## Roteiro de teste

| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Entrar como **Carlos Central** → Contratos e termos | 4 ativos; cartões de alerta preenchidos; `JUD-…-UDI-0001` "vence em até 30 dias" |
| 2 | Clicar no cartão **Vencidos sem encerramento** | Aparece o contrato 002/2026 (UDI) com alerta crítico |
| 3 | Abrir o 002/2026 → Aditivos → Incluir, data de hoje, prorrogar | Recusa: "assinado após o fim da vigência" |
| 4 | Abrir `JUD-…-UDI-0001` → Aditivos → Incluir: prorroga até 18/12, acréscimo 24000 | Vigência, valor (R$ 120 mil), saldo e alerta mudam na hora |
| 5 | Mesmo contrato → Pagamentos → Incluir parcela paga de R$ 50.000 | Recusa: excede o saldo |
| 6 | Prestação de contas → "Registrar reapresentação" → depois "Registrar decisão" | Fluxo avança; não há botão para 2ª diligência |
| 7 | Contrato `JUD-…-MOC-…` (prorrogado) → cabeçalho | Mostra acréscimos de 25% e prestação **atrasada** |
| 8 | Encerramento → ver lista de pendências → Encerrar | Instrumento fica cinza "Encerrado" e sem botões de inclusão |
| 9 | Linha do tempo | Assinatura, pagamentos, fiscalizações, ocorrências, aditivo, prestação em ordem |
| 10 | Novo instrumento (termo PTE, município Uberlândia) | Código `PTE-2026-3170206-001` gerado |
| 11 | Sair → **Sérgio Analista – UDI** → Contratos | Só os 2 contratos de Uberlândia |
| 12 | Exportar CSV | Planilha com vigência atual, valor atual, executado, saldo, alertas |
| 13 | Auditoria | Cada aditivo/parcela/encerramento com antes/depois |
