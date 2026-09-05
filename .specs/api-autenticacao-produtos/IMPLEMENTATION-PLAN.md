# Plano de Implementação — API de cadastro, autenticação e catálogo de produtos

| Status       | Aprovado   |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-05 |

PRD de referência: [PRODUCT-REQUIREMENTS.md](./PRODUCT-REQUIREMENTS.md) (`Aprovado`)

Design técnico: [TECHNICAL-DESIGN.md](./TECHNICAL-DESIGN.md) (`Aprovado`)

## Histórico de atualizações

| Data       | Alteração |
|------------|-----------|
| 2026-09-03 | Versão inicial criada e encaminhada para revisão. |
| 2026-09-03 | Plano aprovado; formalizado o limite de 30 requisições por minuto e IP para `/docs` e `/docs-json`. |
| 2026-09-04 | Revisão material aprovada: inserida a Fase 07 para `SameSite=Strict` e origem; a entrega operacional foi movida para a Fase 08. |
| 2026-09-05 | Revisão material aprovada: inserida a Fase 08 para `total` exato na listagem; a entrega operacional foi movida para a Fase 09 e suas tarefas pendentes foram renumeradas. |

## Objetivo geral da implementação

Entregar uma API NestJS executável, testada e publicável que permita cadastro, autenticação por JWT em cookie HttpOnly e CRUD paginado do catálogo compartilhado de produtos, preservando os contratos, controles de segurança, persistência DynamoDB e operação definidos no PRD e no design técnico aprovados.

## Estratégia de execução

A execução começa com um tracer bullet de infraestrutura da aplicação até o DynamoDB Local, observável por `GET /health`. Em seguida, adiciona capacidades verticais de cadastro, autenticação e produtos, mantendo testes unitários, de integração e E2E junto de cada comportamento. A robustez transversal — rate limit e conformidade integral do OpenAPI — é consolidada depois que todas as rotas existem. A Fase 07 atualiza a proteção de origem; a Fase 08 adiciona o total exato ao contrato paginado; a Fase 09 empacota e automatiza a entrega sem misturar validação funcional com provisionamento externo.

A Fase 01 estabelece `npm` com lockfile e os scripts `lint`, `typecheck`, `test`, `test:integration`, `test:e2e` e `build`; esses comandos passam a ser as verificações oficiais das fases seguintes. Cada fase é executada isoladamente e precisa passar por `review` antes de a próxima iniciar.

## Fases

| #  | Fase | Arquivo | Status |
|----|------|---------|--------|
| 01 | Tracer bullet e fundação observável | [fase-01-tracer-bullet-fundacao.md](fases/fase-01-tracer-bullet-fundacao.md) | Concluída |
| 02 | Cadastro seguro de usuários | [fase-02-cadastro-usuarios.md](fases/fase-02-cadastro-usuarios.md) | Concluída |
| 03 | Autenticação e proteção do cliente web | [fase-03-autenticacao-protecao-web.md](fases/fase-03-autenticacao-protecao-web.md) | Concluída |
| 04 | Criação e consulta de produtos | [fase-04-criacao-consulta-produtos.md](fases/fase-04-criacao-consulta-produtos.md) | Concluída |
| 05 | Paginação, atualização e exclusão de produtos | [fase-05-paginacao-manutencao-produtos.md](fases/fase-05-paginacao-manutencao-produtos.md) | Concluída |
| 06 | Rate limit e conformidade operacional da API | [fase-06-rate-limit-conformidade.md](fases/fase-06-rate-limit-conformidade.md) | Concluída |
| 07 | Proteção CSRF por cookie e validação de origem | [fase-07-protecao-csrf-origem.md](fases/fase-07-protecao-csrf-origem.md) | Concluída |
| 08 | Total exato na listagem de produtos | [fase-08-total-exato-produtos.md](fases/fase-08-total-exato-produtos.md) | Em execução |
| 09 | Empacotamento, infraestrutura e entrega | [fase-09-entrega-operacional.md](fases/fase-09-entrega-operacional.md) | Pendente |

## Dependências e ordem entre as fases

1. A Fase 01 cria o projeto executável, as portas transversais, o ambiente de dados e o pipeline HTTP usados por todas as demais fases.
2. A Fase 02 introduz usuário e persistência de credenciais; a Fase 03 depende disso para autenticar e proteger os módulos seguintes.
3. A Fase 04 depende do guard de autenticação e cria a base de domínio e repositório de produtos.
4. A Fase 05 amplia o repositório de produtos e depende dos modelos e contratos da Fase 04.
5. A Fase 06 só consolida políticas por endpoint depois que todas as rotas de negócio existem; sua implementação reutiliza relógio, IP, erros e correlação estabelecidos anteriormente.
6. A Fase 07 atualiza a proteção transversal sobre a API funcional e exige review aprovado antes da Fase 08.
7. A Fase 08 depende da listagem concluída na Fase 05 e da conformidade da Fase 06 para ampliar persistência, contrato HTTP, OpenAPI e matriz sem alterar a paginação.
8. A Fase 09 depende da Fase 08 aprovada, da API funcional e da suíte verde para produzir imagem, infraestrutura, pipeline e procedimentos de deploy/rollback.

Não há ciclos. Uma fase somente começa depois que a anterior estiver `Concluída` e aprovada pela skill `review`.

## Marcos de entrega

