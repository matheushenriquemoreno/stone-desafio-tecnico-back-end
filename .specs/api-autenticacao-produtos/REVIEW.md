# Review — API de cadastro, autenticação e catálogo de produtos

| Status       | Aprovado |
| ------------ | -------- |
| Created      | 2026-09-04 |
| Last Updated | 2026-09-04 |

**Escopo revisado:** fase 03 — Autenticação e proteção do cliente web
**Versão da avaliação:** 3

## Artefatos analisados

- PRD: [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md) | Design técnico: [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md)
- Plano: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)
- Fase: [fases/fase-03-autenticacao-protecao-web.md](fases/fase-03-autenticacao-protecao-web.md)
- Estado: [fases/IMPLEMENTATION-STATE.md](fases/IMPLEMENTATION-STATE.md)
- Convenções: `rules/README.md`, `rules/principios-de-design.md`, `rules/codigo-como-um-livro.md` e `rules/checklist-de-implementacao.md`
- Decisões reutilizadas: [ADR-001](../../docs/adr/ADR-001-clean-architecture-backend.md), [ADR-002](../../docs/adr/ADR-002-cadastro-de-usuarios.md), [ADR-004](../../docs/adr/ADR-004-rate-limit.md) e [ADR-005](../../docs/adr/ADR-005-autenticacao-cookie-http-only.md)

## Resumo executivo

A Fase 03 foi revisada contra os artefatos aprovados, as regras do repositório,
as ADRs aplicáveis e o resultado versionado das tarefas T13–T17. A implementação
entrega emissão/verificação JWT HS256 com claims mínimas, autenticação por cookie,
logout idempotente e guard reutilizável que aceita somente o cookie configurado.
Os gates oficiais passaram sem achados bloqueadores ou altos; a aplicação do
guard será revalidada quando as rotas Products forem criadas na Fase 04.

## Resultado das verificações obrigatórias

| Verificação | Resultado | Evidência |
| ------------ | --------- | --------- |
| Requisitos | Atendida no recorte da fase | Matriz cobre `AAP-10`–`AAP-24`, `AAP-50` e as parcelas de `EXPECT-02`–`EXPECT-08` e `EXPECT-11` atribuídas a T13–T17. |
| Critérios de aceitação | Atendida | Login válido/inválido, logout nos quatro estados, cookie, CSRF/CORS e guard com rejeição de Bearer foram exercitados. |
| Testes | Atendida | 20 suítes/69 testes unitários, 2 suítes/3 testes de integração e 8 suítes/43 testes E2E passaram. |
| Design técnico | Atendida | Portas de token, relógio controlado, adaptadores em infraestrutura, Passport na apresentação, cookie centralizado e ausência de sessão seguem `DEC-01`–`DEC-05`, `DEC-11`, `DEC-13` e `DEC-14`. |
| Plano | Atendida | T13–T17 estão concluídas e possuem evidência no estado e no arquivo da fase. |
| Escopo | Atendida | Não foram introduzidos Bearer, refresh token, sessão, revogação, papéis ou endpoint intermediário. |
| Qualidade | Atendida | `npm run lint`, `npm run typecheck` e `npm run build` passaram. |
| Padrões do projeto | Atendida | Domínio/aplicação não importam framework, HTTP, persistência ou JWT; controllers apenas traduzem o contrato. |
| Manutenibilidade | Atendida | A política de cookie é única para criação/expiração e a validação JWT fica atrás de uma porta específica. |
| Riscos | Atendida com riscos residuais informativos | O guard será aplicado e revalidado nas rotas Products da Fase 04; limitações de escala e do DynamoDB Local permanecem documentadas. |

## Matriz de rastreabilidade

