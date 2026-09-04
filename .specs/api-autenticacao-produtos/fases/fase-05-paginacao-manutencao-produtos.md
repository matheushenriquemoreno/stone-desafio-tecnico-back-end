# Fase 05 — Paginação, atualização e exclusão de produtos

| Status       | Pendente   |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-03 |

**Objetivo e resultado esperado:** completar o catálogo compartilhado com listagem sequencial por cursor, atualização parcial estrita e exclusão condicional, preservando autorização e contratos de erro.

**Capacidade ou fluxo coberto:** `GET /products`, `PATCH /products/:id` e `DELETE /products/:id` do HTTP ao DynamoDB Local.

**Requisitos relacionados:** `AAP-18`–`AAP-22`, `AAP-30`–`AAP-37`, `AAP-39`–`AAP-50`, `EXPECT-02`, `EXPECT-04`–`EXPECT-08`.

**Dependências externas:** DynamoDB Local e capacidades de autenticação/cadastro já concluídas.

## Tarefa T22 — Implementar codec versionado de cursor opaco

Criar um codec que transforme o `LastEvaluatedKey` em envelope JSON versionado e Base64 URL-safe, e realize a operação inversa após validar tamanho, versão, estrutura e tipos. Qualquer entrada inválida deve produzir `VALIDATION_ERROR` sem retornar conteúdo decodificado ou detalhe interno.

- **Requisitos relacionados:** `AAP-32`, `AAP-37`, `AAP-50`, `AAP-52`, `EXPECT-02`, `EXPECT-04`, `EXPECT-07`.
- **Referência ao design:** `DEC-08`, `DEC-09`; seção “Cursor”.
- **Dependências:** `T03`.
- **Parte do sistema afetada:** aplicação/infraestrutura Products, codec e testes unitários.
- **Testes e verificações:** ida e volta; Base64 inválido; JSON inválido; versão/tipos/chave/tamanho inválidos; cursor adulterado; busca negativa por payload interno nas mensagens e logs públicos.
- **Critérios de conclusão:** cursor válido reproduz somente a chave esperada; saída é URL-safe; toda falha é segura e determinística; não há promessa de criptografia ou assinatura.
- **Riscos ou premissas:** o cursor não contém dado pessoal nem amplia acesso; não adicionar assinatura fora do design aprovado.

## Tarefa T23 — Listar produtos pelo padrão nativo do DynamoDB

Ampliar `ProductRepository` e implementar `ListProducts` usando `Scan`, `Limit` e `ExclusiveStartKey`. O caso de uso adota limite padrão 20, aceita inteiro de 1 a 100 e devolve `nextCursor` somente quando o DynamoDB fornecer `LastEvaluatedKey`.

- **Requisitos relacionados:** `AAP-31`–`AAP-37`, `EXPECT-07`.
- **Referência ao design:** `DEC-08`, `DEC-09`; fluxo de listagem.
- **Dependências:** `T19`, `T22`.
- **Parte do sistema afetada:** porta/adaptador de produtos, caso de uso de listagem e testes unitários/de integração.
- **Testes e verificações:** catálogo vazio, uma página, múltiplas páginas, página final, limites 1/100, padrão 20, cursor válido/inválido e ausência de ordenação assumida; integração com DynamoDB Local.
- **Critérios de conclusão:** navegação usa exclusivamente a chave nativa; itens não repetem nem saltam no conjunto estável de teste; `nextCursor` é omitido no final; não existe `offset` ou número de página.
- **Riscos ou premissas:** `Scan` não garante ordem global e pode consumir capacidade proporcional ao volume, limitação aceita para catálogo pequeno.

## Tarefa T24 — Expor GET /products com query estrita

Criar DTO/query, controller e OpenAPI da listagem protegida. Converter `limit` somente quando representar inteiro válido, aplicar padrão 20 quando ausente e rejeitar valor fora de 1–100 ou cursor inválido com `400 VALIDATION_ERROR`.

- **Requisitos relacionados:** `AAP-18`, `AAP-19`, `AAP-31`–`AAP-37`, `AAP-50`–`AAP-52`, `EXPECT-05`–`EXPECT-08`.
- **Referência ao design:** `DEC-03`, `DEC-08`, `DEC-09`, `DEC-13`; contrato `GET /products`.
- **Dependências:** `T17`, `T23`.
- **Parte do sistema afetada:** DTO/controller/serializer Products, OpenAPI e testes E2E.
- **Testes e verificações:** vazio, padrão, limites, número fracionário/string inválida, cursor, páginas consecutivas e autenticação; conferir omissão real de `nextCursor`, não `null`.
- **Critérios de conclusão:** critérios 12–15 do PRD passam; resposta é `{ items, nextCursor? }`; OpenAPI reflete query, cookie, paginação e erros.
- **Riscos ou premissas:** testes não devem pressupor ordenação não contratada; dados de fixture podem usar conjunto estável apenas para verificar continuidade.

## Tarefa T25 — Modelar atualização parcial sem decisão oculta

Implementar `UpdateProduct` e a representação de patch que aceite somente os quatro campos editáveis, exija ao menos um, rejeite `null` e propriedades desconhecidas, reutilize as invariantes de criação apenas nos campos recebidos e preserve os omitidos.

