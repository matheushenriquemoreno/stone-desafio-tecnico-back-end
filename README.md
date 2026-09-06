# Stone — Desafio técnico | Back-end

API REST em NestJS para cadastro e autenticação de usuários e CRUD paginado de produtos, com JWT, rate limit, documentação OpenAPI e persistência no DynamoDB.

## Responsabilidade deste repositório

Este repositório contém somente o back-end:

- contratos HTTP de autenticação e produtos;
- casos de uso, regras de domínio e adaptadores NestJS;
- persistência no DynamoDB e scripts de ambiente local;
- emissão e validação de JWT, hash de senhas e rate limit;
- testes unitários, de integração e E2E da API;
- container, infraestrutura e pipeline de deploy da API.

A interface Next.js é um cliente externo e consome esta API diretamente pelo navegador. Este repositório não contém implementação específica para um intermediário de front-end.

## Documentação

- [Requisitos do back-end](./docs/Requisitos.md)
- [Contrato da API](./docs/Contrato-da-API.md)
- [Decisões de tecnologia](./docs/Decisao-tecnologias.md)
- [Decisão de deploy](./docs/Decisao-deploy.md)
- [Artefatos de operação](./deploy/README.md)
- [Architecture Decision Records](./docs/adr/README.md)
- [Regras de desenvolvimento](./rules/README.md)

## Desenvolvimento

Copie `.env.example` para `.env`, ajuste os valores locais e instale as
dependências pelo lockfile:

```bash
npm ci
```

Os comandos oficiais de verificação são:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

O bootstrap valida todas as variáveis obrigatórias antes de iniciar a API. O
valor de `JWT_SECRET` no arquivo de exemplo é apenas um placeholder e deve ser
substituído por um segredo local aleatório.

Para iniciar a API após o build:

```bash
npm run build
npm run start
```

Durante o desenvolvimento, use o modo com recarregamento automático:

```bash
npm run start:dev
```

O DynamoDB Local deve estar disponível em `DYNAMODB_ENDPOINT` e as tabelas
devem existir. Para o ambiente local definido no exemplo:

```bash
docker compose up -d dynamodb-local
npm run db:provision
```

## Build da imagem

O `Dockerfile` usa múltiplos estágios: a imagem final contém somente o
aplicativo compilado e as dependências de produção. Segredos e configurações
de ambiente são fornecidos apenas em tempo de execução.

```bash
docker build --pull -t stone-api:local .
docker image inspect stone-api:local --format '{{.Config.User}}'
```

O processo da imagem executa como o usuário não administrativo `node` e expõe
o `HEALTHCHECK` baseado em `GET /health`. A publicação em registro, a
configuração da infraestrutura e o deploy da imagem são procedimentos
operacionais separados deste build local.
