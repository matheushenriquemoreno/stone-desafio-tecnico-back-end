# Architecture Decision Records

Este diretório contém as decisões arquiteturais aplicáveis ao back-end.

## Índice

| ADR | Decisão | Status | Data |
|---|---|---|---|
| [ADR-001](./ADR-001-clean-architecture-backend.md) | Clean Architecture no back-end | Aceita | 2026-09-02 |
| [ADR-002](./ADR-002-cadastro-de-usuarios.md) | Cadastro de usuários na API | Aceita | 2026-09-02 |
| [ADR-003](./ADR-003-modelagem-dynamodb.md) | Modelagem de dados no DynamoDB | Aceita | 2026-09-02 |
| [ADR-004](./ADR-004-rate-limit.md) | Rate limit por endpoint com janela fixa e IP | Aceita | 2026-09-03 |
| [ADR-005](./ADR-005-autenticacao-cookie-http-only.md) | Autenticação web direta por cookie HttpOnly | Aceita | 2026-09-03 |

A numeração é sequencial e pertence exclusivamente ao histórico de decisões deste repositório.

## Convenções

Os arquivos seguem o padrão `ADR-NNN-nome-curto.md`. Cada ADR registra status, data, contexto, decisão, consequências e alternativas consideradas.

Uma ADR aceita é um registro histórico. Mudanças de decisão devem gerar uma nova ADR, marcar a anterior como substituída e atualizar este índice.
