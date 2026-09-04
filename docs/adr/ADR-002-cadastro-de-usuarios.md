# ADR-002: Cadastro de usuários na API

## Status

Aceita

## Data da decisão

2026-09-02

## Documentos relacionados

- [Requisitos do back-end](../Requisitos.md)
- [Contrato da API](../Contrato-da-API.md)
- [ADR-001: Clean Architecture no back-end](./ADR-001-clean-architecture-backend.md)
- [ADR-003: Modelagem no DynamoDB](./ADR-003-modelagem-dynamodb.md)
- [ADR-004: Rate limit por endpoint](./ADR-004-rate-limit.md)
- [ADR-005: Autenticação web direta por cookie HttpOnly](./ADR-005-autenticacao-cookie-http-only.md)

## Contexto

O desafio exige login. Sem cadastro, seria necessário inserir usuários manualmente no DynamoDB, dificultando avaliação, testes e criação de múltiplas contas.

O cadastro inicial não inclui confirmação de e-mail, perfis, recuperação de senha ou aprovação administrativa.

## Decisão

A API permitirá cadastro público com nome, e-mail e senha. A operação criará a conta, mas não emitirá JWT; autenticação continuará sendo uma chamada separada.

## Contrato

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

| Situação | Status |
|---|---|
| Dados inválidos | `400 Bad Request` |
| Origem ou proteção CSRF inválida | `403 Forbidden` |
| E-mail já cadastrado | `409 Conflict` |
| Limite excedido | `429 Too Many Requests` |
| Erro inesperado | `500 Internal Server Error` sem detalhes sensíveis |

## Validação

- `name`: obrigatório, normalizado, entre 2 e 100 caracteres.
- `email`: obrigatório, válido, em minúsculas e sem espaços nas extremidades.
- `password`: obrigatória, entre 8 e 128 caracteres.

## Persistência e unicidade

Cada usuário terá `id` imutável gerado pela aplicação. O e-mail normalizado será a chave de partição da tabela `users`.

A criação usará `attribute_not_exists(email)`, garantindo unicidade atômica. Falha condicional será convertida em `409 Conflict`.

A senha será transformada em hash Argon2id antes da persistência. A senha em texto puro não será enviada para logs nem retornada em erros.

## Autenticação após cadastro

- `POST /auth/register` cria o usuário.
- `POST /auth/login` valida credenciais e grava o JWT no cookie definido pela ADR-005.

## Caso de uso e portas

`RegisterUser` dependerá de portas para consultar e criar usuários, gerar identificadores e calcular hash. O caso de uso não dependerá de NestJS, Argon2 ou DynamoDB. O adaptador DynamoDB fará a escrita condicional e mapeará o erro de concorrência.

## Testes

- Cadastro válido, e-mail duplicado e normalização.
- Validação de nome, e-mail e senha.
- Garantia de que senha e hash não aparecem na resposta.
- Integração da escrita condicional com DynamoDB Local.
- E2E para `201`, `400`, `403`, `409` e `429`.
- Cadastro e autenticação independentes para usuários distintos.

## Consequências

O fluxo pode ser avaliado sem preparação manual e a unicidade é garantida atomicamente. Em contrapartida, um endpoint público aumenta a superfície de abuso, não comprova a posse do e-mail e amplia as permissões de escrita necessárias.

## Alternativas consideradas

Seeds e inserção manual foram rejeitados por limitar a avaliação e expor detalhes internos. Login automático foi rejeitado para manter cadastro e autenticação como casos de uso independentes.
