# Review — API de cadastro, autenticação e catálogo de produtos

| Status       | Aprovado |
| ------------ | -------- |
| Created      | 2026-09-04 |
| Last Updated | 2026-09-04 |

**Escopo revisado:** fase 07 — Proteção CSRF por cookie e validação de origem
**Versão da avaliação:** 7

## Avaliação da Fase 07 — versão 7

### Artefatos analisados

- PRD: [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md)
- Design técnico: [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md)
- Plano: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)
- Fase: [fases/fase-07-protecao-csrf-origem.md](fases/fase-07-protecao-csrf-origem.md)
- Estado: [fases/IMPLEMENTATION-STATE.md](fases/IMPLEMENTATION-STATE.md)
- ADRs: [ADR-005](../../docs/adr/ADR-005-autenticacao-cookie-http-only.md) e [ADR-006](../../docs/adr/ADR-006-protecao-csrf-origem.md)
- Implementação: `auth-cookie.ts`, `csrf-protection.middleware.ts`, `cors-options.ts`, `setup-openapi.ts` e controllers
- Testes: `test/e2e/csrf.e2e.spec.ts`, `test/e2e/cors.e2e.spec.ts`, E2E de autenticação/produtos e testes de cookie
- Convenções: `rules/README.md`, `rules/principios-de-design.md`, `rules/codigo-como-um-livro.md` e `rules/checklist-de-implementacao.md`

### Resumo executivo

A Fase 07 foi revisada contra o PRD, o design, o plano, a ADR-006 e o código
executável. A implementação publica `SameSite=Strict`, valida `Origin` com
precedência e usa `Referer` somente como fallback; origens inválidas retornam
`403 REQUEST_FORBIDDEN`, enquanto a ausência dos dois headers segue para as
etapas posteriores. O header customizado foi removido de CORS, OpenAPI,
controllers, consumidores e fixtures ativos.

Os gates passaram sem achados bloqueadores, altos ou médios. A auditoria
encontrou inicialmente uma referência obsoleta à antiga Fase 07 no estado da
implementação; o link e a numeração foram corrigidos antes do veredito final.

### Resultado das verificações obrigatórias

| Verificação | Resultado | Evidência |
| ------------ | --------- | --------- |
| Requisitos | Atendida no recorte da fase | `AAP-20`–`AAP-24`, `AAP-60` e `EXPECT-03` estão refletidos no middleware, cookie, CORS, OpenAPI e contratos ativos. |
| Critérios de aceitação | Atendida | Cookie, origem permitida/própria, fallback, precedência, ausência simultânea e métodos seguros possuem testes E2E dirigidos. |
| Testes | Atendida | 35 suítes/168 testes unitários, 3 suítes/9 testes de integração e 15 suítes/91 testes E2E passaram. |
| Design técnico | Atendida | `DEC-05` está marcada como histórica substituída; `DEC-20` e ADR-006 definem a estratégia ativa. |
| Plano | Atendida | T34, T35 e T36 concluídas; Fase 08 foi movida para o próximo arquivo e permanece pendente. |
| Escopo | Atendida | Não foram introduzidos Bearer, API key, token CSRF, sessão server-side, `Sec-Fetch-Site`, migração ou variável de ambiente. |
| Qualidade | Atendida | Lint, typecheck, testes, build e `git diff --check` passaram. |
| Padrões do projeto | Atendida | A regra permanece na borda HTTP, a fábrica de cookie é reutilizada e o domínio não recebeu dependências HTTP. |
| Manutenibilidade | Atendida | Parsing, allowlist e decisão de precedência estão isolados no middleware; a política é exercitada por testes focados. |
| Riscos | Atendida com risco residual aceito | A ausência de ambos os headers não classifica navegador versus back-end; o risco está documentado no PRD, design e ADR-006. |

### Matriz de rastreabilidade da fase