- **Marco 1 — Fase 01 aprovada:** aplicação inicializa, acessa duas tabelas no DynamoDB Local e demonstra readiness positivo e negativo pelo contrato público.
- **Marco 2 — Fases 02 e 03 aprovadas:** visitante cadastra uma conta, autentica-se por cookie seguro e as fronteiras web recusam acessos ou mutações inválidas.
- **Marco 3 — Fases 04 e 05 aprovadas:** catálogo compartilhado oferece CRUD completo e paginação sequencial por cursor opaco.
- **Marco 4 — Fase 06 aprovada:** todas as rotas obedecem rate limit, erros, OpenAPI e verificações transversais do contrato.
- **Marco 5 — Fase 07 aprovada:** cookie, origem, CORS, OpenAPI e consumidores seguem a nova proteção, com risco residual documentado.
- **Marco 6 — Fase 08 aprovada:** toda página de produtos retorna o total exato do catálogo e o contrato está comprovado ponta a ponta.
- **Marco 7 — Fase 09 aprovada:** imagem imutável, infraestrutura e pipeline de publicação/rollback estão reproduzíveis e verificáveis.

## Cobertura executiva de requisitos

| Requisitos | Tarefas |
|------------|---------|
| `AAP-01`–`AAP-09` | `T06`–`T09`, `T12` |
| `AAP-10`–`AAP-17` | `T13`–`T16` |
| `AAP-18`–`AAP-24` | `T10`, `T11`, `T17`, `T30`, `T34`–`T36` |
| `AAP-60` | `T35`, `T36` |
| `AAP-25`–`AAP-30` | `T18`–`T20` |
| `AAP-31`–`AAP-38` | `T19`, `T21`–`T24` |
| `AAP-39`–`AAP-49` | `T21`, `T25`–`T27` |
| `AAP-50`–`AAP-52` | `T03`, `T12`, `T33` |
| `AAP-53`–`AAP-55` | `T28`–`T31` |
| `AAP-56`–`AAP-57` | `T32` |
| `AAP-58`–`AAP-59` | `T04`–`T05` |
| `AAP-61` | `T37`, `T38` |
| `EXPECT-01`–`EXPECT-05` | `T03`, `T07`, `T10`–`T17`, `T33` |
| `EXPECT-06` | `T12`, `T15`–`T17`, `T20`–`T27`, `T32`, `T38` |
| `EXPECT-07`–`EXPECT-08` | `T01`–`T05`, testes de cada tarefa, `T33`, `T34`–`T38`, `T42` |
| `EXPECT-09`–`EXPECT-10` | `T39`–`T42` |
| `EXPECT-11` | `T03`, `T31`, `T33`, `T41` |

Todos os requisitos `Essencial` e `Importante` possuem ao menos uma tarefa. O PRD não possui requisito `Desejável` pendente ou adiado nesta versão. Toda tarefa aponta para requisito, critério de aceitação ou necessidade técnica do design aprovado.

## Riscos e verificações gerais

- **Drift entre DTO, aplicação, OpenAPI e contrato:** cada rota recebe teste E2E e descrição OpenAPI na fase que a cria; `T31`, `T36` e `T38` executam a verificação consolidada.
- **Custo da contagem exata:** `T37` comprova a varredura completa e `T38` registra a limitação; crescimento do catálogo exige revisar a ADR-003.
- **Testes não determinísticos:** relógio, gerador de IDs e identificação de IP entram por portas controláveis; DynamoDB Local usa tabelas isoladas por execução.
- **Segredos ou dados sensíveis em saída:** filtros, logs e serializadores são verificados desde as primeiras fases e auditados novamente em `T33` e `T41`.
- **Semântica incorreta do Fixed Window:** `T29` implementa armazenamento explícito e `T31` comprova limite, independência e `Retry-After` com relógio controlado.
- **Inconsistência entre desenvolvimento e produção:** configuração falha cedo; Compose local, imagem e manifesto de produção são validados separadamente.
- **Dependências externas indisponíveis:** publicação real depende de AWS, GHCR, Cloudflare e VPS; artefatos e validações locais podem ser concluídos antes, mas o marco final exige evidência do ambiente publicado.
- **Trecho Cloudflare–VPS sem TLS:** permanece limitação aceita apenas para a demonstração e deve constar no runbook; não será apresentado como padrão de produção.
- **Rollback destrutivo de dados:** rollback altera somente o SHA da imagem e nunca remove tabelas.

## Verificações gerais

Depois de `T01`, a validação padrão de cada fase é:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

Fases que alteram containers ou infraestrutura acrescentam `docker compose config`, build da imagem e as validações Terraform definidas em seus próprios arquivos. A execução real deve registrar versões, comandos e evidências no `IMPLEMENTATION-STATE.md`.

## Estratégia de reversão

- Durante as Fases 01–08, cada tarefa deve manter mudanças pequenas e isoladas; a reversão remove apenas a capacidade ainda não aprovada, sem alterar artefatos anteriores aprovados.
- Alterações de dados são aditivas no primeiro provisionamento. Nenhuma fase possui migração ou exclusão de tabela.
- Na Fase 09, rollback de aplicação reaponta o Compose ao SHA anteriormente validado e confirma `/health`; infraestrutura persistente não é destruída como parte do rollback da aplicação.

## Perguntas que bloqueiam a implementação

| Pergunta | Por que bloqueia | Status |
|----------|------------------|--------|
| Qual política explícita de rate limit deve valer para `GET /docs` e `GET /docs-json` — limite próprio ou isenção documentada? | Aprovado o limite independente de 30 requisições por minuto e IP para cada rota e registrado na ADR-004. | Resolvida |
