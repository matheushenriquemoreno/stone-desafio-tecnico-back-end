# Review — API de cadastro, autenticação e catálogo de produtos

| Status       | Aprovado |
| ------------ | -------- |
| Created      | 2026-09-04 |
| Last Updated | 2026-09-04 |

**Escopo revisado:** fase 04 — Criação e consulta de produtos
**Versão da avaliação:** 4

## Artefatos analisados

- PRD: [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md) | Design técnico: [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md)
- Plano: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)
- Fase: [fases/fase-04-criacao-consulta-produtos.md](fases/fase-04-criacao-consulta-produtos.md)
- Estado: [fases/IMPLEMENTATION-STATE.md](fases/IMPLEMENTATION-STATE.md)
- Convenções: `rules/README.md`, `rules/principios-de-design.md`, `rules/codigo-como-um-livro.md` e `rules/checklist-de-implementacao.md`
- Decisões reutilizadas: [ADR-001](../../docs/adr/ADR-001-clean-architecture-backend.md), [ADR-003](../../docs/adr/ADR-003-modelagem-dynamodb.md), [ADR-004](../../docs/adr/ADR-004-rate-limit.md) e [ADR-005](../../docs/adr/ADR-005-autenticacao-cookie-http-only.md)

## Resumo executivo

A Fase 04 foi revisada contra os artefatos aprovados, as regras do repositório,
as ADRs aplicáveis, a implementação e as evidências versionadas de T18–T21. A
entrega implementa o domínio `Product`, persistência atômica em DynamoDB,
`POST /products` e `GET /products/:id`, com validação estrita, serialização
pública, cookie JWT, CSRF/origem e catálogo compartilhado entre contas.

Os gates oficiais passaram sem achados bloqueadores ou altos. A ressalva A-02
do review anterior foi resolvida: as rotas concretas de Products usam o guard e
o E2E cobre cookie ausente, inválido e expirado. O desvio A-01, restrito ao
DynamoDB Local, permanece informativo e encaminhado à Fase 07.

## Resultado das verificações obrigatórias

| Verificação | Resultado | Evidência |
| ------------ | --------- | --------- |
| Requisitos | Atendida no recorte da fase | T18–T21 cobrem `AAP-25`–`AAP-30`, `AAP-38`, `AAP-46`, `AAP-49`–`AAP-52` e `EXPECT-02`, `EXPECT-04`, `EXPECT-06`–`EXPECT-08`. |
| Critérios de aceitação | Atendida | Criação `201`, validação sem escrita, consulta `200`, ausência `404`, duas contas, autenticação, CSRF e OpenAPI foram exercitados. |
| Testes | Atendida | 24 suítes/104 testes unitários, 3 suítes/6 testes de integração e 10 suítes/59 testes E2E passaram. |
| Design técnico | Atendida | Domínio e aplicação não dependem de NestJS/AWS; porta de produtos, `PutItem` condicional, `GetItem`, cookie e guard seguem `DEC-01`, `DEC-03`, `DEC-05`, `DEC-06`, `DEC-10`, `DEC-13`–`DEC-15`. |
| Plano | Atendida | T18–T21 estão concluídas, cada uma com commit e evidência no estado e no arquivo da fase. |
| Escopo | Atendida | Não foram introduzidos proprietário, upload, bytes de imagem, cálculo monetário, paginação, atualização, exclusão ou rate limit antecipado. |
| Qualidade | Atendida | Lint, typecheck e build passaram. |
| Padrões do projeto | Atendida | Controllers traduzem HTTP; casos de uso dependem de portas; o mapeamento SDK fica na infraestrutura; o serializer público expõe somente os sete campos aprovados. |
| Manutenibilidade | Atendida | Invariantes de produto são reutilizáveis; `ProductRepository` isola persistência; criação e consulta compartilham módulo e proteção. |
| Riscos | Atendida com risco residual informativo | A-01 do DynamoDB Local permanece encaminhado à Fase 07; não há risco aberto específico da Fase 04. |

## Matriz de rastreabilidade

| Requisito | Código | Teste | Evidência | Status |
| --------- | ------ | ----- | --------- | ------ |
| `AAP-25` | `products/application/create-product/create-product.ts`, `create-product.dto.ts` | `create-product.spec.ts`, `create-product.e2e.spec.ts` | Os quatro campos editáveis são exigidos antes da persistência. | Comprovado |
| `AAP-26`–`AAP-29` | `products/domain/product.ts`, `create-product.dto.ts`, `price-decimal.validator.ts` | `product.spec.ts`, `create-product.e2e.spec.ts` | Limites de nome, descrição, URL HTTP(S), preço positivo e duas casas decimais são validados no domínio e na entrada HTTP. | Comprovado |
| `AAP-30` | `product.ts`, `product.response.dto.ts`, `products.controller.ts` | testes unitários, integração e E2E | Resposta e item persistido contêm exatamente `id`, `name`, `description`, `price`, `imageUrl`, `createdAt` e `updatedAt`, com datas UTC ISO. | Comprovado |
| `AAP-38` | `products/infrastructure/persistence/dynamodb-product.repository.ts` | `dynamodb-product.repository.spec.ts`, `products.integration.spec.ts`, `get-product.e2e.spec.ts` | Consulta usa `GetCommand` pela chave simples `id`, com leitura consistente. | Comprovado |
| `AAP-46` | `products/application/errors/product-not-found.error.ts`, `get-product.ts` | `get-product.spec.ts`, `get-product.e2e.spec.ts` | Ausência é mapeada para `404 PRODUCT_NOT_FOUND` com mensagem estável. | Comprovado |
| `AAP-49` | `products/presentation/products.controller.ts`, `auth/presentation/access-token.guard.ts` | `create-product.e2e.spec.ts`, `get-product.e2e.spec.ts` | As rotas são protegidas pelo cookie JWT; a segunda conta consulta produto sem filtro de proprietário. | Comprovado |
| `AAP-50`–`AAP-52` | `PublicValidationPipe`, `ApiExceptionFilter`, DTOs Products | E2E Products e gates globais | Erros preservam schema/correlação; campos desconhecidos, nulos e limites inválidos retornam `VALIDATION_ERROR`; nenhuma resposta contém token. | Comprovado |
| `EXPECT-02`, `EXPECT-04` | `products.controller.ts`, `products.module.ts` | E2E Products | API direta, cookie e guard são usados nas rotas reais; não há BFF, sessão ou dado de proprietário. | Comprovado |
| `EXPECT-06` | decorators Products, `setup-openapi.ts` | OpenAPI nos E2E de criação e consulta | `/docs-json` descreve respostas, cookie e cabeçalho CSRF no contrato correspondente. | Comprovado |
| `EXPECT-07`–`EXPECT-08` | `ProductRepository`, `DynamoDbProductRepository`, `ProductsModule` | unitário, integração, E2E e gates completos | Dependências externas são injetadas; integração confirma DynamoDB Local, condição atômica e ausência sem sobrescrita. | Comprovado |