- **Requisitos relacionados:** `AAP-39`–`AAP-44`, `AAP-49`, `EXPECT-07`.
- **Referência ao design:** `DEC-15`, `DEC-16`; fluxo de atualização.
- **Dependências:** `T18`, `T19`.
- **Parte do sistema afetada:** domínio/aplicação Products, DTO interno de patch e testes unitários.
- **Testes e verificações:** cada campo isolado, combinações, corpo vazio, `null`, desconhecido e limites inválidos; garantir que `createdAt` e omitidos permanecem iguais e `updatedAt` usa relógio controlado.
- **Critérios de conclusão:** um patch não vazio e válido produz mudança somente nos campos recebidos; todos os outros casos falham antes da persistência; last-write-wins permanece explícito.
- **Riscos ou premissas:** não adicionar versão, ETag ou controle de concorrência otimista.

## Tarefa T26 — Persistir e expor PATCH condicional

Implementar `UpdateItem` dinâmico com condição `attribute_exists(id)` e retorno do produto atualizado, mapear ausência para `PRODUCT_NOT_FOUND` e expor `PATCH /products/:id` com cookie, CSRF/origem, validação estrita, OpenAPI e E2E de catálogo compartilhado.

- **Requisitos relacionados:** `AAP-18`–`AAP-22`, `AAP-30`, `AAP-39`–`AAP-44`, `AAP-47`, `AAP-49`–`AAP-52`, `EXPECT-02`, `EXPECT-04`–`EXPECT-08`.
- **Referência ao design:** `DEC-05`, `DEC-10`, `DEC-13`, `DEC-16`; contrato `PATCH /products/:id`.
- **Dependências:** `T11`, `T17`, `T25`.
- **Parte do sistema afetada:** adaptador DynamoDB, controller/DTO/serializer, OpenAPI e testes de integração/E2E.
- **Testes e verificações:** persistência de cada combinação válida; vazio/nulo/desconhecido/inválido; ID ausente; duas contas; falha técnica; confirmar ausência de alteração nos erros.
- **Critérios de conclusão:** critérios 17, 18, 20 e 21 do PRD passam para atualização; ausência usa `404 PRODUCT_NOT_FOUND`; resposta completa preserva campos omitidos.
- **Riscos ou premissas:** construir expressões somente com nomes/valores internos seguros; nunca interpolar propriedade desconhecida.

## Tarefa T27 — Excluir produto de forma condicional e idempotência não presumida

Implementar `DeleteProduct` por `DeleteItem` condicionado à existência e expor `DELETE /products/:id`. Sucesso retorna `204` sem corpo e sem exigir `Content-Type`; ID inexistente retorna `404 PRODUCT_NOT_FOUND`. A rota exige cookie e CSRF/origem, e qualquer usuário autenticado pode excluir qualquer produto.

- **Requisitos relacionados:** `AAP-18`–`AAP-22`, `AAP-45`, `AAP-48`, `AAP-49`, `AAP-50`, `EXPECT-02`, `EXPECT-04`–`EXPECT-08`.
- **Referência ao design:** `DEC-05`, `DEC-10`, `DEC-13`; contrato `DELETE /products/:id`.
- **Dependências:** `T11`, `T17`, `T19`.
- **Parte do sistema afetada:** caso de uso, adaptador DynamoDB, controller, OpenAPI e testes de integração/E2E.
- **Testes e verificações:** excluir existente, repetir exclusão, duas contas, ausência de `Content-Type`, CSRF/origem, cookie e falha técnica; confirmar corpo vazio no sucesso.
- **Critérios de conclusão:** critérios 19–21 do PRD passam para exclusão; condição evita falso sucesso; contrato `204` não inclui corpo.
- **Riscos ou premissas:** exclusão não foi definida como idempotente no PRD; segunda tentativa deve informar recurso ausente.

## Orientações de implementação

- Manter codec de cursor fora do controller e o `LastEvaluatedKey` fora do domínio.
- Construir atualização dinâmica apenas a partir da lista fechada de campos editáveis.
- Não introduzir ordenação, filtros, pesquisa, paginação reversa ou propriedade por usuário.

## Testes e verificações da fase

Executar a validação padrão e um E2E com múltiplas páginas e duas contas cobrindo listar, avançar por cursor, atualizar e excluir. Executar integração real das três operações com DynamoDB Local e relógio/IDs controlados.

## Critérios de aceitação da fase

1. Listagem vazia e paginada obedece limites, cursor e omissão de `nextCursor`.
2. Cursor inválido não expõe sua estrutura interna.
3. PATCH modifica somente campos presentes e rejeita corpos vazios, nulos ou desconhecidos.
4. DELETE retorna `204` apenas quando remove produto existente.
5. Consulta, atualização e exclusão ausentes retornam o mesmo `PRODUCT_NOT_FOUND` aprovado.
6. As três capacidades permanecem compartilhadas entre usuários autenticados.

## Riscos, premissas e dependências externas da fase

- Fixtures não podem transformar uma ordem incidental do `Scan` em contrato.
- Alterações concorrentes permanecem last-write-wins por decisão aprovada.
- A política de rate limit será conectada na fase seguinte a todas as rotas já existentes.

