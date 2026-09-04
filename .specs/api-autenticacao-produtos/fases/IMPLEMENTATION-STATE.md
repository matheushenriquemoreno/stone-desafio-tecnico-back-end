# Estado da Implementação — API de cadastro, autenticação e catálogo de produtos

| Status       | Em execução |
|--------------|-------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-04 |

## Regra de execução

Executar uma fase por vez, sempre a próxima `Pendente`. Uma fase somente muda para `Concluída` depois que todas as suas tarefas possuírem evidências e a skill `review` emitir aprovação; só então a fase seguinte pode ficar `Em execução`.

## Fase ativa

Fase 01 — Tracer bullet e fundação observável.

### Registro de preparação

- Padrões: TypeScript estrito; nomes de domínio em inglês no código; Clean
  Architecture por domínio e camada; controllers sem regra de negócio;
  adaptadores externos atrás de portas; testes unitários, integração e E2E.
- Abstrações reutilizadas: portas explícitas para relógio, identificadores e
  readiness; composition root NestJS; filtro global de erros; cliente
  `DynamoDBDocumentClient` injetado.
- Arquivos inicialmente afetados: `package.json`, lockfile, configurações de
  TypeScript/ESLint/Jest/Nest, `.env.example`, `.gitignore`, `src/`,
  `compose.yaml`, scripts locais e testes da Fase 01.
- Premissas: Node.js `v24.15.0` será usado como runtime disponível; DynamoDB
  Local será a dependência externa local; nenhuma credencial real será
  necessária ou versionada.
- Conflitos: nenhum encontrado entre PRD, design, plano, ADRs e repositório
  vazio.

### Preparação da tarefa T01

- Premissas: a validação de ambiente será a única fonte de parsing e não terá
  defaults para segredos; `DYNAMODB_ENDPOINT` será explícito para tornar o
  ambiente local reproduzível; os comandos de integração e E2E usarão
  `--passWithNoTests` até suas respectivas fases criarem testes.
- Abstrações: `ConfigModule` global e `ConfigService<AppConfig>` no bootstrap;
  `validateEnvironment` como função pura para testes; Jest com configurações
  separadas por nível.
- Arquivos: `package.json`, `tsconfig*.json`, `eslint.config.mjs`,
  `.prettierrc.json`, `jest*.config.cjs`, `.env.example`, `.gitignore`,
  `src/app.module.ts`, `src/main.ts`, `src/shared/infrastructure/configuration.ts`
  e seu teste unitário.
