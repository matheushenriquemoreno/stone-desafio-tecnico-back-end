# Estado da Implementação — API de cadastro, autenticação e catálogo de produtos

| Status       | Em execução |
|--------------|-------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-04 |

## Regra de execução

Executar uma fase por vez, sempre a próxima `Pendente`. Uma fase somente muda para `Concluída` depois que todas as suas tarefas possuírem evidências e a skill `review` emitir aprovação; só então a fase seguinte pode ficar `Em execução`.

## Fase ativa

A Fase 05 está `Em execução`, iniciada após o review aprovado da Fase 04.

### Preparação da Fase 05

- Padrões: preservar o domínio Product sem dependências de NestJS, HTTP ou
  DynamoDB; casos de uso dependerão somente da porta `ProductRepository`;
  controllers e DTOs continuarão responsáveis pela borda HTTP.
- Abstrações reutilizadas: `Product`, `ProductRepository`, `Clock`,
  `AccessTokenGuard`, `PublicValidationPipe`, `ApiExceptionFilter` e o cliente
  `DynamoDBDocumentClient` já existentes.
- Premissas: o cursor representa exclusivamente a chave `id` da tabela
  `products`, será Base64 URL-safe sem assinatura e permanecerá opaco para o
  cliente; atualização seguirá last-write-wins e exclusão não será idempotente.
- Arquivos previstos: codec e erro de cursor, casos de uso e porta de
  produtos, adaptador DynamoDB, DTOs/controllers, módulo Products e testes
  unitários, de integração e E2E.
- Verificação: cada tarefa terá teste dirigido; ao final serão executados
  lint, typecheck, suíte unitária, integração, E2E, build e `git diff --check`.
- Conflitos: nenhum encontrado entre PRD, design, plano, ADR-003 e o código
  atual.

### Preparação da tarefa T22

- Premissas: o envelope terá versão `1` e a chave persistida será exatamente
  `{ id: string }`; o limite do cursor será 2.048 caracteres e a saída não
  será assinada nem tratada como criptografia.
- Abstrações: `ProductCursorCodec` ficará na infraestrutura de persistência e
  `InvalidProductCursorError` será o erro de aplicação público; o controller
  não conhecerá `LastEvaluatedKey`.
- Arquivos: codec/erro de cursor e teste unitário dedicado.
- Verificação: round-trip, URL-safe, JSON/versão/estrutura/tipos/tamanho
  inválidos e ausência de payload interno em mensagens.
- Conflitos: nenhum.

### Preparação da tarefa T23

- Premissas: `ProductRepository.list` receberá o limite e o cursor opaco;
  somente o adaptador converterá o cursor para `ExclusiveStartKey` e
  `LastEvaluatedKey`.
- Abstrações: `ProductPage` permanecerá uma saída da aplicação com produtos e
  `nextCursor` opcional; o caso de uso aplicará o padrão 20 e os limites 1–100.
- Arquivos: porta/repositório de produtos, `ListProducts`, adaptador DynamoDB,
  módulo Products e testes unitários/de integração.
- Verificação: catálogo vazio, limites, múltiplas páginas, página final,
  cursor encaminhado e integração com DynamoDB Local.
- Conflitos: nenhum.

### Preparação da tarefa T24

- Premissas: `GET /products` será protegido pelo mesmo guard dos demais
  produtos; o query parser aceitará apenas dígitos decimais para `limit`, com
  padrão 20, e o serializer omitirá `nextCursor` quando ausente.
- Abstrações: DTOs de apresentação traduzirão query e resposta; `ListProducts`
  continuará responsável somente pela regra de limite e pela porta do catálogo.
- Arquivos: DTO/query, DTO de página, controller, módulo Products e E2E de
  listagem/OpenAPI.
- Verificação: catálogo vazio, limites, query inválida, cursor válido/inválido,
  páginas consecutivas, autenticação e contrato OpenAPI.