| Requisito | Código | Teste | Evidência | Status |
| --------- | ------ | ----- | --------- | ------ |
| `AAP-10` | `auth/application/authenticate-user/authenticate-user.ts` | `authenticate-user.spec.ts`, `login.e2e.spec.ts` | E-mail normalizado, senha verificada e token emitido somente no sucesso. | Comprovado |
| `AAP-11` | `auth/infrastructure/security/jsonwebtoken-access-token.service.ts` | `jsonwebtoken-access-token.service.spec.ts` | Claims `iat`/`exp` possuem diferença exata de 900 segundos. | Comprovado |
| `AAP-12`–`AAP-13` | `auth/presentation/auth.controller.ts`, `auth-cookie.ts` | `login.e2e.spec.ts`, `auth-cookie.spec.ts` | Login retorna `204`, corpo vazio e um único cookie HttpOnly; o JWT não aparece no corpo. | Comprovado |
| `AAP-14`–`AAP-15` | `auth/application/errors/invalid-credentials.error.ts`, `AuthenticateUser` | `authenticate-user.spec.ts`, `login.e2e.spec.ts` | Conta ausente, senha incorreta e hash inválido usam o mesmo `INVALID_CREDENTIALS`; erro não cria cookie. | Comprovado |
| `AAP-16`–`AAP-17` | `auth/presentation/auth.controller.ts`, `auth-cookie.ts` | `logout.e2e.spec.ts`, `auth-cookie.spec.ts` | Cookie válido, inválido, expirado e ausente retornam `204` e `Max-Age=0`. | Comprovado |
| `AAP-18`–`AAP-19` | `auth/presentation/cookie-access-token.strategy.ts`, `access-token.guard.ts` | `access-token-guard.e2e.spec.ts` | Guard aceita cookie JWT válido e recusa ausência, formato inválido, assinatura inválida e expiração; aplicação em Products será revalidada na Fase 04. | Comprovado no recorte da fase |
| `AAP-20`–`AAP-24` | `shared/presentation/http/cors-options.ts`, `csrf-protection.middleware.ts` | `cors.e2e.spec.ts`, `csrf.e2e.spec.ts`, E2E Auth | Allowlist exata, credenciais, preflight sem autenticação e CSRF literal funcionam; rate limit será conectado na Fase 06. | Comprovado no recorte da fase |
| `AAP-50`–`AAP-52` | `shared/presentation/errors`, `PublicValidationPipe` | `errors.e2e.spec.ts`, `login.e2e.spec.ts`, `logout.e2e.spec.ts` | Erros têm status/código/mensagem/correlação; credenciais e tokens não entram nas respostas. | Comprovado |
| `EXPECT-02`–`EXPECT-05` | `jsonwebtoken-access-token.service.ts`, `auth-cookie.ts`, controllers e filtro global | `jsonwebtoken-access-token.service.spec.ts`, `login.e2e.spec.ts`, `access-token-guard.e2e.spec.ts` | Claims não contêm dados pessoais/segredo; cookie é HttpOnly, SameSite e host-only; não há sessão. | Comprovado |
| `EXPECT-06` | `setup-openapi.ts`, decorators Auth | `login.e2e.spec.ts`, `logout.e2e.spec.ts` | `/docs-json` descreve login, logout, respostas e esquema de cookie. | Comprovado no recorte da fase |
| `EXPECT-07`–`EXPECT-08` | Portas `Clock`/token, configurações e testes por nível | Gates completos abaixo | Relógio e dependências são controláveis; lint, tipos, testes e build passam. | Comprovado |
| `EXPECT-11` | `RequestLoggingInterceptor`, `ConsoleRequestLogger` | E2E Auth e inspeção dos logs produzidos | Logs registram metadados/correlação sem JWT, senha, hash ou cabeçalho de autenticação. | Comprovado |

## Critérios de aceitação da fase

