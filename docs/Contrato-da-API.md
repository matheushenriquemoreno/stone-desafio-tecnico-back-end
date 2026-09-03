# Contrato da API

A documentação OpenAPI gerada pela aplicação é a fonte de verdade operacional. Este documento resume os contratos necessários para implementação e integração.

## Cadastro

```http
POST /auth/register
Content-Type: application/json
X-CSRF-Protection: 1
```

```json
{
  "name": "Maria Silva",
  "email": "maria@example.com",
  "password": "senha-segura"
}
```

Resposta `201 Created`:

```json
{
  "id": "identificador-gerado",
  "name": "Maria Silva",
  "email": "maria@example.com"
}
```

Possíveis erros: `400`, `403`, `409`, `429` e `500`.

## Login

```http
POST /auth/login
Content-Type: application/json
X-CSRF-Protection: 1
```

```json
{
  "email": "maria@example.com",
  "password": "senha-segura"
}
```

Resposta de sucesso:

```http
HTTP/1.1 204 No Content
Set-Cookie: __Host-stone_access_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900
```

O JWT terá `exp - iat = 900` segundos, igual ao `Max-Age` do cookie. Ele não será incluído no corpo da resposta nem ficará acessível ao JavaScript. Possíveis erros são `400`, `401`, `403`, `429` e `500`; credenciais inválidas retornam `401` com mensagem genérica e não criam cookie.

## Logout

```http
POST /auth/logout
Cookie: __Host-stone_access_token=<jwt>
X-CSRF-Protection: 1
```

Resposta de sucesso:

```http
HTTP/1.1 204 No Content
Set-Cookie: __Host-stone_access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
```

O logout é idempotente e retorna `204` mesmo quando o cookie estiver ausente, inválido ou expirado. Ele remove a credencial do navegador, mas não mantém lista de revogação do JWT; uma cópia do token permanece criptograficamente válida até sua expiração.

Possíveis erros são `403`, `429` e `500`.

## Produtos

```text
GET    /products?limit=20&cursor=<cursor>
POST   /products
GET    /products/:id
PATCH  /products/:id
DELETE /products/:id
```

Todas as operações exigem:

```http
Cookie: __Host-stone_access_token=<jwt>
```

Operações que alteram estado também exigem:

```http
X-CSRF-Protection: 1
Content-Type: application/json
```

`DELETE /products/:id` exige o cabeçalho de proteção CSRF, mas não precisa enviar corpo nem `Content-Type`.

Um produto possui:

```json
{
  "id": "identificador",
  "name": "Produto",
  "description": "Descrição",
  "price": 99.9,
  "imageUrl": "https://example.com/produto.png",
  "createdAt": "2026-09-02T12:00:00.000Z",
  "updatedAt": "2026-09-02T12:00:00.000Z"
}
```

`imageUrl` é uma URL HTTP(S) obrigatória. A aplicação armazena apenas o endereço, não o arquivo da imagem.

Criação exige todos os campos editáveis:

```json
{
  "name": "Produto",
  "description": "Descrição",
  "price": 99.9,
  "imageUrl": "https://example.com/produto.png"
}
```

Atualização parcial aceita qualquer subconjunto desses campos:

```json
{
  "name": "Novo nome",
  "price": 109.9
}
```

`PATCH /products/:id` exige ao menos um entre `name`, `description`, `price` e `imageUrl`. Campos omitidos permanecem inalterados. Valores `null` e propriedades desconhecidas são rejeitados com `400 Bad Request`.

| Operação | Sucesso | Possíveis erros |
|---|---|---|
| Listar | `200 OK` | `400`, `401`, `403`, `429`, `500` |
| Criar | `201 Created` | `400`, `401`, `403`, `429`, `500` |
| Consultar | `200 OK` | `401`, `403`, `404`, `429`, `500` |
| Atualizar | `200 OK` | `400`, `401`, `403`, `404`, `429`, `500` |
| Excluir | `204 No Content` | `401`, `403`, `404`, `429`, `500` |

## Paginação

```text
Request:  GET /products?limit=20&cursor=<cursor-opaco>
Response: { items: [...], nextCursor: "<cursor-opaco>" }
```

A ausência de `nextCursor` indica que não há outra página. O cliente não deve interpretar o conteúdo do cursor.

A API oferece navegação sequencial e não aceita número de página ou `offset`. Portanto, um cliente só consegue avançar usando o `nextCursor` recebido anteriormente. Retornar a páginas anteriores depende de o próprio cliente guardar os cursores já percorridos; não há suporte para saltar diretamente a uma página ainda não visitada.

