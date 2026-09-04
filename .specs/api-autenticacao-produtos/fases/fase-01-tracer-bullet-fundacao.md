# Fase 01 — Tracer bullet e fundação observável

| Status       | Em execução |
| ------------ | ----------- |
| Created      | 2026-09-03  |
| Last Updated | 2026-09-04  |

**Objetivo e resultado esperado:** disponibilizar a menor fatia executável da solução, do bootstrap NestJS ao DynamoDB Local, demonstrada por um endpoint de readiness com correlação, erros seguros e testes automatizados.

**Capacidade ou fluxo coberto:** iniciar a API com configuração válida, provisionar dados locais isolados, consultar a disponibilidade das tabelas `users` e `products` e responder `GET /health` com `200` ou `503` no contrato público.

**Requisitos relacionados:** `AAP-50`–`AAP-52`, `AAP-58`, `AAP-59`, `EXPECT-02`, `EXPECT-04`, `EXPECT-07`, `EXPECT-08`, `EXPECT-11`.

**Dependências externas:** runtime Node.js LTS, Docker com Compose e imagem do DynamoDB Local disponíveis no ambiente de desenvolvimento.

## Tarefa T01 — Criar o projeto NestJS reproduzível e seus comandos oficiais

| Status | Concluída |
| ------ | --------- |

Estruturar o projeto Node.js/NestJS em TypeScript estrito com `npm`, `package-lock.json`, configuração de compilação, lint e formatação. Registrar os scripts `lint`, `typecheck`, `test`, `test:integration`, `test:e2e` e `build`, além das convenções de pastas por domínio e camada. A configuração obrigatória deve ser tipada e falhar no startup quando ausente ou inválida, sem valores secretos padrão.

- **Requisitos relacionados:** `EXPECT-08`, `EXPECT-10`.
- **Referência ao design:** `DEC-01`, `DEC-18`; seções “Tecnologias e responsabilidades” e “Arquitetura e componentes”.
- **Dependências:** nenhuma.
- **Parte do sistema afetada:** `package.json`, `package-lock.json`, configurações TypeScript/ESLint/Jest/Nest, `src/main.ts`, `src/app.module.ts`, módulo de configuração e `.env.example`.
- **Testes e verificações:** executar `npm ci`, todos os scripts criados e um teste de bootstrap com configuração válida e inválida; confirmar que `.env` e segredos permanecem ignorados.
- **Critérios de conclusão:** instalação reproduzível pelo lockfile; TypeScript estrito ativo; seis scripts oficiais executáveis; aplicação inicia somente com configuração válida; nenhum segredo real versionado.
- **Riscos ou premissas:** não há código anterior a preservar; as versões exatas serão fixadas pelo lockfile e precisam ser compatíveis com a versão LTS escolhida.

### Evidência de execução T01

- `npm ci --ignore-scripts --no-audit --no-fund` — concluído; 477 pacotes
  instalados pelo lockfile.
- `npm run lint` — concluído sem erros.
- `npm run typecheck` — concluído com TypeScript estrito.
- `npm test` — concluído; 1 suíte e 4 testes de configuração aprovados.
- `npm run test:integration` e `npm run test:e2e` — concluídos com código 0 e
  sem testes, pois essas suítes serão criadas nas tarefas posteriores.
- `npm run build` — concluído.
- `node dist/main.js` sem ambiente — falhou como esperado com código 1 e
  mensagem sanitizada de configuração inválida.
- Bootstrap com ambiente válido — processo iniciou e abriu a porta 3010; foi
  encerrado após a verificação.
- `git diff --check` — concluído; apenas avisos de normalização LF/CRLF do
  Git foram emitidos.

## Tarefa T02 — Definir fronteiras transversais de tempo, identidade e camadas

| Status | Concluída |
| ------ | --------- |

Criar as portas de relógio e geração de identificadores criptograficamente seguros, os tipos comuns estritamente necessários e as regras de importação que impeçam domínio e aplicação de dependerem de NestJS, HTTP, AWS SDK ou JWT. Fornecer implementações de produção e substitutos determinísticos para testes.

- **Requisitos relacionados:** `EXPECT-05`, `EXPECT-07`.
- **Referência ao design:** `DEC-01`, `DEC-14`, `DEC-18`.
- **Dependências:** `T01`.
- **Parte do sistema afetada:** `src/shared/domain`, `src/shared/application`, `src/shared/infrastructure` e regras de lint de fronteira.
- **Testes e verificações:** testes unitários das implementações e teste arquitetural/lint que rejeite dependência proibida; IDs de teste e instantes devem ser repetíveis.
- **Critérios de conclusão:** casos de uso podem receber relógio e gerador por porta; implementação real usa fonte criptograficamente segura; teste automatizado protege a direção das dependências.
- **Riscos ou premissas:** abstrações comuns ficam limitadas às fontes realmente compartilhadas; não criar repositório genérico.

### Evidência de execução T02