| Requisito | Código | Teste | Evidência | Status |
| --------- | ------ | ----- | --------- | ------ |
| `AAP-20`, `AAP-23`, `AAP-24` | `cors-options.ts`, `main.ts` | `test/e2e/cors.e2e.spec.ts` | Allowlist exata, credenciais, métodos permitidos, `Content-Type` e preflight sem header customizado. | Comprovado |
| `AAP-21`, `AAP-22` | `auth-cookie.ts`, `csrf-protection.middleware.ts` | `test/e2e/csrf.e2e.spec.ts` e E2E das rotas mutáveis | `SameSite=Strict`; origem própria/allowlist passa; origem nula, malformada ou não autorizada retorna `403` antes do controller. | Comprovado |
| `AAP-60` | `csrf-protection.middleware.ts` | `test/e2e/csrf.e2e.spec.ts` | Mutação sem `Origin` e `Referer` continua o pipeline para o controller. | Comprovado |
| `EXPECT-03` | `auth-cookie.ts`, `AuthController` | `auth-cookie.spec.ts`, `login.e2e.spec.ts`, `logout.e2e.spec.ts` | Criação e expiração mantêm `HttpOnly`, `Secure` conforme ambiente, caminho raiz, duração e `SameSite=Strict`. | Comprovado |
| Remoção do contrato anterior | CORS, OpenAPI, controllers, consumidores e fixtures | `openapi.e2e.spec.ts`, `cors.e2e.spec.ts` e busca residual | Não há `X-CSRF-Protection` em `src`/`test` nem em contratos ativos; ocorrências em fases anteriores são evidência histórica identificada. | Comprovado |

### Critérios de aceitação da fase

| Critério | Evidência | Status |
| -------- | --------- | ------ |
| Login e logout publicam `SameSite=Strict` mantendo os demais atributos. | Testes unitários de fábrica e E2E de login/logout. | Atendido |
| Mutação com origem permitida ou própria passa sem header customizado. | E2E dedicado de CSRF/origem. | Atendido |
| Origem não autorizada, `null` ou malformada retorna `403` antes do controller. | Casos parametrizados do E2E dedicado e contador do controller. | Atendido |
| `Referer` permitido funciona apenas sem `Origin`; inválido/não autorizado retorna `403`. | E2E de fallback e precedência. | Atendido |
| Ausência simultânea é aceita; métodos seguros permanecem isentos. | E2E sem contexto e casos de `GET`, `HEAD` e `OPTIONS`. | Atendido |
| CORS e OpenAPI não anunciam o header removido. | E2E de CORS/OpenAPI e busca residual. | Atendido |
| Fase seguinte não começa antes do review. | Fase 08 está `Pendente` no plano e no estado. | Atendido |

### Achados

| ID | Severidade | Achado | Evidência | Impacto | Recomendação | Encaminhamento |
| -- | ---------- | ------ | --------- | ------- | ------------ | -------------- |
| A-04 | Baixo | A auditoria inicial encontrou a antiga Fase 07 de entrega no estado da implementação, apontando para arquivo inexistente após a renumeração. | `fases/IMPLEMENTATION-STATE.md` antes da correção; plano e diretório já usavam Fase 08. | Poderia induzir a próxima execução a iniciar a fase errada ou quebrar a navegação documental. | Corrigir o estado, atualizar o status da Fase 07 e validar os links. | Resolvido nesta execução; rechecado no review final. |

Não há achados abertos bloqueadores, altos, médios ou baixos após a correção.

### Riscos residuais e ressalvas aceitas

- A ausência simultânea de `Origin` e `Referer` é aceita para compatibilidade
  com Swagger, CLI e back-ends que usam cookie; isso deixa mutações sem contexto
  classificável como risco residual explicitamente aceito no PRD/design/ADR-006.
- Cookie com autenticação de back-end é compatibilidade transitória. API key,
  mTLS ou client credentials continuam adiados para uma decisão específica de
  integração máquina-a-máquina.
- `SameSite=Strict` pode impedir o envio do cookie em alguns fluxos iniciados
  externamente; o domínio web e a API devem permanecer no mesmo site registrável.
- A Fase 08 ainda precisa produzir e validar imagem, infraestrutura, CI e
  deploy/rollback; nenhum desses artefatos foi antecipado neste review.

### Resultado dos gates executados

