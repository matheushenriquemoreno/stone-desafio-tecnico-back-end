# Fase 04 — Criação e consulta de produtos

| Status       | Em execução |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-04 |

**Objetivo e resultado esperado:** permitir que qualquer pessoa autenticada crie e consulte produtos completos do catálogo compartilhado com validações consistentes e persistência atômica.

**Capacidade ou fluxo coberto:** domínio Product, `PutItem`/`GetItem`, `POST /products` e `GET /products/:id`, protegidos pelo cookie e pela política CSRF quando aplicável.

**Requisitos relacionados:** `AAP-18`–`AAP-22`, `AAP-25`–`AAP-30`, `AAP-38`, `AAP-46`, `AAP-49`–`AAP-52`, `EXPECT-02`, `EXPECT-04`, `EXPECT-06`–`EXPECT-08`.

**Dependências externas:** DynamoDB Local estabelecido na Fase 01.

## Tarefa T18 — Modelar produto e validar seus quatro campos

Criar entidade/objeto de domínio Product com identificador e datas imutáveis na criação e invariantes reutilizáveis para nome de 2 a 100 caracteres, descrição de 1 a 500, preço maior que zero com até duas casas decimais e `imageUrl` HTTP(S) de até 2.048 caracteres. O domínio recebe apenas a URL, nunca arquivo ou bytes de imagem.

- **Requisitos relacionados:** `AAP-25`–`AAP-30`, `AAP-44`.
- **Referência ao design:** `DEC-01`, `DEC-14`, `DEC-15`; seção “Tabela products”.
- **Dependências:** `T02`.
- **Parte do sistema afetada:** `src/products/domain`, erros e testes unitários.
- **Testes e verificações:** casos-limite inclusivos de cada string; URL `http`/`https` válida e outros esquemas; preço zero, negativo, fracionário válido e mais de duas casas; datas/ID determinísticos.
- **Critérios de conclusão:** todas as invariantes existem fora do framework; representação pública preserva o número aprovado sem cálculo monetário; nenhuma lógica de upload é criada.
- **Riscos ou premissas:** a validação de casas decimais precisa evitar conclusões incorretas por representação binária sem alterar o contrato numérico.

## Tarefa T19 — Persistir criação e consulta de produto

Definir a porta específica `ProductRepository` e implementar criação por `PutItem` condicional e consulta por `GetItem`. Mapear itens entre domínio e DynamoDB sem vazar tipos do SDK; a condição de criação protege contra colisão de ID e a ausência em consulta produz resultado de não encontrado.

- **Requisitos relacionados:** `AAP-25`, `AAP-30`, `AAP-38`, `AAP-46`, `EXPECT-07`.
- **Referência ao design:** `DEC-06`, `DEC-10`; padrões de acesso da tabela `products`.
- **Dependências:** `T04`, `T18`.
- **Parte do sistema afetada:** porta de produtos, mapeador, adaptador DynamoDB e testes de integração.
- **Testes e verificações:** criar, consultar, consultar ausente, colisão de ID e falha DynamoDB real no ambiente local; comparar todos os campos e tipos persistidos.
- **Critérios de conclusão:** criação é atômica; consulta usa chave simples; item contém exatamente campos aprovados; detalhes do AWS SDK ficam na infraestrutura.
- **Riscos ou premissas:** uma colisão criptograficamente improvável deve ser tratada de modo seguro, sem substituir silenciosamente produto existente.

## Tarefa T20 — Entregar POST /products protegido

Implementar `CreateProduct` e o contrato HTTP de criação. O caso de uso gera ID e datas, valida no domínio e persiste; o controller exige cookie e CSRF/origem, rejeita propriedades desconhecidas e retorna `201` com o produto público completo.

- **Requisitos relacionados:** `AAP-18`–`AAP-22`, `AAP-25`–`AAP-30`, `AAP-50`–`AAP-52`, `EXPECT-02`, `EXPECT-04`, `EXPECT-06`–`EXPECT-08`.
- **Referência ao design:** `DEC-05`, `DEC-10`, `DEC-13`–`DEC-15`; contrato `POST /products`.
- **Dependências:** `T03`, `T11`, `T17`–`T19`.
- **Parte do sistema afetada:** caso de uso, DTO/controller/serializer Products, OpenAPI e testes unitários/E2E.
- **Testes e verificações:** sucesso e todos os limites de campo; campo ausente, nulo ou desconhecido; cookie e CSRF/origem inválidos; verificar que falhas não escrevem e que retorno inclui datas ISO.
- **Critérios de conclusão:** critérios 10 e 11 do PRD passam; somente URL é persistida; status, schema e erros coincidem com o contrato; OpenAPI documenta cookie e cabeçalho.
- **Riscos ou premissas:** o rate limit será conectado na Fase 06 sem alterar o comportamento funcional.

