# Decisões de tecnologia do back-end

## Contexto

A API oferece cadastro e autenticação de usuários, CRUD paginado de produtos, proteção por JWT e rate limit. Node.js, TypeScript, NestJS e DynamoDB são requisitos do desafio.

As versões exatas das dependências serão fixadas no arquivo de lock. Será utilizada uma versão LTS do Node.js suportada pela versão escolhida do NestJS.

## Decisões arquiteturais relacionadas

- [ADR-001: Clean Architecture no back-end](./adr/ADR-001-clean-architecture-backend.md)
- [ADR-002: Cadastro de usuários na API](./adr/ADR-002-cadastro-de-usuarios.md)
- [ADR-003: Modelagem de dados no DynamoDB](./adr/ADR-003-modelagem-dynamodb.md)
- [ADR-004: Rate limit por endpoint com janela fixa e IP](./adr/ADR-004-rate-limit.md)
- [ADR-005: Autenticação web direta por cookie HttpOnly](./adr/ADR-005-autenticacao-cookie-http-only.md)

## Tecnologias

| Área | Decisão | Motivo |
|---|---|---|
| Runtime | Node.js LTS | Requisito e suporte de longo prazo. |
| Linguagem | TypeScript em modo estrito | Maior segurança na evolução dos contratos. |
| Framework | NestJS | Módulos, injeção de dependência, guards e integração OpenAPI. |
| API | REST com JSON | Adequado à autenticação, listagem e CRUD. |
| Validação | `class-validator`, `class-transformer` e `ValidationPipe` global | Valida e normaliza a entrada. |
| Banco | DynamoDB | Requisito do desafio. |
| Acesso ao banco | AWS SDK v3 com `DynamoDBDocumentClient` | SDK oficial e suficiente, sem ORM desnecessário. |
| Autenticação | Passport, estratégia JWT e guards NestJS com extração por cookie | Mantém a API stateless e impede que o JavaScript leia o token. |
| Senhas | Argon2id | Hash adaptativo; senhas nunca são persistidas em texto puro. |
| Documentação | `@nestjs/swagger` | Geração do contrato OpenAPI a partir dos controllers e DTOs. |
| Testes unitários | Jest | Integração padrão e suporte a mocks. |
| Testes E2E | Jest e Supertest | Validação da API por HTTP. |

## Autenticação e segurança

- O login emite um access token válido por 900 segundos no cookie definido pela ADR-005.
- A chave do JWT é definida por variável de ambiente; `JWT_ACCESS_TTL_SECONDS` terá valor `900` no ambiente publicado.
- Todas as rotas de produtos usam guard JWT.
- O JWT será enviado ao navegador somente em cookie `HttpOnly`; não será retornado no corpo do login.
- O logout limpará o cookie sem criar lista de sessões no servidor.
- CORS aceitará apenas origens explícitas e credenciais; cookies terão `SameSite=Strict` e operações mutáveis validarão `Origin` ou `Referer` conforme a [ADR-006](./adr/ADR-006-protecao-csrf-origem.md).
- Erros de credenciais usam mensagem genérica.
- Segredos não são incluídos na imagem nem versionados.
- Não haverá refresh token no escopo inicial.

## DynamoDB

Serão utilizadas duas tabelas:

| Tabela | Chave de partição | Finalidade |
|---|---|---|
| `users` | `email` | Unicidade, cadastro e localização durante o login. |
| `products` | `id` | Armazenamento e CRUD de produtos. |

A modelagem completa e seus padrões de acesso estão na [ADR-003](./adr/ADR-003-modelagem-dynamodb.md).

## Paginação

A API usará paginação por cursor alinhada ao `LastEvaluatedKey`:

```text
GET /products?limit=20&cursor=<cursor-opaco>
```

A resposta contém os itens e, quando houver outra página, `nextCursor`. O cursor é opaco para o cliente.

## Desenvolvimento em containers

O ambiente local terá o container da API e DynamoDB Local com volume persistente. O `compose.yaml` definirá rede, portas, variáveis não sensíveis e dependências desses serviços.

O `Dockerfile` usará build em múltiplos estágios. O `.env.example` documentará variáveis sem segredos. Scripts idempotentes criarão tabelas e dados mínimos para desenvolvimento e testes.

## Documentação e testes

- OpenAPI acessível pela aplicação e exportável em JSON.
- Exemplos de requisições, respostas e erros.
- Testes unitários de cadastro, autenticação e produtos.
- Testes de integração dos repositórios com DynamoDB Local.
- Testes E2E para cadastro, e-mail duplicado, login válido e inválido, token ausente ou inválido, paginação, CRUD e `429`.

## Qualidade e automação

- ESLint, Prettier e verificação de tipos.
- Scripts do projeto para `lint`, `typecheck`, `test`, `test:e2e` e `build`.
- Pipeline de integração contínua com instalação reproduzível, análise estática, testes e build.

## Fora do escopo inicial

Não serão adicionados inicialmente refresh tokens, sessão persistida no servidor, cache distribuído, mensageria, Kubernetes, AWS API Gateway ou índices antecipados sem padrão de acesso concreto.
