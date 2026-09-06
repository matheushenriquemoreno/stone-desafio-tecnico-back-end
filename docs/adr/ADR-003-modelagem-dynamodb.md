# ADR-003: Modelagem de dados no DynamoDB

## Status

Aceita

## Data da decisão

2026-09-02

## Histórico de atualizações

| Data       | Alteração |
|------------|-----------|
| 2026-09-05 | Adicionada contagem total exata à listagem por varredura consistente, preservando o modelo de dados. |

## Documentos relacionados

- [Decisões de tecnologia](../Decisao-tecnologias.md)
- [Decisão de deploy](../Decisao-deploy.md)
- [Contrato da API](../Contrato-da-API.md)
- [ADR-001: Clean Architecture no back-end](./ADR-001-clean-architecture-backend.md)
- [ADR-002: Cadastro de usuários](./ADR-002-cadastro-de-usuarios.md)

## Contexto

O DynamoDB é um banco key-value e documental. Não oferece `JOIN`, `ORDER BY` arbitrário nem paginação por `OFFSET`. Consultas eficientes dependem de `Query` associado a uma chave de partição, enquanto `Scan` percorre a tabela inteira e é inadequado para volume significativo.

O projeto possui dois domínios:

- **Usuários**: localização pontual por e-mail durante o login.
- **Produtos**: CRUD completo com listagem paginada, escrita e consulta individual.

A modelagem deve ser clara para o desafio e explicitar os padrões de acesso que precisariam evoluir em produção.

## Decisão

Serão utilizadas duas tabelas independentes, cada uma com chave de partição simples e sem chave de classificação.

### Tabela `users`

| Atributo | Tipo | Papel |
|---|---|---|
| `email` | `String` (PK) | Localiza o usuário durante o login. |
| `id` | `String` | Identificador imutável usado no `sub` do JWT. |
| `name` | `String` | Nome do usuário. |
| `passwordHash` | `String` | Hash Argon2id da senha. |
| `createdAt` | `String` (ISO 8601) | Data de criação. |

### Tabela `products`

| Atributo | Tipo | Papel |
|---|---|---|
| `id` | `String` (PK) | Identificador único. |
| `name` | `String` | Nome do produto. |
| `description` | `String` | Descrição detalhada. |
| `price` | `Number` | Preço unitário. |
| `imageUrl` | `String` | URL HTTP(S) da imagem. |
| `createdAt` | `String` (ISO 8601) | Data de criação. |
| `updatedAt` | `String` (ISO 8601) | Data da última atualização. |

O DynamoDB armazenará apenas a URL da imagem, não o arquivo.

## Padrões de acesso

### Login

```text
GetItem → users WHERE email = :email
```

### Cadastro de usuário

```text
PutItem → users WHERE email = :email
          CONDITION attribute_not_exists(email)
```

A condição garante unicidade atômica do e-mail normalizado. Falha condicional será convertida em `409 Conflict`.

### Criação de produto

```text
PutItem → products WHERE id = :id
          CONDITION attribute_not_exists(id)
```

### Listagem paginada

```text
Scan → products com Limit e ExclusiveStartKey
Scan consistente com Select COUNT → products até esgotar LastEvaluatedKey
```

Como não há filtro de propriedade comum e a listagem retorna todos os produtos, a implementação inicial usará `Scan`. O cursor será derivado de `LastEvaluatedKey` e tratado como valor opaco.

Cada resposta também retornará `total`, calculado por uma varredura consistente com `Select=COUNT`. Como uma varredura pode ser dividida internamente pelo DynamoDB, a implementação seguirá cada `LastEvaluatedKey` e somará os valores de `Count` até percorrer a tabela. A página solicitada e a contagem serão lidas em paralelo somente depois de validar o cursor.

A leitura consistente reduz atraso de replicação, mas o DynamoDB não oferece snapshot transacional para uma varredura composta por várias páginas. Uma criação ou exclusão concorrente pode causar diferença momentânea entre a página e a contagem; a requisição seguinte recalcula o valor. Falha em qualquer parte da contagem falha a listagem inteira, sem resposta parcial.