## Health

```http
GET /health
```

O endpoint é público e representa readiness. Ele confirma que a aplicação terminou a inicialização e consegue acessar as tabelas `users` e `products` no DynamoDB.

Resposta pronta:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok"
}
```

Se uma dependência necessária não estiver disponível, retorna `503 Service Unavailable` no schema padrão de erro com `code=SERVICE_UNAVAILABLE`. Detalhes da dependência não são expostos. O endpoint também pode retornar `403`, `429` ou `500`.

Não há endpoint HTTP de liveness nesta versão. O estado do processo/container cumpre essa função operacional.

## Erros

Todas as respostas de erro usam:

```json
{
  "statusCode": 429,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Limite de requisições excedido.",
  "correlationId": "identificador-da-requisicao"
}
```

| Campo | Tipo | Regra |
|---|---|---|
| `statusCode` | número | Código HTTP da resposta. |
| `code` | string | Identificador estável para tratamento pelo cliente. |
| `message` | string | Mensagem segura para apresentação ou fallback. |
| `correlationId` | string | Identificador opaco para suporte e rastreamento; não contém dado pessoal. |
| `errors` | array opcional | Presente somente em erros de validação, com objetos `{ field, code, message }`. |

Erros de validação usam `code=VALIDATION_ERROR`; cada item de `errors` identifica somente um campo público do contrato. O corpo nunca inclui valor de senha, JWT, stack trace ou detalhe de infraestrutura.

| Situação | `code` |
|---|---|
| Entrada inválida | `VALIDATION_ERROR` |
| Credenciais inválidas | `INVALID_CREDENTIALS` |
| Cookie ausente, inválido ou expirado | `UNAUTHORIZED` |
| Origem ou proteção CSRF inválida | `REQUEST_FORBIDDEN` |
| Produto não encontrado | `PRODUCT_NOT_FOUND` |
| E-mail já cadastrado | `EMAIL_ALREADY_EXISTS` |
| Limite excedido | `RATE_LIMIT_EXCEEDED` |
| Readiness indisponível | `SERVICE_UNAVAILABLE` |
| Falha inesperada | `INTERNAL_ERROR` |

| Status | Significado |
|---|---|
| `400 Bad Request` | Entrada inválida. |
| `401 Unauthorized` | Credenciais ou token inválidos. |
| `403 Forbidden` | Origem não autorizada ou proteção CSRF ausente. |
| `404 Not Found` | Produto inexistente. |
| `409 Conflict` | E-mail já cadastrado ou outro conflito documentado. |
| `429 Too Many Requests` | Limite de requisições excedido. |
| `500 Internal Server Error` | Falha inesperada sem detalhes sensíveis. |
| `503 Service Unavailable` | API ainda não está pronta para receber tráfego. |

Mudanças incompatíveis em campos, endpoints, autenticação, paginação ou erros exigem coordenação com os clientes da API.

## Integração direta com clientes web

- O NestJS é a autoridade de autenticação e validação do JWT.
- O navegador chama a API diretamente; não há endpoints intermediários.
- Todas as chamadas do navegador usam `credentials: include` para receber e enviar o cookie.
- A API habilita credenciais somente para origens exatas configuradas. `Access-Control-Allow-Origin: *` não é permitido.
- Requisições `POST`, `PATCH` e `DELETE` exigem `X-CSRF-Protection: 1`; quando houver `Origin`, ele deve ser a própria origem da API ou estar na lista de clientes permitidos.
- Swagger UI e clientes como `curl` usam o mesmo fluxo de cookie e enviam o cabeçalho CSRF nas operações mutáveis.
- A autenticação não aceita `Authorization: Bearer` nesta versão.
- A política e os limites de requisição estão definidos na [ADR-004](./adr/ADR-004-rate-limit.md).
- A decisão completa de cookie, CORS, CSRF e escalabilidade está na [ADR-005](./adr/ADR-005-autenticacao-cookie-http-only.md).

Para origens permitidas, o preflight CORS autoriza `GET`, `POST`, `PATCH`, `DELETE` e `OPTIONS`, além dos cabeçalhos `Content-Type` e `X-CSRF-Protection`. O navegador poderá ler `Retry-After`. Requisições `OPTIONS` não exigem autenticação e não consomem o limite dos endpoints de negócio.