## Critérios de aceitação da fase

| Critério | Evidência | Status |
| -------- | --------- | ------ |
| Produto válido é criado com os sete campos públicos e `201`. | `create-product.e2e.spec.ts` valida corpo completo, datas ISO e item DynamoDB. | Atendido |
| Cada campo inválido gera `400 VALIDATION_ERROR` sem persistência parcial. | Casos E2E cobrem limite inválido, preço, esquema de URL, ausência, nulo e campo desconhecido; `Scan` confirma catálogo vazio. | Atendido |
| Produto existente é consultado com `200`; ausente produz `404 PRODUCT_NOT_FOUND`. | `get-product.e2e.spec.ts` cobre os dois fluxos e a mensagem/código estáveis. | Atendido |
| Qualquer pessoa autenticada consulta produto criado por outra conta. | E2E cria com `creator@example.com` e consulta com `reader@example.com`; o retorno é completo. | Atendido |
| Guard, CSRF, erros, OpenAPI e logs permanecem alinhados ao contrato. | E2E testa cookie/CSRF/OpenAPI; logs exibem somente metadados e códigos, sem token ou segredo. | Atendido |

## Resultado dos gates executados

| Comando | Resultado |
| ------- | --------- |
| `npm ci` | Passou; 580 pacotes instalados, 0 vulnerabilidades reportadas |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test -- --runInBand` | 24 suítes e 104 testes passaram |
| `npm run test:integration` | 3 suítes e 6 testes passaram |
| `npm run test:e2e` | 10 suítes e 59 testes passaram |
| `npm run build` | Passou |
| `git diff --check` | Passou |

## Achados

| ID | Severidade | Achado | Evidência | Impacto | Recomendação | Encaminhamento |
| -- | ---------- | ------ | --------- | ------- | ------------ | ------------ |
| A-01 | Informativo | O DynamoDB Local continua executando como `root` para compatibilizar o volume nomeado. | Desvio T04 no estado da implementação e reviews anteriores. | Limitação somente do auxiliar local; não altera a aplicação publicada nem os contratos desta fase. | Reavaliar no endurecimento da infraestrutura da Fase 07. | `implement` — acompanhar na Fase 07. |

Não foram identificados achados bloqueadores, altos ou médios na Fase 04.

## Riscos residuais e ressalvas aceitas

- O rate limit permanece deliberadamente na Fase 06, conforme a ADR-004.
- A tabela de produtos ainda será expandida nas fases seguintes para paginação,
  atualização e exclusão; este review não antecipa esses contratos.
- A-01 permanece limitado ao ambiente auxiliar local e não é evidência contra a
  política de execução da imagem da API.

## Veredito

**Veredito:** Aprovado
**Fundamentação:** T18–T21, os critérios de aceitação da Fase 04 e os
requisitos atribuídos a esta etapa possuem implementação e evidência objetiva.
Os gates oficiais passaram; o guard foi confirmado nas rotas reais de Products,
o catálogo compartilhado foi comprovado e somente A-01, já conhecido, permanece
como ressalva informativa encaminhada para a Fase 07.

## Próxima ação

Marcar a Fase 04 como `Concluída` e manter a Fase 05 como `Pendente`, conforme a
regra de execução faseada.

## Histórico de revisões anteriores

| Versão | Data | Escopo | Veredito | Resumo |
| ------ | ---- | ------ | -------- | ------ |
| 3 | 2026-09-04 | Fase 03 — Autenticação e proteção do cliente web | Aprovado | JWT HS256, cookie, login, logout e guard passaram os gates; aplicação em Products ficou encaminhada para a Fase 04. |
| 2 | 2026-09-04 | Fase 02 — Cadastro seguro de usuários | Aprovado | Cadastro, Argon2id, persistência condicional, CORS/CSRF e OpenAPI passaram os gates. |
| 1 | 2026-09-04 | Fase 01 — Tracer bullet e fundação observável | Aprovado | Bootstrap, fronteiras, erros/correlação, DynamoDB Local e readiness passaram os gates; A-01 registrou o usuário `root` somente no DynamoDB Local. |