- `npm run lint` — concluído, incluindo regras de imports proibidos nas
  camadas internas.
- `npm run typecheck` — concluído com TypeScript estrito.
- `npm test` — concluído; 6 suítes e 11 testes aprovados, cobrindo relógio do
  sistema, relógio fixo, gerador seguro, gerador determinístico e fronteiras
  de dependência.
- A implementação de produção usa `node:crypto.randomUUID`; os substitutos
  de teste retornam instantes e IDs configurados de forma repetível.
- `git diff --check` — sem erros.

## Tarefa T03 — Padronizar correlação, erros e logs sanitizados

| Status | Concluída |
| ------ | --------- |

Implementar o contexto de requisição que cria ou propaga um `correlationId` opaco, o catálogo de erros da aplicação e um filtro global que converta falhas esperadas e inesperadas no schema `ApiError`. Erros de validação devem listar apenas campos públicos, e logs estruturados devem registrar método, template da rota, status e duração sem corpos sensíveis, cookies, tokens, hashes ou stack trace na resposta.

- **Requisitos relacionados:** `AAP-50`, `AAP-51`, `AAP-52`, `EXPECT-02`, `EXPECT-04`, `EXPECT-11`.
- **Referência ao design:** `DEC-13`, `DEC-14`; seções “Erro público” e “Segurança, privacidade e observabilidade”.
- **Dependências:** `T01`, `T02`.
- **Parte do sistema afetada:** middleware/interceptor de correlação, hierarquia de erros, filtro global, logger e bootstrap HTTP.
- **Testes e verificações:** testes unitários e HTTP de erro conhecido, validação e falha inesperada; busca negativa por senha, JWT, cookie, hash, stack e detalhes DynamoDB nos corpos e logs capturados.
- **Critérios de conclusão:** todo erro HTTP contém `statusCode`, `code`, `message` e `correlationId`; `errors` só aparece em validação; resposta `500` usa `INTERNAL_ERROR`; logs permitem correlação sem vazar dados proibidos.
- **Riscos ou premissas:** detalhes técnicos podem existir apenas no log interno sanitizado, nunca no contrato público.

### Evidência de execução T03

- `npm run lint` e `npm run typecheck` — concluídos sem erros.
- `npm test` — concluído; 8 suítes e 16 testes unitários aprovados.
- `npm run test:e2e` — concluído; 1 suíte e 3 testes HTTP aprovados para erro
  conhecido, validação e falha inesperada.
- `npm run test:integration` — concluído com código 0; ainda não há casos de
  integração, que serão adicionados no T04.
- `npm run build` — concluído.
- Os E2E confirmaram `statusCode`, `code`, `message` e `correlationId` em
  respostas `409`, `400` e `500`, além da propagação do cabeçalho.
- A busca negativa nos corpos e logs capturados não encontrou senha, token,
  stack trace ou detalhes da exceção; o log contém somente método, rota,
  status, duração, nível e correlação.
- O runner Jest passou a usar ESM para compatibilidade da versão NestJS fixada;
  o TypeScript de produção continua compilado em CommonJS e o build passou.
- `git diff --check` — sem erros.

## Tarefa T04 — Disponibilizar DynamoDB Local e provisionamento isolado

| Status | Concluída |
| ------ | --------- |

Criar o serviço DynamoDB Local no Compose e scripts idempotentes para provisionar as tabelas `users` e `products` com chave de partição simples e capacidade compatível com o ambiente local. Configurar o `DynamoDBDocumentClient` por injeção e garantir tabelas ou prefixos exclusivos para testes de integração e E2E.

- **Requisitos relacionados:** `AAP-58`, `AAP-59`, `EXPECT-07`, `EXPECT-08`.
- **Referência ao design:** `DEC-06`, `DEC-07`, `DEC-18`; seção “Modelo e alterações de dados”.
- **Dependências:** `T01`.
- **Parte do sistema afetada:** `compose.yaml`, configuração DynamoDB, adaptador compartilhado de cliente, scripts de provisionamento e infraestrutura de testes.
- **Testes e verificações:** `docker compose config`; subir DynamoDB Local; executar provisionamento duas vezes sem erro; testar isolamento e `DescribeTable` das duas tabelas.
- **Critérios de conclusão:** ambiente local sobe sem credenciais reais; provisionamento é idempotente; testes nunca usam tabelas publicadas; ambas as tabelas possuem somente as chaves aprovadas.
- **Riscos ou premissas:** dados locais podem persistir para desenvolvimento, mas cada execução automatizada deve limpar ou isolar seu próprio namespace.

### Evidência de execução T04

- `docker compose config` — concluído com `amazon/dynamodb-local:2.6.1`,
  volume nomeado e credenciais dummy.
- `docker compose up -d --force-recreate dynamodb-local` — concluído; o
  container ficou `Up` e a porta 8000 aceitou conexão TCP.