- Conflitos: nenhum.

### Preparação da tarefa T25

- Premissas: o patch aceita somente `name`, `description`, `price` e
  `imageUrl`; pelo menos uma propriedade deve estar presente e os campos
  omitidos serão reconstruídos a partir do produto atual.
- Abstrações: `Product` continuará dono das invariantes e produzirá um novo
  estado imutável; `UpdateProduct` orquestrará relógio, busca e porta sem
  conhecer DynamoDB.
- Arquivos: domínio Product, caso de uso/erro de atualização, DTO de patch e
  testes unitários.
- Verificação: cada campo isolado, combinações, corpo vazio, `null`, campo
  desconhecido, limites, preservação de `createdAt`/omitidos e `updatedAt`
  controlado.
- Conflitos: nenhum.

### Preparação da tarefa T26

- Premissas: o adaptador usará `UpdateItem` com `attribute_exists(id)`,
  `ReturnValues=ALL_NEW` e expressões construídas somente da lista fechada de
  campos alterados; ausência condicional será traduzida pelo caso de uso.
- Abstrações: `ProductMaintenanceRepository` será a porta para atualização e
  `UpdateProduct` permanecerá independente do SDK; controller/DTO cuidarão de
  cookie, CSRF, validação e serialização pública.
- Arquivos: adaptador/porta DynamoDB, `UpdateProduct`, módulo Products,
  controller/DTO de patch e testes unitários, integração e E2E.
- Verificação: cada combinação de campos, ausência, falha técnica, duas contas,
  proteção HTTP, OpenAPI e preservação dos campos omitidos.
- Conflitos: nenhum.

### Preparação da tarefa T27

- Premissas: `DELETE /products/:id` usará `DeleteItem` com
  `attribute_exists(id)`; ausência condicional será `PRODUCT_NOT_FOUND` e o
  sucesso será `204` sem corpo nem `Content-Type` obrigatório.
- Abstrações: `DeleteProduct` dependerá da porta de manutenção; o controller
  continuará limitado a autenticação, CSRF/origem, status HTTP e OpenAPI.
- Arquivos: adaptador/porta DynamoDB, caso de uso, controller/módulo e testes
  unitários, de integração e E2E.
- Verificação: exclusão existente, repetição, duas contas, autenticação,
  CSRF/origem, corpo vazio e falha técnica.
- Conflitos: nenhum.

### Encerramento da Fase 03

- T13–T17 concluídas com evidências unitárias e E2E.
- Gate completo aprovado: lint, typecheck, 20 suítes/69 testes unitários,
  2 suítes/3 testes de integração, 8 suítes/43 testes E2E e build.
- Review independente aprovado na versão 3, registrado em `REVIEW.md`.
- Ressalvas informativas A-01 e A-02 mantidas; A-02 será revalidada nas rotas
  concretas de Products desta fase.

### Preparação da Fase 03

- Padrões: manter JWT, cookie e Express restritos às camadas de infraestrutura
  e apresentação; os casos de uso dependem somente de portas e do domínio.
- Abstrações reutilizadas: `Clock`, `UserRepository`, `PasswordHasher`,
  `ConfigService`, `ApiExceptionFilter`, `PublicValidationPipe` e o middleware
  global de CORS/CSRF já aprovados nas fases anteriores.
- Arquivos previstos: porta e adaptador de token, caso de uso de autenticação,
  fábrica de cookie, DTOs/controllers Auth, guard JWT e testes unitários/E2E.
- Premissas: o segredo, emissor, audiência, TTL e nome do cookie continuam
  obrigatórios na configuração; o TTL publicado permanece 900 segundos e o
  ambiente de teste pode usar relógio controlado.
- Verificação: testes dirigidos por tarefa, depois lint, typecheck, suíte
  unitária, integração, E2E, build e inspeção negativa de tokens/segredos em
  respostas e logs.