Para volumes grandes, um `Scan` irrestrito consome RCUs proporcionalmente ao tamanho da tabela. Uma evolução poderá introduzir um GSI com chave de partição fixa ou reorganizar a tabela para permitir `Query`. No volume pequeno do desafio, `Scan` é uma limitação aceita e explícita.

### Consulta por ID

```text
GetItem → products WHERE id = :id
```

### Atualização

```text
UpdateItem → products WHERE id = :id
             SET name = :name, description = :description,
                 price = :price, imageUrl = :imageUrl,
                 updatedAt = :updatedAt
             CONDITION attribute_exists(id)
```

### Exclusão

```text
DeleteItem → products WHERE id = :id
             CONDITION attribute_exists(id)
```

As condições de atualização e exclusão permitem distinguir um produto inexistente e retornar `404 Not Found`.

## Paginação

```text
Request:  GET /products?limit=20&cursor=<base64-lastEvaluatedKey>
Response: { items: [...], total: 42, nextCursor: "<base64-lastEvaluatedKey>" }
```

- `LastEvaluatedKey` será codificado antes de ser enviado.
- Na próxima requisição, o cursor será decodificado como `ExclusiveStartKey`.
- Sem `nextCursor`, não há outra página.
- `total` é obrigatório, inteiro, não negativo e representa todo o catálogo.
- O cliente não deve interpretar o cursor.
- Codificação e decodificação ficam centralizadas na infraestrutura de persistência.

### Limitação de navegação

A paginação por cursor é sequencial. A API não oferece número de página nem `offset`, portanto não permite saltar diretamente para uma página ainda não percorrida. Para voltar a páginas anteriores, o cliente precisa manter os cursores recebidos durante a navegação e reutilizar o cursor correspondente.

Essa limitação é aceita porque evita simular paginação por deslocamento, operação que não é nativa do DynamoDB e perde eficiência à medida que o conjunto de dados cresce.

## Provisionamento

As tabelas serão criadas de forma idempotente por scripts no ambiente local e por Terraform no ambiente publicado. A carga inicial usará credenciais administrativas separadas das credenciais de execução da API.

## Consequências

### Positivas

- A modelagem espelha os acessos reais.
- Não há GSI ou sort key sem necessidade atual.
- A escolha entre `Query` e `Scan` fica explícita.
- A paginação por cursor acompanha o modelo do DynamoDB.
- A contagem não exige nova tabela, item de metadados ou migração.
- Cada tabela possui responsabilidade clara.

### Negativas

- O `Scan` em `products` não escala bem.
- Cada listagem executa trabalho proporcional ao tamanho total do catálogo para produzir `total`.
- Sem sort key, não há ordenação global por data.
- A navegação é sequencial e não permite acesso aleatório por número de página.
- Novas consultas podem exigir migração ou índice.

## Alternativas consideradas

### Tabela unificada

Rejeitada porque Single Table Design adicionaria complexidade desnecessária para dois domínios independentes.

### Sort key por data

Rejeitada porque nenhum requisito atual depende de filtro ou ordenação temporal. Deve ser reavaliada se esse padrão de acesso surgir.

### GSI desde o início

Rejeitada porque adiciona custo de leitura e escrita sem necessidade concreta. Um índice pode ser adicionado posteriormente.

### Contador transacional

Rejeitado porque exigiria metadado persistido e coordenação atômica com criação e exclusão. O catálogo pequeno não justifica essa complexidade.

### Contagem aproximada da tabela

Rejeitada porque a estimativa operacional do DynamoDB pode permanecer desatualizada e não atende ao requisito de total exato.

Referência: [Índices secundários globais do DynamoDB](https://docs.aws.amazon.com/pt_br/amazondynamodb/latest/developerguide/GSI.html).