- Verificação: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run test:integration`, `npm run test:e2e` e `npm run build`, incluindo
  cenários de configuração válida, segredo curto e variável ausente.
- Conflitos previstos: a versão atual do NestJS e do TypeScript será fixada no
  lockfile; qualquer incompatibilidade de runtime será registrada como desvio
  antes de ajustar versões.

### Preparação da tarefa T02

- Premissas: relógio e geração de identificadores são portas pequenas e
  compartilhadas; implementações determinísticas ficam em `application` para
  uso explícito nos testes; a fonte real de IDs será `node:crypto.randomUUID`.
- Abstrações: `Clock` com `now()` e `IdGenerator` com `generate()`; fakes
  fixos não terão dependência de NestJS, HTTP, AWS SDK ou JWT.
- Arquivos: portas em `src/shared/application/ports`, fakes em
  `src/shared/application/testing`, implementações reais em
  `src/shared/infrastructure`, teste arquitetural em `test/architecture` e
  regras de importação em `eslint.config.mjs`.
- Verificação: testes unitários dos relógios/IDs, teste de reprodutibilidade
  dos fakes, teste arquitetural e lint com regras de fronteira.
- Conflitos: nenhum; não será criado repositório ou tipo genérico sem uso
  concreto.

### Preparação da tarefa T03

- Premissas: o `correlationId` será aceito somente quando tiver formato opaco
  seguro e, caso contrário, será gerado pela porta de IDs; o corpo HTTP nunca
  será passado ao logger; mensagens de validação serão genéricas e listarão
  apenas propriedades públicas recebidas.
- Abstrações: `ApplicationError` e `ApiError` ficam independentes de HTTP;
  filtro, pipe, middleware e interceptor pertencem à apresentação; o logger
  recebe somente um registro estruturado já sanitizado.
- Arquivos: catálogo de erros e portas de logging em `src/shared/application`,
  filtro/pipe/middleware/interceptor em `src/shared/presentation`, logger
  concreto no compartilhado de infraestrutura, composition root e teste HTTP
  em `test/e2e`.
- Verificação: testes unitários do mapeamento, correlação e logs; E2E de erro
  conhecido, validação e falha inesperada; busca negativa dos valores sensíveis
  capturados; lint, typecheck e suíte completa.
- Conflitos: nenhum; falhas inesperadas manterão detalhes somente fora da
  resposta pública e sem stack trace no log estruturado.

### Preparação da tarefa T04

- Premissas: DynamoDB Local será fixado em `amazon/dynamodb-local:2.6.1`;
  `users` usará `email` e `products` usará `id`, ambas como única chave de
  partição e com `PAY_PER_REQUEST`; o endpoint local usará credenciais dummy.
- Abstrações: `DYNAMODB_DOCUMENT_CLIENT` será o único token consumido pelos
  módulos; o provisionador terá uma checagem explícita de esquema para tornar
  a idempotência segura; prefixo opcional será validado e aplicado aos nomes.
- Arquivos: `compose.yaml`, cliente/módulo DynamoDB em
  `src/shared/infrastructure`, configuração de prefixo, script de
  provisionamento, testes unitários e integração com DynamoDB Local.
- Verificação: `docker compose config`, subida do serviço, provisionamento
  repetido, `DescribeTable` das duas tabelas, isolamento por prefixo e gates
  oficiais do projeto.
- Conflitos: nenhum; não haverá exclusão de tabelas nem fallback para dados
  publicados.

## Fases

| #  | Fase | Arquivo | Status | Concluída em |
|----|------|---------|--------|--------------|
| 01 | Tracer bullet e fundação observável | [fase-01-tracer-bullet-fundacao.md](fase-01-tracer-bullet-fundacao.md) | Em execução | — |
| 02 | Cadastro seguro de usuários | [fase-02-cadastro-usuarios.md](fase-02-cadastro-usuarios.md) | Pendente | — |
| 03 | Autenticação e proteção do cliente web | [fase-03-autenticacao-protecao-web.md](fase-03-autenticacao-protecao-web.md) | Pendente | — |
| 04 | Criação e consulta de produtos | [fase-04-criacao-consulta-produtos.md](fase-04-criacao-consulta-produtos.md) | Pendente | — |
| 05 | Paginação, atualização e exclusão de produtos | [fase-05-paginacao-manutencao-produtos.md](fase-05-paginacao-manutencao-produtos.md) | Pendente | — |
| 06 | Rate limit e conformidade operacional da API | [fase-06-rate-limit-conformidade.md](fase-06-rate-limit-conformidade.md) | Pendente | — |
| 07 | Empacotamento, infraestrutura e entrega | [fase-07-entrega-operacional.md](fase-07-entrega-operacional.md) | Pendente | — |

## Tarefas

| ID  | Fase | Status | Evidências |
|-----|------|--------|------------|
| T01 | 01 | Concluída | `npm ci --ignore-scripts --no-audit --no-fund`, lint, typecheck, teste unitário (1 suíte/4 testes), scripts de integração/E2E, build, bootstrap válido na porta 3010 e startup inválido com saída 1 sanitizada; `git diff --check` sem erros. |
| T02 | 01 | Concluída | Lint com fronteiras, typecheck e `npm test` (6 suítes/11 testes) aprovados; produção usa `node:crypto.randomUUID`, fakes são determinísticos e teste arquitetural não encontrou dependências proibidas. |
| T03 | 01 | Concluída | Lint/typecheck, `npm test` (8 suítes/16 testes), E2E (1 suíte/3 testes), integração, build e diff passaram; respostas 409/400/500 correlacionadas e logs sanitizados comprovados, sem senha/token/stack. |
| T04 | 01 | Concluída | Compose, cliente injetado, provisionamento repetido, integração com duas tabelas isoladas e todos os gates (lint/typecheck/19 unitários/3 E2E/build) passaram; bootstrap real abriu a porta 3011. |
| T05 | 01 | Pendente | — |
| T06 | 02 | Pendente | — |
| T07 | 02 | Pendente | — |
| T08 | 02 | Pendente | — |
| T09 | 02 | Pendente | — |
| T10 | 02 | Pendente | — |
| T11 | 02 | Pendente | — |
| T12 | 02 | Pendente | — |
| T13 | 03 | Pendente | — |
| T14 | 03 | Pendente | — |
| T15 | 03 | Pendente | — |
| T16 | 03 | Pendente | — |
| T17 | 03 | Pendente | — |
| T18 | 04 | Pendente | — |
| T19 | 04 | Pendente | — |
| T20 | 04 | Pendente | — |
| T21 | 04 | Pendente | — |
| T22 | 05 | Pendente | — |
| T23 | 05 | Pendente | — |
| T24 | 05 | Pendente | — |
| T25 | 05 | Pendente | — |
| T26 | 05 | Pendente | — |
| T27 | 05 | Pendente | — |
| T28 | 06 | Pendente | — |
| T29 | 06 | Pendente | — |
| T30 | 06 | Pendente | — |
| T31 | 06 | Pendente | — |
| T32 | 06 | Pendente | — |
| T33 | 06 | Pendente | — |
| T34 | 07 | Pendente | — |
| T35 | 07 | Pendente | — |
| T36 | 07 | Pendente | — |
| T37 | 07 | Pendente | — |
| T38 | 07 | Pendente | — |

## Bloqueios e desvios

Desvio T04: DynamoDB Local usa `user: "0:0"` no Compose para corrigir a permissão do volume nomeado criado como `root:root`; é limitado ao serviço auxiliar local e não antecipa a política de usuário não privilegiado da imagem da API na Fase 07.