- Conflitos: nenhum encontrado entre PRD, design, ADRs, plano e código atual.

### Preparação da tarefa T13

- Premissas: `jsonwebtoken` será o adaptador técnico; o TTL publicado será
  exatamente 900 segundos e a configuração continuará sem default de segredo.
- Abstrações: `AccessTokenService` expõe somente emissão e validação; a
  identidade validada contém apenas sujeito e instantes de validade.
- Arquivos: porta em `auth/application/ports`, adaptador e teste em
  `auth/infrastructure/security`, além do teste de configuração.
- Verificação: claims decodificadas, algoritmo, assinatura, emissor, audiência,
  expiração, TTL e relógio controlado; lint e typecheck.
- Conflitos previstos: a biblioteca pode adicionar/remover claims de tempo
  implicitamente; o teste deve detectar isso antes de concluir a tarefa.

### Preparação das tarefas T14–T17

- T14: reutilizar `Email` como dono da normalização, consultar antes de
  verificar Argon2id e emitir o token somente após a senha correta; testar
  conta ausente, senha incorreta, hash inválido e falhas técnicas.
- T15: manter o cookie na borda HTTP e a autenticação no caso de uso; testar
  `204`, corpo vazio, atributos, TTL, erro genérico e ausência de `Set-Cookie`.
- T16: não criar caso de uso ou sessão para logout; expirar diretamente o
  cookie centralizado e testar os quatro estados do cookie sem tocar no banco.
- T17: registrar a estratégia Passport com a porta de token e criar um guard
  que aceite somente o cookie configurado; testar identidade válida e todas as
  rejeições sem revelar token.
- Conflitos previstos: o guard padrão do Passport exige opções de módulo no
  contexto de cada controller; se isso impedir a reutilização, manter a
  estratégia Passport e encapsular a chamada em um guard explícito.

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

### Preparação da tarefa T05

- Premissas: readiness será um caso de uso da aplicação que exige o estado de
  inicialização e uma verificação `DescribeTable` de `users` e `products`; toda
  falha da porta será convertida no mesmo `SERVICE_UNAVAILABLE` sem nome da
  tabela ou detalhe do SDK.
- Abstrações: `ReadinessProbe` e `ApplicationLifecycle` serão portas do módulo
  Health; o adaptador DynamoDB ficará na infraestrutura; o controller só
  serializará `{ status: 'ok' }`.
- Arquivos: `src/modules/health` em camadas explícitas, erro compartilhado de
  indisponibilidade, `AppModule` e E2E real de readiness com tabelas temporárias
  por prefixo.
- Verificação: testes unitários do caso de uso para inicialização, sucesso e
  falha inesperada; E2E HTTP com tabelas acessíveis, cada tabela removida e
  resposta correlacionada sem detalhes internos; gates completos da fase.
- Conflitos: nenhum; liveness continua fora da API e o rate limit da rota será
  adicionado somente na Fase 06.

### Transição para a Fase 02

- Gate anterior: review da Fase 01 aprovado na versão 1, registrado em
  `REVIEW.md`.
- Decisão: a Fase 01 foi marcada como `Concluída` e a Fase 02 foi marcada como
  `Em execução`, preservando a ordem aprovada do plano.

### Preparação da tarefa T06

- Premissas: o domínio Auth será independente de NestJS, HTTP, DynamoDB, JWT e
  Argon2; a senha em texto puro será uma entrada transitória do caso de uso e
  não fará parte da entidade persistível.
- Abstrações: usuário e e-mail serão tipos de domínio explícitos; as regras de
  normalização e limites serão funções/objetos pequenos, sem repositório ou
  serviço genérico antecipado.
- Arquivos: `src/auth/domain`, erros de domínio e testes unitários de limites,
  normalização e serialização segura.
- Verificação: executar testes de borda para nome, e-mail e senha, teste de
  equivalência após normalização, busca arquitetural e lint/typecheck.