| Comando | Resultado |
| ------- | --------- |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test -- --runInBand` | 35 suítes e 168 testes passaram |
| `npm run test:integration` | 3 suítes e 9 testes passaram |
| `npm run test:e2e` | 15 suítes e 91 testes passaram |
| `npm run build` | Passou |
| `git diff --check HEAD~2..HEAD` | Passou |

### Veredito

**Veredito:** Aprovado

**Fundamentação:** T34–T36 atendem ao PRD e à decisão `DEC-20`, os critérios
de aceitação da fase têm evidência automatizada e os gates oficiais passaram.
O único achado documental foi corrigido e revalidado. A Fase 08 permanece
pendente e não foi iniciada.

### Próxima ação

Marcar a Fase 07 como concluída — feito neste estado — e manter a Fase 08 como
próxima fase pendente; seu início pode ocorrer somente após esta aprovação.

### Histórico da avaliação mais recente

| Versão | Data | Escopo | Veredito | Resumo |
| ------ | ---- | ------ | -------- | ------ |
| 7 | 2026-09-04 | Fase 07 — Proteção CSRF por cookie e validação de origem | Aprovado | SameSite Strict, Origin/Referer, remoção do header, contratos e gates passaram; referência obsoleta do estado foi corrigida. |
| 6 | 2026-09-04 | Fase 06 — Rate limit e conformidade operacional da API | Aprovado | Fixed Window, políticas, OpenAPI e matriz de conformidade passaram os gates. |
| 5 | 2026-09-04 | Fase 05 — Paginação, atualização e exclusão de produtos | Aprovado | Cursor, listagem, atualização e exclusão passaram os gates; A-01/A-02 permaneceram informativos. |
| 4 | 2026-09-04 | Fase 04 — Criação e consulta de produtos | Aprovado | Domínio Product, persistência, `POST /products` e `GET /products/:id` passaram os gates. |
| 3 | 2026-09-04 | Fase 03 — Autenticação e proteção do cliente web | Aprovado | JWT HS256, cookie, login, logout e guard passaram os gates. |
| 2 | 2026-09-04 | Fase 02 — Cadastro seguro de usuários | Aprovado | Cadastro, Argon2id, persistência condicional, CORS/CSRF e OpenAPI passaram os gates. |
| 1 | 2026-09-04 | Fase 01 — Tracer bullet e fundação observável | Aprovado | Bootstrap, fronteiras, erros/correlação, DynamoDB Local e readiness passaram os gates. |

## Histórico detalhado — versão 6

## Artefatos analisados

- PRD: [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md)
- Design técnico: [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md)
- Plano: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)
- Fase: [fases/fase-06-rate-limit-conformidade.md](fases/fase-06-rate-limit-conformidade.md)
- Estado: [fases/IMPLEMENTATION-STATE.md](fases/IMPLEMENTATION-STATE.md)
- Convenções: `rules/README.md`, `rules/principios-de-design.md`, `rules/codigo-como-um-livro.md` e `rules/checklist-de-implementacao.md`
- Decisões reutilizadas: [ADR-001](../../docs/adr/ADR-001-clean-architecture-backend.md), [ADR-003](../../docs/adr/ADR-003-modelagem-dynamodb.md), [ADR-004](../../docs/adr/ADR-004-rate-limit.md) e [ADR-005](../../docs/adr/ADR-005-autenticacao-cookie-http-only.md)

## Resumo executivo

A Fase 06 foi revisada contra os artefatos aprovados, as regras do repositório,
as ADRs aplicáveis, a implementação e as evidências versionadas de T28–T33.
A entrega conecta Fixed Window em memória à API, resolve IP somente pela cadeia
de proxies configurada, aplica políticas por método/template antes dos handlers,
retorna `429` com `Retry-After`, documenta o contrato OpenAPI e adiciona matriz
automatizada dos 27 critérios do PRD.

Os gates oficiais passaram sem achados bloqueadores, altos ou médios. A política
da ADR-004 foi preservada integralmente. O design previa `@nestjs/throttler`,
mas a implementação usa componente próprio porque a versão disponível no
projeto NestJS 12 não é compatível; os testes comprovam a mesma semântica e o
desvio está documentado no estado.

## Resultado das verificações obrigatórias

| Verificação | Resultado | Evidência |
| ------------ | --------- | --------- |
| Requisitos | Atendida no recorte da fase | T28–T33 cobrem `AAP-23`, `AAP-24`, `AAP-50`–`AAP-57`, `EXPECT-01`–`EXPECT-08` e `EXPECT-11`; os demais requisitos permanecem cobertos pelas fases anteriores. |
| Critérios de aceitação | Atendida no recorte implementável | `429`, `Retry-After`, buckets independentes, preflight, OpenAPI e matriz 1–27 foram verificados. A imagem publicada permanece evidência operacional da Fase 07. |
| Testes | Atendida | 35 suítes/168 testes unitários, 3 suítes/9 testes de integração e 15 suítes/87 testes E2E passaram. |
| Design técnico | Atendida com desvio registrado | IP efetivo, Fixed Window, pipeline, erro comum, cookie/CSRF e OpenAPI seguem `DEC-02`, `DEC-03`, `DEC-05`, `DEC-12`, `DEC-13`, `DEC-18` e `DEC-19`; somente a biblioteca de integração foi substituída. |
| Plano | Atendida | T28–T33 estão concluídas, cada uma com teste dirigido, evidência no estado e commit. |
| Escopo | Atendida | Não foram introduzidos Redis, múltiplas instâncias, limite por usuário, Bearer, ordenação, BFF ou dados pessoais nas métricas. |
| Qualidade | Atendida | Lint, typecheck, testes unitários, integração, E2E, build e `git diff --check` passaram. |
| Padrões do projeto | Atendida | Resolução de IP e middleware ficam na borda; o armazenamento depende de `Clock`; controllers só descrevem o contrato; métricas não recebem IP. |
| Manutenibilidade | Atendida | Políticas, chave, armazenamento, métricas, filtro e matriz têm responsabilidades isoladas e testes focados. |
| Riscos | Atendida com ressalvas informativas | A-01/A-02 são herdados; A-03 registra a ausência de imagem/Dockerfile neste checkout e é encaminhado à Fase 07. |

## Matriz de rastreabilidade

| Requisito | Código | Teste | Evidência | Status |
| --------- | ------ | ----- | --------- | ------ |
| `AAP-23`, `AAP-24` | CORS existente, `rate-limit.middleware.ts` | `rate-limit.e2e.spec.ts`, `cors.e2e.spec.ts` | Preflight autorizado retorna antes do contador de negócio e não altera a janela da operação. | Comprovado |
| `AAP-50`, `AAP-54`, `AAP-55` | `RateLimitExceededError`, `ApiExceptionFilter` | `api-exception.filter.spec.ts`, `rate-limit.e2e.spec.ts` | Erro comum `429`, código estável, correlação e header `Retry-After` inteiro são retornados sem contador/IP no corpo. | Comprovado |
| `AAP-53` | `effective-client-ip.ts`, `rate-limit-policies.ts`, `in-memory-fixed-window-rate-limiter.ts`, `rate-limit.middleware.ts` | testes de resolvedor, políticas, armazenamento, middleware e E2E | Chave usa IP efetivo, método e template; os onze buckets da ADR-004 e o fallback são uma tabela única. | Comprovado |
| `AAP-56`, `AAP-57` | `setup-openapi.ts`, `api-rate-limit-response.ts`, decorators dos controllers | `openapi.e2e.spec.ts` e E2E de rotas | `/docs` e `/docs-json` estão disponíveis; seis caminhos/nove operações descrevem cookie, CSRF, DTOs, erros, `429` e `Retry-After`. | Comprovado |
| `AAP-58`, `AAP-59` | Health existente | `health.e2e.spec.ts`, matriz de conformidade | Readiness permanece 200 quando dependências estão disponíveis e 503 seguro quando uma tabela falta. | Comprovado |
| `EXPECT-01`, `EXPECT-02`, `EXPECT-04`, `EXPECT-07`, `EXPECT-08`, `EXPECT-11` | matriz e audit `test/conformance` | `acceptance-criteria.matrix.spec.ts`, `sensitive-artifacts.spec.ts`, gates completos | Cada critério 1–27 aponta para teste versionado; fontes de produção e placeholder de ambiente não contêm sentinelas sensíveis; execução é determinística. | Comprovado no checkout |

## Critérios de aceitação da fase

| Critério | Evidência | Status |
| -------- | --------- | ------ |
| Fixed Window, chave e ordem do pipeline coincidem com a ADR-004. | T28–T30 cobrem cadeia confiável, janela fixa, chave estruturada, políticas e ordem CORS → correlation → rate limit → CSRF → guards. | Atendido |
| Cada operação aceita seu limite e rejeita a próxima com `429` e `Retry-After`. | T30 testa o pipeline/fallback; a tabela unitária contém os limites exatos de cadastro, login, logout, Products, health e documentação; T31 valida resposta. | Atendido |
| IP, método e template produzem buckets independentes; IDs compartilham template. | T28/T29/T30 cobrem IP confiável, isolamento e normalização `/products/:id`. | Atendido |
| `OPTIONS` não autentica nem consome o bucket da operação real. | CORS E2E e rate-limit E2E validam preflight `204` antes do contador. | Atendido |
| OpenAPI UI/JSON e comportamento E2E descrevem o mesmo contrato. | T32 verifica caminhos, operações, cookie, ausência de Bearer, `429` e `Retry-After`; E2E existentes validam respostas. | Atendido |
| Todos os critérios do PRD têm evidência automatizada e não há vazamento sensível. | T33 mantém matriz 1–27, varredura de sentinelas, respostas/logs sanitizados existentes e gates completos; imagem publicada é Fase 07. | Atendido no checkout |

## Resultado dos gates executados

| Comando | Resultado |
| ------- | --------- |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test -- --runInBand` | 35 suítes e 168 testes passaram |
| `npm run test:integration` | 3 suítes e 9 testes passaram |
| `npm run test:e2e` | 15 suítes e 87 testes passaram |
| `npm run build` | Passou |
| `git diff --check` | Passou |

