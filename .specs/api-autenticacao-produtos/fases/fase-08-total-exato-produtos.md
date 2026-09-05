# Fase 08 — Total exato na listagem de produtos

| Status       | Em execução |
|--------------|-------------|
| Created      | 2026-09-05  |
| Last Updated | 2026-09-05  |

**Objetivo e resultado esperado:** incluir em toda resposta bem-sucedida de `GET /products` o campo obrigatório `total`, com a quantidade exata de produtos do catálogo, preservando a paginação por cursor.

**Capacidade ou fluxo coberto:** cursor validado → página e contagem completa no DynamoDB → resposta `{ items, total, nextCursor? }`.

**Requisitos relacionados:** `AAP-31`–`AAP-37`, `AAP-50`, `AAP-56`, `AAP-57`, `AAP-61`, `EXPECT-06`–`EXPECT-08`.

**Dependências externas:** DynamoDB Local e capacidades da Fase 05 já concluídas.

## Tarefa T37 — Calcular e propagar o total exato do catálogo

Ampliar `ProductPage` com `total` obrigatório e ajustar o adaptador DynamoDB para validar o cursor antes de qualquer leitura. Depois da validação, executar em paralelo o `Scan` da página e uma contagem consistente com `Select=COUNT`; a contagem deve seguir cada `LastEvaluatedKey` interno e somar os valores de `Count` até esgotar a tabela. Qualquer falha deve impedir a devolução de uma página parcial.

- **Requisitos relacionados:** `AAP-31`–`AAP-37`, `AAP-50`, `AAP-61`, `EXPECT-07`, `EXPECT-08`.
- **Referência ao design:** `DEC-08`, `DEC-09`, `DEC-21`; seção “Fluxo de dados e integrações”; [ADR-003](../../../docs/adr/ADR-003-modelagem-dynamodb.md).
- **Dependências:** `T23`.
- **Parte do sistema afetada:** porta e caso de uso de produtos, adaptador DynamoDB, testes unitários e integração.
- **Testes e verificações:** propagação do total; zero; múltiplas páginas internas da contagem; comandos com `Select=COUNT` e `ConsistentRead=true`; falha de contagem; cursor inválido sem I/O; mesmo total em páginas distintas; atualização após criar e excluir.
- **Critérios de conclusão:** `ProductPage.total` é obrigatório; a contagem percorre a tabela inteira; página e contagem começam apenas após cursor válido; falha técnica não retorna resultado parcial; testes dirigidos, lint e typecheck passam.
- **Riscos ou premissas:** o catálogo é pequeno; leitura consistente não cria snapshot transacional entre páginas internas; não adicionar cache, estimativa, contador persistido ou tabela auxiliar.

## Tarefa T38 — Publicar e comprovar o novo contrato HTTP

Expor `total` na representação pública e no DTO OpenAPI da página, mantendo `nextCursor` omitido quando não houver continuação. Atualizar testes E2E, OpenAPI, matriz de conformidade e exemplos documentais para provar zero no catálogo vazio e o mesmo total global em páginas diferentes.

- **Requisitos relacionados:** `AAP-31`–`AAP-37`, `AAP-50`, `AAP-56`, `AAP-57`, `AAP-61`, `EXPECT-06`–`EXPECT-08`.
- **Referência ao design:** `DEC-13`, `DEC-18`, `DEC-21`; contrato `GET /products`.
- **Dependências:** `T24`, `T32`, `T33`, `T37`.
- **Parte do sistema afetada:** DTO e controller de produtos, OpenAPI, E2E de listagem, matriz de conformidade e documentação pública.
- **Testes e verificações:** catálogo vazio retorna `{ items: [], total: 0 }`; catálogo com 21 produtos retorna `total: 21` na primeira e na última página; OpenAPI exige inteiro não negativo; autenticação, limites e cursor permanecem inalterados; gates completos do projeto.
- **Critérios de conclusão:** toda resposta `200` contém `total`; OpenAPI e contrato descrevem o mesmo schema; matriz cobre o critério 28; lint, typecheck, suítes unitária, integração e E2E, build e `git diff --check` passam.
- **Riscos ou premissas:** ordem dos campos JSON não é contrato; falhas do DynamoDB seguem o erro padrão `500 INTERNAL_ERROR`.

## Orientações de implementação

- Manter a contagem dentro do adaptador de persistência e o caso de uso independente do DynamoDB.
- Decodificar o cursor uma única vez antes de iniciar as duas leituras.
- Implementar a repetição da contagem com fluxo explícito e sem recursão ou abstração genérica.
- Preservar autenticação, rate limit, limites 1–100 e semântica de `nextCursor`.

## Testes e verificações da fase

Executar testes dirigidos da aplicação, persistência, integração, listagem E2E e OpenAPI. Em seguida, executar `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run build` e `git diff --check`.

## Critérios de aceitação da fase

1. Catálogo vazio retorna `total: 0` e omite `nextCursor`.
2. Toda página de um catálogo estável retorna o mesmo total global, independentemente de `limit` e cursor.
3. A contagem percorre todas as páginas internas do DynamoDB com leitura consistente.
4. Cursor inválido falha antes de qualquer leitura e não expõe conteúdo interno.
5. Falha em qualquer leitura da contagem impede resposta parcial.
6. OpenAPI, contrato e matriz de conformidade refletem o campo obrigatório.

## Riscos, premissas e dependências externas da fase

- O custo e a latência da contagem crescem com o catálogo; escalar exige nova decisão arquitetural.
- Mutações concorrentes podem produzir diferença momentânea porque `Scan` não oferece snapshot transacional entre páginas internas.
- DynamoDB Local deve estar disponível para integração e E2E.