- Conflitos: nenhum encontrado entre PRD, design, ADRs e a Fase 02; Argon2id
  será introduzido somente na tarefa T07, atrás de porta.

## Fases

| #  | Fase | Arquivo | Status | Concluída em |
|----|------|---------|--------|--------------|
| 01 | Tracer bullet e fundação observável | [fase-01-tracer-bullet-fundacao.md](fase-01-tracer-bullet-fundacao.md) | Concluída | 2026-09-04 |
| 02 | Cadastro seguro de usuários | [fase-02-cadastro-usuarios.md](fase-02-cadastro-usuarios.md) | Concluída | 2026-09-04 |
| 03 | Autenticação e proteção do cliente web | [fase-03-autenticacao-protecao-web.md](fase-03-autenticacao-protecao-web.md) | Concluída | 2026-09-04 |
| 04 | Criação e consulta de produtos | [fase-04-criacao-consulta-produtos.md](fase-04-criacao-consulta-produtos.md) | Concluída | 2026-09-04 |
| 05 | Paginação, atualização e exclusão de produtos | [fase-05-paginacao-manutencao-produtos.md](fase-05-paginacao-manutencao-produtos.md) | Em execução | — |
| 06 | Rate limit e conformidade operacional da API | [fase-06-rate-limit-conformidade.md](fase-06-rate-limit-conformidade.md) | Pendente | — |
| 07 | Empacotamento, infraestrutura e entrega | [fase-07-entrega-operacional.md](fase-07-entrega-operacional.md) | Pendente | — |

## Tarefas