## Achados

| ID | Severidade | Achado | Evidência | Impacto | Recomendação | Encaminhamento |
| -- | ---------- | ------ | --------- | ------- | ------------ | ------------ |
| A-01 | Informativo | O DynamoDB Local continua executando como `root` para compatibilizar o volume nomeado. | Desvio T04 no estado e reviews anteriores. | Limitação somente do auxiliar local. | Reavaliar no endurecimento da infraestrutura. | `implement` — Fase 07. |
| A-02 | Informativo | O DynamoDB Local pode emitir `LastEvaluatedKey` após o último item da fixture. | Review v5 e `list-products.e2e.spec.ts`. | Pode exigir página terminal vazia em ambiente local; o contrato nativo é preservado. | Confirmar no DynamoDB gerenciado. | `review` — Fase 07. |
| A-03 | Informativo | Não há Dockerfile nem imagem publicada neste checkout para inspeção final. | `rg --files` não encontrou artefato de imagem; T34–T38 pertencem à Fase 07. | A varredura da imagem não pode ser afirmada nesta fase. | Executar scan e validação de usuário não privilegiado no artefato da Fase 07. | `implement` — Fase 07. |

Não foram identificados achados bloqueadores, altos ou médios na Fase 06.

## Riscos residuais e ressalvas aceitas