| Critério | Evidência | Status |
| -------- | --------- | ------ |
| Login válido cria somente o cookie aprovado por 900 segundos e retorna `204` sem corpo. | `login.e2e.spec.ts` verifica status, corpo, `Max-Age=900`, `HttpOnly`, `SameSite=Lax`, `Path=/` e ausência de `Domain`. | Atendido |
| Login inválido é indistinguível quanto à existência da conta e não cria cookie. | `AuthenticateUser` e E2E cobrem conta ausente, senha incorreta e hash inválido com `INVALID_CREDENTIALS`; erro HTTP não envia cookie. | Atendido |
| Logout é idempotente e expira o cookie com escopo simétrico. | `logout.e2e.spec.ts` cobre cookie válido, inválido, expirado e ausente com `204` e `Max-Age=0`. | Atendido |
| Rotas de produtos aceitam apenas cookie JWT válido e recusam Bearer, ausência, invalidade e expiração. | `access-token-guard.e2e.spec.ts` comprova o guard reutilizável em rota protegida de probe; a aplicação nos controllers Products será verificada na Fase 04. | Atendido no recorte da fase |
| CORS, preflight e CSRF funcionam sem criar sessão ou endpoint intermediário. | Suítes CORS/CSRF e endpoints Auth comprovam allowlist, preflight, proteção e consumo direto da API. | Atendido |

## Resultado dos gates executados

| Comando | Resultado |
| ------- | --------- |
| `npm ci` | Passou; 580 pacotes instalados, 0 vulnerabilidades reportadas |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test` | 20 suítes e 69 testes passaram |
| `npm run test:integration` | 2 suítes e 3 testes passaram |
| `npm run test:e2e` | 8 suítes e 43 testes passaram |
| `npm run build` | Passou |
| `git diff --check` | Passou |

## Achados

| ID | Severidade | Achado | Evidência | Impacto | Recomendação | Encaminhamento |
| -- | ---------- | ------ | --------- | ------- | ------------ | -------------- |
| A-01 | Informativo | O DynamoDB Local continua executando como `root` para compatibilizar o volume nomeado. | Desvio T04 no estado da implementação e review anterior. | Limitação somente do auxiliar local; não altera a aplicação publicada nem os contratos desta fase. | Reavaliar no endurecimento da infraestrutura da Fase 07. | `implement` — acompanhar na Fase 07. |
| A-02 | Informativo | A aplicação do guard nas rotas reais de Products ainda depende da criação desses controllers. | `access-token-guard.e2e.spec.ts` usa probe protegido; T20/T21 da Fase 04 criam as primeiras rotas Products. | A semântica do guard está comprovada, mas a cobertura de todas as rotas deve ser confirmada no próximo gate. | Usar `AccessTokenGuard` em todo controller Products e repetir ausência/Bearer/expiração no E2E da Fase 04. | `implement` — revalidar na Fase 04; não bloqueia esta fase. |

## Riscos residuais e ressalvas aceitas

- O TTL publicado exige `JWT_ACCESS_TTL_SECONDS=900`; a configuração de
  produção e o teste correspondente impedem valor diferente.
- O logout remove o cookie, mas não revoga cópias do JWT antes da expiração,
  limitação aceita na ADR-005.
- O rate limit continua fora desta fase e será conectado conforme a ADR-004 na
  Fase 06.
- O guard será revalidado nas rotas concretas do catálogo antes do encerramento
  da Fase 04.

## Veredito

**Veredito:** Aprovado  
**Fundamentação:** T13–T17, os critérios de aceitação da Fase 03 e as parcelas
de requisitos atribuídas a esta etapa possuem implementação e evidência
objetiva. Os gates oficiais passaram; A-01 e A-02 são informativos, não há
achado bloqueador ou alto e as pendências explicitamente pertencem às fases
seguintes.

## Próxima ação

Marcar a Fase 03 como `Concluída` e iniciar a Fase 04 em T18. Reaplicar o guard
nas rotas Products e repetir sua cobertura no review da Fase 04.

## Histórico de revisões anteriores

| Versão | Data | Escopo | Veredito | Resumo |
| ------ | ---- | ------ | -------- | ------ |
| 2 | 2026-09-04 | Fase 02 — Cadastro seguro de usuários | Aprovado | Cadastro, Argon2id, persistência condicional, CORS/CSRF e OpenAPI passaram os gates. |
| 1 | 2026-09-04 | Fase 01 — Tracer bullet e fundação observável | Aprovado | Bootstrap, fronteiras, erros/correlação, DynamoDB Local e readiness passaram os gates; A-01 registrou o usuário `root` somente no DynamoDB Local. |