## Tarefa T21 — Entregar GET /products/:id e comprovar catálogo compartilhado

Implementar `GetProduct` e a rota de consulta protegida. Identificador existente retorna `200` com produto completo; ausente retorna `404 PRODUCT_NOT_FOUND`. Um E2E com duas contas deve provar que produto criado por uma pode ser consultado pela outra, sem filtro de proprietário.

- **Requisitos relacionados:** `AAP-18`, `AAP-19`, `AAP-30`, `AAP-38`, `AAP-46`, `AAP-49`, `AAP-50`, `EXPECT-05`–`EXPECT-08`.
- **Referência ao design:** `DEC-03`, `DEC-10`, `DEC-13`; contrato `GET /products/:id`.
- **Dependências:** `T17`, `T19`, `T20`.
- **Parte do sistema afetada:** caso de uso, controller/serializer Products, OpenAPI e testes unitários/E2E.
- **Testes e verificações:** ID existente/ausente, cookie ausente/inválido/expirado, duas contas e falha de infraestrutura; inspecionar status, schema e logs.
- **Critérios de conclusão:** consulta não aplica propriedade por usuário; ausência gera o erro estável aprovado; resposta apresenta os sete campos públicos e nenhum dado interno.
- **Riscos ou premissas:** o formato concreto do ID permanece opaco e não deve ser validado pelo cliente além de ser string não vazia conforme o contrato implementado.

## Orientações de implementação

- Controller e DTO não acessam AWS SDK; casos de uso conhecem apenas a porta de produtos.
- Serialização pública é explícita e datas são UTC ISO 8601.
- Não adicionar `createdBy`, proprietário, upload, cálculo de preço ou ordenação.

## Registro de execução

- **T18 — concluída em 2026-09-04:** entidade `Product` criada fora do
  framework com invariantes de nome, descrição, preço, URL HTTP(S), ID e datas;
  datas são isoladas contra mutação externa e a serialização pública preserva
  os sete campos aprovados. Testes dirigidos: 1 suíte/24 testes; lint e
  typecheck aprovados.
- **T19 — concluída em 2026-09-04:** porta `ProductRepository` e adaptador
  DynamoDB implementados com `PutCommand` condicional, `GetCommand` com
  leitura consistente e mapeamento estrito dos sete atributos. Testes
  dirigidos: 1 suíte/5 testes unitários e 1 suíte/3 testes de integração;
  lint e typecheck aprovados.
- **T20 — concluída em 2026-09-04:** `CreateProduct` e `POST /products`
  implementados no módulo Products com guard de cookie, CSRF/origem, DTO
  estrito e serializer público. Testes dirigidos: 1 suíte/3 testes unitários e
  1 suíte/10 testes E2E; sucesso, limites, ausência/nulo/desconhecido,
  autenticação, proteção CSRF, persistência e OpenAPI comprovados.
- **T21 — concluída em 2026-09-04:** `GetProduct` e `GET /products/:id`
  implementados com `PRODUCT_NOT_FOUND`, serialização pública e proteção pelo
  cookie. Testes dirigidos: 1 suíte/3 testes unitários e 1 suíte/6 testes E2E;
  duas contas, ausência, cookies inválidos/expirados e OpenAPI comprovados.

## Testes e verificações da fase

Executar a validação padrão e um E2E completo com cadastro/login de duas contas, criação pela primeira e consulta pela segunda. Inspecionar itens do DynamoDB Local para confirmar o modelo aprovado.

## Critérios de aceitação da fase

1. Produto válido é criado com os sete campos públicos e `201`.
2. Cada campo inválido gera `400 VALIDATION_ERROR` sem persistência parcial.
3. Produto existente é consultado com `200`; ausente produz `404 PRODUCT_NOT_FOUND`.
4. Qualquer pessoa autenticada consulta produto criado por outra conta.
5. Guard, CSRF, erros, OpenAPI e logs permanecem alinhados ao contrato.

## Riscos, premissas e dependências externas da fase

- O contrato mantém preço como número; testes devem cobrir precisão aceita sem introduzir operações monetárias.
- A inexistência de proprietário é intencional e não pode ser substituída por autorização por recurso.

