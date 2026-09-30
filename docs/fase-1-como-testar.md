# Fase 1 — Autenticação, perfis e cadastros (modo demonstração)

## Como rodar

```bash
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
npm test         # testes automáticos das regras (21 testes)
```

## Roteiro de teste manual

| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Abrir o sistema | Tela de login com 5 usuários fictícios |
| 2 | Entrar como **Carlos Central** → Início | Contadores de todos os cadastros (47 SREs, 6 escolas, 8 alunos…) |
| 3 | Alunos → Novo → Salvar vazio | Campos obrigatórios em vermelho |
| 4 | Preencher com matrícula SIMADE `8800001` | "Já existe aluno com esta matrícula SIMADE." |
| 5 | Trocar a matrícula e salvar | Aluno aparece na lista |
| 6 | Administração → Auditoria → clicar na linha | Mostra quem incluiu, quando e os valores de cada campo |
| 7 | Transportadores → Novo, tipo PJ, CNPJ `11.222.333/0001-82` | "CNPJ inválido." (o correto termina em `-81`) |
| 8 | Preços de referência → Novo, UDI + Automóvel + R$/km, início 01/06/2026 | Recusa: já existe preço vigente no período |
| 9 | Escolas → excluir uma escola | Recusa: escola em uso (sugere marcar como inativa) |
| 10 | Sair → entrar como **Sérgio Analista – UDI** | Vê só 2 escolas, 2 Caixas, 4 alunos e 2 preços; sem menu Administração |
| 11 | Escolas (como Sérgio) | Sem botões Novo/Editar ("somente leitura para o seu perfil") |
| 12 | Alunos → Novo (como Sérgio) | Lista de escolas só com escolas de Uberlândia |
| 13 | Feriados → Novo, abrangência Municipal | Campo Município aparece e fica obrigatório |
| 14 | Qualquer cadastro → Exportar CSV | Arquivo abre no Excel com acentos corretos |
| 15 | Entrar como **Ana Administradora** → Início → Restaurar dados | Volta tudo ao estado inicial |

## Matriz de permissões implementada

| Cadastro | Admin | Analista central | Diretor DAFI / Analista SRE |
|---|---|---|---|
| SREs, municípios, tipos de veículo, feriados | edita | edita | só vê |
| Escolas | edita | edita | só vê (da sua SRE) |
| Preços de referência | edita | edita | só vê (da sua SRE) |
| Caixas Escolares, alunos | edita | edita | **edita (da sua SRE)** |
| Transportadores | edita | edita | **edita** (cadastro geral) |
| Usuários | edita | só vê | — |
| Auditoria | vê | vê | — |