| ID  | Fase | Status | Evidências |
|-----|------|--------|------------|
| T01 | 01 | Concluída | `npm ci --ignore-scripts --no-audit --no-fund`, lint, typecheck, teste unitário (1 suíte/4 testes), scripts de integração/E2E, build, bootstrap válido na porta 3010 e startup inválido com saída 1 sanitizada; `git diff --check` sem erros. |
| T02 | 01 | Concluída | Lint com fronteiras, typecheck e `npm test` (6 suítes/11 testes) aprovados; produção usa `node:crypto.randomUUID`, fakes são determinísticos e teste arquitetural não encontrou dependências proibidas. |
| T03 | 01 | Concluída | Lint/typecheck, `npm test` (8 suítes/16 testes), E2E (1 suíte/3 testes), integração, build e diff passaram; respostas 409/400/500 correlacionadas e logs sanitizados comprovados, sem senha/token/stack. |
| T04 | 01 | Concluída | Compose, cliente injetado, provisionamento repetido, integração com duas tabelas isoladas e todos os gates (lint/typecheck/19 unitários/3 E2E/build) passaram; bootstrap real abriu a porta 3011. |
| T05 | 01 | Concluída | Lint/typecheck, 12 suítes/24 unitários, integração, 2 suítes/6 E2E, build e Compose passaram; `/health` confirmou 200 exato com ambas as tabelas e 503 seguro para cada tabela ausente. |
| T06 | 02 | Concluída | Lint, typecheck, `npm test` (14 suítes/39 testes), build e `git diff --check` aprovados; domínio Auth cobre limites, normalização de e-mail e nome, senha transitória e serialização pública sem hash. |
| T07 | 02 | Concluída | Adaptador `Argon2PasswordHasher` atrás da porta `PasswordHasher`; hash Argon2id com parâmetros explícitos, verificação correta/incorreta e hash malformado cobertos; suíte dirigida (1/3), lint, typecheck, build e diff aprovados. |
| T08 | 02 | Concluída | `DynamoDbUserRepository` com `PutCommand` condicional, `GetCommand`, mapeamento seguro e conflito atômico; unitário (1/4), integração (2/3), suíte total (16/46), lint, typecheck, build e diff aprovados. |
| T09 | 02 | Concluída | Caso de uso `RegisterUser` validado com ordem hash→persistência, ID/instante únicos, resposta pública, rejeição de entrada inválida e propagação de falhas; 1 suíte/6 testes, lint, typecheck, build e diff aprovados. |
| T10 | 02 | Concluída | Política CORS exata registrada no bootstrap; preflight autorizado `204`, credenciais, métodos/cabeçalhos e `Retry-After` cobertos; E2E (3/9), suíte total (17/52), lint, typecheck, build e diff aprovados. |
| T11 | 02 | Concluída | `CsrfProtectionMiddleware` global para mutações, origem própria/allowlist exata e `403 REQUEST_FORBIDDEN`; E2E dirigido (1/8), suíte total (17/52), lint, typecheck, build e diff aprovados. |
| T12 | 02 | Concluída | Controller/DTOs, serialização pública, OpenAPI, CORS/CSRF no bootstrap e E2E de cadastro implementados; E2E dirigido (1/11), suíte total (17/52), integração (2/3), E2E completo (5/28), lint, typecheck, build e diff aprovados. |
| T13 | 03 | Concluída | `npm test -- --runTestsByPath src/modules/auth/infrastructure/security/jsonwebtoken-access-token.service.spec.ts src/shared/infrastructure/configuration.spec.ts` (2 suítes/13 testes), `npm run lint` e `npm run typecheck` aprovados. |
| T14 | 03 | Concluída | `npm test -- --runTestsByPath src/modules/auth/application/authenticate-user/authenticate-user.spec.ts` (1 suíte/7 testes), `npm run lint` e `npm run typecheck` aprovados. |
| T15 | 03 | Concluída | `npm test -- --runTestsByPath src/modules/auth/presentation/auth-cookie.spec.ts` (1 suíte/1 teste), `npm run test:e2e -- --runTestsByPath test/e2e/login.e2e.spec.ts` (1 suíte/3 testes), `npm run lint` e `npm run typecheck` aprovados; primeiro gate E2E ajustado para aceitar `Expires` adicional emitido pelo Express, mantendo os atributos exigidos. |
| T16 | 03 | Concluída | `npm test -- --runTestsByPath src/modules/auth/presentation/auth-cookie.spec.ts` (1 suíte/2 testes), `npm run test:e2e -- --runTestsByPath test/e2e/logout.e2e.spec.ts` (1 suíte/6 testes), `npm run lint` e `npm run typecheck` aprovados. |
| T17 | 03 | Concluída | `npm run test:e2e -- --runTestsByPath test/e2e/access-token-guard.e2e.spec.ts` (1 suíte/6 testes), `npm run lint` e `npm run typecheck` aprovados. |
| T18 | 04 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/domain/product.spec.ts` (1 suíte/24 testes), `npm run lint` e `npm run typecheck` aprovados; invariantes e serialização pública do domínio isoladas do framework. |
| T19 | 04 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/infrastructure/persistence/dynamodb-product.repository.spec.ts` (1 suíte/5 testes), `npm run test:integration -- --runTestsByPath test/integration/products.integration.spec.ts` (1 suíte/3 testes), `npm run lint` e `npm run typecheck` aprovados; condição atômica, mapeamento exato, ausência e colisão sem sobrescrita comprovados. |
| T20 | 04 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/application/create-product/create-product.spec.ts` (1 suíte/3 testes), `npm run test:e2e -- --runTestsByPath test/e2e/create-product.e2e.spec.ts` (1 suíte/10 testes), `npm run lint` e `npm run typecheck` aprovados; `POST /products` protegido, estrito e sem persistência em entradas inválidas. |
| T21 | 04 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/application/get-product/get-product.spec.ts` (1 suíte/3 testes), `npm run test:e2e -- --runTestsByPath test/e2e/get-product.e2e.spec.ts` (1 suíte/6 testes), `npm run lint` e `npm run typecheck` aprovados; `GET /products/:id` retorna catálogo compartilhado ou `404 PRODUCT_NOT_FOUND` e rejeita cookie ausente/inválido/expirado. |
| T22 | 05 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/infrastructure/persistence/dynamodb-cursor-codec.spec.ts` (1 suíte/10 testes), `npm run lint` e `npm run typecheck` aprovados; envelope versionado, Base64 URL-safe, validação estrutural e erro seguro comprovados. |
| T23 | 05 | Em execução | — |
| T23 | 05 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/application/list-products/list-products.spec.ts src/modules/products/infrastructure/persistence/dynamodb-product.repository.spec.ts` (2 suítes/15 testes), `npm run test:integration -- --runTestsByPath test/integration/products.integration.spec.ts` (1 suíte/4 testes), `npm run lint` e `npm run typecheck` aprovados; `Scan`, `Limit`, cursor nativo, padrão 20 e limites 1–100 comprovados. |
| T24 | 05 | Concluída | `npm run test:e2e -- --runTestsByPath test/e2e/list-products.e2e.spec.ts` (1 suíte/11 testes), `npm run lint` e `npm run typecheck` aprovados; `GET /products` cobre catálogo vazio, limite padrão/limites, cursores consecutivos, erros seguros, autenticação e OpenAPI. |
| T25 | 05 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/application/update-product/update-product.spec.ts src/modules/products/domain/product.spec.ts` (2 suítes/37 testes), `npm run lint` e `npm run typecheck` aprovados; patch não vazio e estrito, invariantes reutilizadas, campos omitidos preservados e relógio controlado comprovados. |
| T26 | 05 | Concluída | `npm test -- --runInBand --runTestsByPath src/modules/products/infrastructure/persistence/dynamodb-product.repository.spec.ts src/modules/products/application/update-product/update-product.spec.ts` (2 suítes/21 testes), `npm run test:integration -- --runTestsByPath test/integration/products.integration.spec.ts` (1 suíte/5 testes), `npm run test:e2e -- --runTestsByPath test/e2e/update-product.e2e.spec.ts` (1 suíte/10 testes), `npm run lint` e `npm run typecheck` aprovados; `UpdateItem` condicional, patch estrito, preservação, falha técnica, proteção HTTP, compartilhamento e OpenAPI comprovados. |
| T27 | 05 | Em execução | — |
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

### Preparação da Fase 04

- Padrões: manter o domínio Product sem dependências do NestJS/AWS; casos de
  uso dependem da porta `ProductRepository`; controller e DTO permanecem na
  borda HTTP; serialização pública é explícita.
- Abstrações reutilizadas: `Clock`, `IdentifierGenerator`,
  `DynamoDBDocumentClient`, `ConfigService`, `AccessTokenGuard`, filtro global
  de erros e middleware global de CORS/CSRF já aprovados nas fases anteriores.
- Premissas: catálogo compartilhado não possui `createdBy`; `price` permanece
  número; `imageUrl` contém somente a URL, sem upload ou bytes de imagem; a
  tabela `products` usa chave simples `id`.
- Verificação: cada tarefa terá teste dirigido e evidência no estado; ao final
  serão executados lint, typecheck, suítes unitárias, integração, E2E, build e
  `git diff --check`, seguidos de review independente.
- Conflitos: nenhum encontrado entre PRD, design, plano, ADRs e código atual.

### Preparação da tarefa T18

- Premissas: datas e ID são definidos na criação e não possuem mutadores;
  objetos `Date` serão clonados para impedir mutação externa; não haverá
  arredondamento nem cálculo monetário.
- Abstrações: `Product` e `InvalidProductDataError` pertencem somente ao
  domínio; `PublicProductData` define a saída serializável aprovada.
- Arquivos: `products/domain/product.ts`, erro de domínio e teste unitário.
- Verificação: limites inclusivos de strings e URL, esquemas HTTP/HTTPS,
  valores de preço e isolamento das datas; lint e typecheck.
- Conflitos previstos: representação binária de números decimais não deve ser
  usada como evidência de casas decimais adicionais no contrato numérico.

### Preparação da tarefa T19

- Premissas: a chave primária de `products` é `id`; `PutCommand` usará
  `attribute_not_exists(id)` e `GetCommand` consultará somente essa chave.
- Abstrações: a aplicação conhecerá apenas `ProductRepository`; o adaptador
  converterá explicitamente entre `Product` e o item aprovado do DynamoDB.
- Arquivos: porta e erro de colisão em `products/application`, adaptador e
  testes unitário/integrado da persistência.
- Verificação: item com exatamente os sete campos aprovados, criação/leitura,
  ausência, colisão sem sobrescrita e propagação de falha de infraestrutura.
- Conflitos previstos: detalhes e tipos do SDK não devem atravessar a porta ou
  aparecer em controller/caso de uso.

### Preparação da tarefa T20

- Premissas: `POST /products` é protegido pelo `AccessTokenGuard` e pelo
  middleware global de CSRF/origem; a entrada exige os quatro campos editáveis
  e rejeita propriedades desconhecidas pelo pipe global.
- Abstrações: `CreateProduct` gera ID e datas por `IdGenerator`/`Clock`, valida
  pelo domínio e persiste pela porta; o controller retorna somente
  `PublicProductData`.
- Arquivos: caso de uso e teste unitário, DTO/validator/serializer/controller,
  `ProductsModule`, composição da aplicação e E2E de criação.
- Verificação: sucesso `201`, limites, ausência/nulo/desconhecido, autenticação,
  CSRF/origem, ausência de escrita em falha e contrato OpenAPI.
- Conflitos previstos: a validação HTTP duplica apenas a forma declarativa do
  contrato; a invariável do domínio continua sendo a autoridade final.

### Preparação da tarefa T21

- Premissas: `GET /products/:id` recebe um identificador opaco não vazio,
  consulta diretamente a chave simples e não avalia proprietário.
- Abstrações: `GetProduct` conhece apenas `ProductRepository`; ausência vira
  `ProductNotFoundError` com o código estável `PRODUCT_NOT_FOUND`; o
  controller serializa os mesmos sete campos públicos da criação.
- Arquivos: caso de uso/teste, erro, controller/módulo e E2E de consulta.
- Verificação: existente `200`, ausente `404`, cookies ausente/inválido/expirado,
  duas contas, falha de infraestrutura e OpenAPI.
- Conflitos previstos: o guard continua sendo a única barreira de autenticação;
  não introduzir autorização por recurso nem `createdBy`.

### Encerramento da Fase 02

- Gate: review independente da Fase 02 aprovado na versão 2, registrado em
  `REVIEW.md`.
- Decisão: a Fase 02 foi marcada como `Concluída` após T06–T12 e a Fase 03
  permanece `Pendente`; nenhuma tarefa, preparação ou implementação da Fase 03
  foi iniciada.
- Ressalvas: autenticação por JWT/cookie permanece na Fase 03; rate limit e
  conformidade operacional permanecem na Fase 06; o desvio local do DynamoDB
  segue encaminhado à Fase 07.

### Encerramento da Fase 04

- Gate: review independente da Fase 04 aprovado na versão 4, registrado em
  `REVIEW.md`.
- Decisão: T18–T21 foram marcadas como `Concluídas`; a Fase 04 foi marcada como
  `Concluída` após o domínio Product, persistência, criação e consulta
  passarem os gates completos.
- Evidência final: 24 suítes/104 testes unitários, 3 suítes/6 testes de
  integração e 10 suítes/59 testes E2E passaram, além de lint, typecheck,
  build e `git diff --check`.
- Ressalvas: A-01 permanece restrito ao DynamoDB Local e encaminhado à Fase 07;
  a Fase 05 permanece `Pendente` e não foi iniciada.
