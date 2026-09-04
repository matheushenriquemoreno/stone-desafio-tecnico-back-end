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
- [Architecture Decision Records](./docs/adr/README.md)
- [Regras de desenvolvimento](./rules/README.md)
