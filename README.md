# Stone — Desafio técnico | Back-end

API REST em NestJS para cadastro e autenticação de usuários e Listagem de produtos e CRUD, Utilizando authenticação via token JWT, regras de rate limit, documentação utilizando OpenAPI e persistência no DynamoDB.

## Responsabilidade deste repositório

Este repositório contém somente o back-end:

- contratos HTTP de autenticação e produtos;
- casos de uso, regras de domínio e adaptadores NestJS;
- persistência no DynamoDB e scripts de ambiente local;
- emissão e validação de JWT, hash de senhas e rate limit;
- testes unitários, de integração e E2E da API;
- container, infraestrutura e pipeline de deploy da API.

A interface Next.js é um cliente externo e consome esta API diretamente pelo navegador.

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

## Rodar ambiente

Copie `.env.example` para `.env`, ajuste os valores locais e instale as
dependências pelo lockfile:

```bash
npm ci
```

O bootstrap valida todas as variáveis obrigatórias antes de iniciar a API. O
valor de `JWT_SECRET` no arquivo de exemplo é apenas um placeholder e deve ser
substituído por um segredo local aleatório.

Para iniciar a API após o build:

```bash
npm run build
npm run start
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
