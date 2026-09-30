# Transporte Escolar – SEE/MG

Sistema de gestão do transporte escolar: demandas judiciais/MP, PTE, repositório de documentos e gestão contratual.

- Proposta de modelo de dados e decisões: [docs/01-proposta-modelo-de-dados.md](docs/01-proposta-modelo-de-dados.md)
- Exigências documentais e regras do PTE (levantamento legal): [docs/02-exigencias-documentais.md](docs/02-exigencias-documentais.md)
- Como testar: [Fase 1 – cadastros](docs/fase-1-como-testar.md) · [Fase 3 – gestão contratual](docs/fase-3-gestao-contratual-como-testar.md) · [Fases 2, 4 a 7](docs/fases-2-a-7-como-testar.md)

## Rodar localmente

```bash
npm install
npm run dev     # http://localhost:5173
npm test
```

**Modo demonstração:** ainda sem banco de dados. Os dados ficam no navegador (localStorage), o login é simulado
e todos os alunos, escolas e pessoas são fictícios.

## Onde fica cada coisa

| Pasta | Conteúdo |
|---|---|
| `src/lib/dados/` | Camada de dados: regras de integridade, permissões, auditoria, dados de demonstração. Única parte que muda ao conectar o Supabase. |
| `src/lib/` | Utilidades: validação CPF/CNPJ, dias úteis, código único, formatação, CSV |
| `src/lib/contratos/` | Cálculos contratuais (vigência, valor, saldo, alertas, linha do tempo) |
| `src/lib/fluxo/` | Motor de fluxo: SLA em dias úteis, semáforo, escalonamento, checklist, requisitos por etapa |
| `src/lib/pte/` | Conciliação TER × SIMADE, inconsistências de rotas e cálculo do repasse (Res. 5.267/2026) |
| `src/lib/conformidade.ts` | Conformidade documental de veículos, condutores e contratados |
| `src/lib/documentos/` | Repositório de documentos (arquivos, versões, ZIP, log de acesso) |
| `src/lib/monitoramento.ts` | Situação dos processos, alertas por e-mail e gatilhos de risco |
| `src/lib/dados/servicos*.ts` | Operações de negócio (criar demanda, concluir etapa, aprovar ciclo…) |
| `src/features/cadastros/configuracoes.ts` | Campos de cada cadastro (para incluir um campo novo, comece aqui) |
| `src/features/` | Telas, uma pasta por módulo |
| `supabase/migrations/` | (futuro) SQL do banco |
