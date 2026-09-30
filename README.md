# Transporte Escolar – SEE/MG

Sistema de gestão do transporte escolar: demandas judiciais/MP, PTE, repositório de documentos e gestão contratual.

- Proposta de modelo de dados e decisões: [docs/01-proposta-modelo-de-dados.md](docs/01-proposta-modelo-de-dados.md)
- Como testar a fase atual: [docs/fase-1-como-testar.md](docs/fase-1-como-testar.md)

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
| `src/lib/` | Utilidades: validação CPF/CNPJ, dias úteis, formatação, CSV |
| `src/features/cadastros/configuracoes.ts` | Campos de cada cadastro (para incluir um campo novo, comece aqui) |
| `src/features/` | Telas, uma pasta por módulo |
| `supabase/migrations/` | (futuro) SQL do banco |