- O rate limit é em memória por instância; a topologia continua exigindo uma
  única instância até uma decisão futura de armazenamento distribuído.
- O trust proxy local aceita IPs explícitos, enquanto a cadeia Cloudflare →
  NGINX → NestJS será validada operacionalmente na Fase 07.
- A-01, A-02 e A-03 são informativos e não alteram o contrato funcional desta
  API; a ausência de imagem é uma limitação de entrega, não uma alegação de
  que o artefato publicado já foi validado.

## Veredito

**Veredito:** Aprovado
**Fundamentação:** T28–T33, os seis critérios de aceitação da Fase 06 e os
requisitos atribuídos à etapa possuem implementação e evidência objetiva no
checkout. Os gates oficiais passaram; o desvio de biblioteca é compatível com
NestJS 12 e semanticamente coberto; as ressalvas operacionais estão claramente
encaminhadas à Fase 07.

## Próxima ação

Marcar a Fase 06 como `Concluída` e manter a Fase 07 como `Pendente`, sem
iniciar sua implementação nesta solicitação.

## Histórico de revisões anteriores

| Versão | Data | Escopo | Veredito | Resumo |
| ------ | ---- | ------ | -------- | ------ |
| 5 | 2026-09-04 | Fase 05 — Paginação, atualização e exclusão de produtos | Aprovado | Cursor, listagem, atualização e exclusão passaram os gates; A-01/A-02 permaneceram informativos. |
| 4 | 2026-09-04 | Fase 04 — Criação e consulta de produtos | Aprovado | Domínio Product, persistência, `POST /products` e `GET /products/:id` passaram os gates. |
| 3 | 2026-09-04 | Fase 03 — Autenticação e proteção do cliente web | Aprovado | JWT HS256, cookie, login, logout e guard passaram os gates. |
| 2 | 2026-09-04 | Fase 02 — Cadastro seguro de usuários | Aprovado | Cadastro, Argon2id, persistência condicional, CORS/CSRF e OpenAPI passaram os gates. |
| 1 | 2026-09-04 | Fase 01 — Tracer bullet e fundação observável | Aprovado | Bootstrap, fronteiras, erros/correlação, DynamoDB Local e readiness passaram os gates. |
