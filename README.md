# Stone — Desafio técnico | Back-end

Este projeto foi desenvolvido como um desafio técnico de back-end. A proposta
foi entregar não apenas os endpoints, mas também testes, documentação,
infraestrutura reproduzível e uma versão publicada da API.

## O que foi implementado

- cadastro, login e logout de usuários;
- JWT em cookie `HttpOnly`, `Secure` e `SameSite=Strict`;
- CRUD de produtos protegido por autenticação;
- paginação por cursor e rate limit;
- validação de CORS e origem em operações mutáveis;
- respostas de erro consistentes e correlação de requisições;
- readiness em `GET /health`;
- documentação OpenAPI/Scalar;
- testes unitários, integração e E2E.

## Documentação

- [Requisitos do back-end](./docs/Requisitos.md)
- [Contrato da API](./docs/Contrato-da-API.md)
- [Decisões de tecnologia](./docs/Decisao-tecnologias.md)
- [Decisão de deploy](./docs/Decisao-deploy.md)
- [Artefatos de operação](./deploy/README.md)
- [Architecture Decision Records](./docs/adr/README.md)
- [Regras de desenvolvimento](./rules/README.md)


## Entrega do desafio

Como o objetivo do desafio foi fazer uma entrega onde os criterios eram bem descritos, eu quis fazer uma entrega levando em conta o todo, não so gerando um codigo organizado, mais fazendo a entrega até produção.

Passando por conhecimentos de nuvem, AWS, CI/CD utilizando o git hub. DynamoDB com AWS e Terraform. Foi um desafio pra mim mesmo para melhorar meu conhecimento e juntar tudo o que eu sei e consolidar em uma entrega real.

Segue os links dos itens hospedados.

[Front-end](https://products.devmoreno.com.br) em products.devmoreno.com.br
 
[Documentação do back-end](https://apiproducts.devmoreno.com.br/reference) em apiproducts.devmoreno.com.br

O Banco de dados está hospedado na aws com toda a infra estrutura provisionada via terraform, seguindo essas configurações: [Terraform guia](./deploy//terraform/README.md)

Outro ponto, segue o guia de como eu utilizei IA durante o desenvolvimento, foi um uso 100% estruturado e consiente: [Utilização de IA durante o Teste](./docs/Utilização%20de%20IA%20durante%20o%20Teste.pdf)

## Processo de deploy

O processo de deplloy para o back-end foi o seguinte.

Para provisionamento do banco de dados foi realizado com o terraform, criado todas as politicas IAM, usuario, e também as tabelas, somente a criação das chaves de acesso do usuário da aplicação que realizei a criação manual na AWS.

ja para o deploy da api, eu utilize uma VPS da Oracle, essa VPS estava sem nenhuma aplicação, então foi feita toda a configuração do linux e instalações do docker todo processo documentado em: [Deploy api](./deploy/api/README.md). 
A configuração foi visando realizar toda a criação da infraestrutura para o usuário de deploy do github realizar a config, visando ter deploy automatico toda vez que tiver um merge na branch main.


## Executar localmente

Requisitos: Node.js 22 ou LTS compatível, npm e Docker Compose.

Copie `.env.example` para `.env`, ajuste os valores locais e instale as
dependências pelo lockfile:

```bash
npm ci
docker compose up -d dynamodb-local
npm run db:provision
```

O bootstrap valida todas as variáveis obrigatórias antes de iniciar a API. O
valor de `JWT_SECRET` no arquivo de exemplo é apenas um placeholder e deve ser
substituído por um segredo local aleatório.

Para iniciar a API após o build:

```bash
npm run build
npm run start
```

ou 

```bash
npm run start:dev
```

A API ficará disponível em `http://localhost:3000`.

- documentação: `http://localhost:3000/reference`;
- OpenAPI JSON: `http://localhost:3000/docs-json`;
- readiness: `http://localhost:3000/health`.

## Validar a entrega

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

Os testes de integração e E2E usam o DynamoDB Local.


## Decisões técnicas principais

- NestJS e TypeScript estrito;
- Clean Architecture com domínio, casos de uso, portas e adaptadores;
- DynamoDB com AWS SDK v3, sem ORM adicional;
- Argon2id para senhas;
- Docker multi-stage com usuário não administrativo;
- imagens publicadas no GHCR identificadas pelo SHA do commit.

Detalhes em [Decisões de tecnologia](./docs/Decisao-tecnologias.md),
[Contrato da API](./docs/Contrato-da-API.md) e [ADRs](./docs/adr/README.md).

## Deploy

O ambiente publicado usa Terraform para as tabelas e IAM da AWS, uma VPS
Oracle com Docker/NGINX, Cloudflare na borda e GitHub Actions para publicar e
atualizar a imagem da API.

- [Resumo operacional da API](./deploy/api/README.md)
- [Guia completo da VPS](./deploy/api/vps-setup-guide.md)
- [Resumo do Terraform](./deploy/terraform/README.md)
- [Guia completo do Terraform](./deploy/terraform/infra-terraform-guia.md)

É uma arquitetura demonstrativa: há uma única VPS, não há autoscaling e o
deploy pode causar breve indisponibilidade. As limitações e a evolução sugerida
estão em [Decisão de deploy](./docs/Decisao-deploy.md).