- `npm run db:provision` — executado duas vezes; ambas criaram/verificaram
  `stone_users` e `stone_products` sem erro.
- `npm run test:integration` com DynamoDB Local — concluído; 1 suíte e 1 teste
  criaram tabelas com prefixo isolado do processo, conferiram `DescribeTable`,
  chave simples `email`/`id`, atributo `S` e status `ACTIVE`, e removeram
  somente as tabelas temporárias.
- `npm run lint`, `npm run typecheck`, `npm test` (9 suítes/19 testes),
  `npm run test:e2e` (1 suíte/3 testes) e `npm run build` — concluídos.
- Bootstrap com `DynamoDbModule` injetado — processo iniciou e abriu a porta
  3011 com prefixo de tabelas `bootstrap`.
- Desvio registrado: o volume novo da imagem inicia como `root:root`, enquanto
  a imagem roda como UID 1000; o serviço local usa `user: "0:0"` exclusivamente
  para permitir o volume persistente. A exigência de container sem privilégios
  da aplicação publicada permanece na Fase 07.
- `git diff --check` — sem erros.

## Tarefa T05 — Entregar readiness ponta a ponta

| Status | Concluída |
| ------ | --------- |

Implementar o módulo Health e `GET /health` público. O caso de uso deve confirmar a inicialização e o acesso às duas tabelas; sucesso retorna exatamente `200 { "status": "ok" }`, enquanto indisponibilidade de qualquer dependência retorna `503 SERVICE_UNAVAILABLE` no schema padrão sem indicar qual tabela falhou.

- **Requisitos relacionados:** `AAP-50`, `AAP-58`, `AAP-59`, `EXPECT-04`, `EXPECT-07`, `EXPECT-11`.
- **Referência ao design:** `DEC-17`, contrato `GET /health`.
- **Dependências:** `T03`, `T04`.
- **Parte do sistema afetada:** módulo/controller/caso de uso Health, porta de readiness DynamoDB e testes HTTP.
- **Testes e verificações:** E2E com as duas tabelas acessíveis, cada tabela ausente ou inacessível e falha inesperada; confirmar ausência de autenticação e ausência de detalhes internos.
- **Critérios de conclusão:** o fluxo real API → porta → DynamoDB Local responde `200`; qualquer dependência necessária indisponível produz `503` seguro e correlacionado; testes são determinísticos.
- **Riscos ou premissas:** esta rota ainda receberá a política de rate limit na Fase 06; liveness permanece responsabilidade do processo/container.

### Evidência de execução T05

- `npm run lint` e `npm run typecheck` — concluídos sem erros.
- `npm test` — concluído; 12 suítes e 24 testes unitários aprovados.
- `npm run test:integration` — concluído com DynamoDB Local; 1 suíte e 1 teste
  de persistência isolada aprovado.
- `npm run test:e2e` — concluído; 2 suítes e 6 testes HTTP aprovados. O fluxo
  real confirmou `200` com corpo exatamente `{ "status": "ok" }`, sem cookie ou
  autenticação, e `503 SERVICE_UNAVAILABLE` seguro para ausência de `users` e
  ausência de `products`.
- O teste de falha inesperada do caso de uso converteu o erro em
  `ServiceUnavailableError` sem transportar o detalhe interno.
- Os logs E2E registraram status `200` no sucesso e `503` nas falhas, com rota,
  duração e correlação, sem nomes de tabelas ou mensagens do SDK.
- `npm run build` e `docker compose config` — concluídos.
- `git diff --check` — sem erros.

## Orientações de implementação

- Manter `domain`, `application`, `infrastructure` e `presentation` explícitos quando aplicável; não antecipar abstrações de `auth` ou `products` nesta fase.
- Fazer CORS/preflight terminar antes do rate limiter quando esses componentes forem adicionados posteriormente.
- O tracer bullet deve usar o mesmo filtro de erro, cliente DynamoDB e composition root que as rotas seguintes reutilizarão.

## Testes e verificações da fase

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
docker compose config
```

Executar também o provisionamento local duas vezes e capturar evidências de `/health` pronto e indisponível.

## Critérios de aceitação da fase

1. Um checkout limpo instala dependências pelo lockfile e executa todos os comandos oficiais.
2. A aplicação respeita TypeScript estrito e as fronteiras da Clean Architecture.
3. O DynamoDB Local fornece tabelas isoladas e idempotentes.
4. `/health` comprova o caminho ponta a ponta e responde exatamente conforme o contrato em sucesso e falha.
5. Erros e logs possuem correlação e não expõem dados sensíveis ou detalhes internos.

## Riscos, premissas e dependências externas da fase

- A imagem do DynamoDB Local é uma dependência externa; fixar sua versão no Compose.
- Se a versão LTS corrente do Node.js não for suportada pela versão NestJS escolhida, usar a LTS suportada e registrar a combinação no README e lockfile.
- A fase não configura infraestrutura AWS publicada; apenas cria a fronteira que a Fase 07 reutilizará.
