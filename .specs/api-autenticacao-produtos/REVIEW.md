# Review — API de cadastro, autenticação e catálogo de produtos

| Status       | Aprovado |
| ------------ | -------- |
| Created      | 2026-09-04 |
| Last Updated | 2026-09-04 |

**Escopo revisado:** fase 02 — Cadastro seguro de usuários<br>
**Versão da avaliação:** 2

## Artefatos analisados

- PRD: [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md) | Design técnico: [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md)
- Plano: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)
- Fase: [fases/fase-02-cadastro-usuarios.md](fases/fase-02-cadastro-usuarios.md)
- Estado: [fases/IMPLEMENTATION-STATE.md](fases/IMPLEMENTATION-STATE.md)
- Convenções: `rules/README.md`, `rules/principios-de-design.md`, `rules/codigo-como-um-livro.md` e `rules/checklist-de-implementacao.md`
- Decisões reutilizadas: [ADR-001](../../docs/adr/ADR-001-clean-architecture-backend.md), [ADR-002](../../docs/adr/ADR-002-cadastro-de-usuarios.md), [ADR-003](../../docs/adr/ADR-003-modelagem-dynamodb.md), [ADR-004](../../docs/adr/ADR-004-rate-limit.md) e [ADR-005](../../docs/adr/ADR-005-autenticacao-cookie-http-only.md).

## Resumo executivo

A Fase 02 foi revisada de forma independente contra o PRD, o design técnico,
o plano, as regras do repositório, as ADRs aplicáveis e o resultado versionado.
As tarefas T06–T12 implementam o cadastro seguro ponta a ponta: invariantes de
domínio, hash Argon2id, unicidade condicional no DynamoDB, caso de uso,
CORS/CSRF, contrato HTTP, erros sanitizados e OpenAPI.

Os critérios da fase possuem evidência unitária, de integração e E2E. Os gates
obrigatórios passaram sem achados bloqueadores ou altos. A Fase 03 permanece
`Pendente` por solicitação do usuário e não foi iniciada.

## Resultado das verificações obrigatórias

| Verificação | Resultado | Evidência |
| ------------ | --------- | --------- |
| Requisitos | Atendida no recorte da fase | Matriz abaixo cobre `AAP-01`–`AAP-09`, `AAP-20`–`AAP-24`, `AAP-50`–`AAP-52` e as parcelas de `EXPECT-01`–`EXPECT-04`, `EXPECT-06`–`EXPECT-08` previstas para T06–T12. |
| Critérios de aceitação | Atendida | Cadastro válido, normalização, limites, concorrência, duplicidade e ausência de autenticação foram exercitados. |
| Testes | Atendida | `npm test -- --runInBand`: 17 suítes/52 testes; integração: 2 suítes/3 testes; E2E: 5 suítes/28 testes. |
| Design técnico | Atendida | Domínio sem dependência de framework, portas para hash/persistência/tempo/ID, adaptador DynamoDB isolado, composição NestJS e serialização pública seguem `DEC-01`, `DEC-02`, `DEC-05`, `DEC-06`, `DEC-10`, `DEC-11`, `DEC-13` e `DEC-14`. |
| Plano | Atendida | T06–T12 estão concluídas e possuem evidências na fase e no estado da implementação. |
| Escopo | Atendida | Somente a Fase 02 foi implementada; login, JWT/cookie, produtos, rate limit e entrega operacional continuam nas fases previstas. |
| Qualidade | Atendida | `npm run lint` e `npm run typecheck` passaram sem warnings ou erros. |
| Padrões do projeto | Atendida | Camadas explícitas, dependências externas nas bordas, controllers sem regra de negócio e testes por nível seguem as regras lidas. |
| Manutenibilidade | Atendida | Portas são específicas aos consumidores; o formato DynamoDB não atravessa o adaptador e a resposta pública não reutiliza o item persistido. |
| Riscos | Atendida com riscos residuais informativos | O custo de Argon2id, o `user: "0:0"` do DynamoDB Local e a ausência intencional de rate limit/autenticação nesta etapa estão documentados e encaminhados às fases corretas. |

## Matriz de rastreabilidade

| Requisito | Código | Teste | Evidência | Status |
| --------- | ------ | ----- | --------- | ------ |
| `AAP-01` | `src/modules/auth/presentation/auth.controller.ts`, `src/modules/auth/application/register-user/register-user.ts` | `test/e2e/register-user.e2e.spec.ts` | Visitante envia nome, e-mail e senha e recebe `201` com conta criada. | Comprovado |
| `AAP-02` | `src/modules/auth/domain/user.ts`, `src/modules/auth/presentation/register-user.dto.ts` | `src/modules/auth/domain/user.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Nome entre 2 e 100 caracteres após normalização; limites inferior e superior inválidos retornam `400`. | Comprovado |
| `AAP-03` | `src/modules/auth/domain/user.ts`, `src/modules/auth/presentation/register-user.dto.ts` | `src/modules/auth/domain/user.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Senha entre 8 e 128 caracteres; limites inválidos são rejeitados antes da persistência. | Comprovado |
| `AAP-04` | `src/modules/auth/domain/email.ts`, `src/modules/auth/presentation/register-user.dto.ts` | `src/modules/auth/domain/email.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Espaços externos são removidos antes do uso e o e-mail persistido/retornado é normalizado. | Comprovado |
| `AAP-05` | `src/modules/auth/domain/email.ts` | `src/modules/auth/domain/email.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | E-mail é convertido para minúsculas antes da busca de unicidade e da escrita. | Comprovado |
| `AAP-06` | `src/modules/auth/domain/email.ts`, `src/modules/auth/presentation/register-user.dto.ts` | `src/modules/auth/domain/email.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Formato inválido retorna `400 VALIDATION_ERROR` sem valor recebido na resposta ou no log. | Comprovado |
| `AAP-07` | `src/modules/auth/infrastructure/persistence/dynamodb-user.repository.ts` | `src/modules/auth/infrastructure/persistence/dynamodb-user.repository.spec.ts`, `test/integration/users.integration.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | `PutCommand` usa `attribute_not_exists(email)`; concorrência cria uma única conta e duplicidade retorna `409 EMAIL_ALREADY_EXISTS`. | Comprovado |
| `AAP-08` | `src/modules/auth/domain/user.ts`, `src/modules/auth/presentation/register-user.response.dto.ts` | `test/e2e/register-user.e2e.spec.ts` | Resposta `201` contém somente `id`, `name` e `email`. | Comprovado |
| `AAP-09` | `src/modules/auth/application/register-user/register-user.ts`, `src/modules/auth/presentation/auth.controller.ts` | `src/modules/auth/application/register-user/register-user.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Cadastro não importa autenticação, não emite JWT e não envia `Set-Cookie`. | Comprovado |
| `AAP-20` | `src/shared/presentation/http/cors-options.ts` | `test/e2e/cors.e2e.spec.ts` | Allowlist exata, credenciais, métodos, cabeçalhos e `Retry-After` são aplicados somente para origem autorizada. | Comprovado |
| `AAP-21` | `src/shared/presentation/http/csrf-protection.middleware.ts`, `src/app.module.ts` | `test/e2e/csrf.e2e.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Mutações sem `X-CSRF-Protection: 1` retornam `403 REQUEST_FORBIDDEN` antes do controller e da escrita. | Comprovado |
| `AAP-22` | `src/shared/presentation/http/csrf-protection.middleware.ts` | `test/e2e/csrf.e2e.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Origem não autorizada é rejeitada mesmo com CSRF válido; origem própria exata e allowlist são aceitas. | Comprovado |
| `AAP-23` | `src/shared/presentation/http/cors-options.ts` | `test/e2e/cors.e2e.spec.ts` | Preflight autorizado termina com `204` sem autenticação nem controller. | Comprovado |
| `AAP-24` | `src/shared/presentation/http/cors-options.ts` | `test/e2e/cors.e2e.spec.ts` | Preflight autorizado é tratado pela política CORS antes do fluxo de negócio; a conexão ao bucket de rate limit será revalidada quando a política for implementada na Fase 06. | Comprovado no recorte da fase |
| `AAP-50` | `src/shared/presentation/errors/api-exception.filter.ts`, `src/shared/application/errors/application-error.ts` | `test/e2e/errors.e2e.spec.ts`, `test/e2e/csrf.e2e.spec.ts`, `test/e2e/register-user.e2e.spec.ts` | Erros de validação, conflito e proteção retornam status, código estável, mensagem segura e correlação. | Comprovado |
| `AAP-51` | `src/shared/presentation/validation/public-validation.pipe.ts`, DTOs Auth | `test/e2e/register-user.e2e.spec.ts` | `400 VALIDATION_ERROR` identifica somente os campos públicos afetados. | Comprovado |
| `AAP-52` | `src/shared/presentation/validation/public-validation.pipe.ts`, `src/shared/presentation/logging/request-logging.interceptor.ts` | `test/e2e/register-user.e2e.spec.ts`, busca negativa nos testes e logs | Valores de senha, hash e campos desconhecidos não atravessam resposta nem logs. | Comprovado |
| `EXPECT-01` | `src/modules/auth/infrastructure/security/argon2-password-hasher.ts`, `src/modules/auth/infrastructure/persistence/dynamodb-user.repository.ts` | `argon2-password-hasher.spec.ts`, `users.integration.spec.ts`, `register-user.e2e.spec.ts` | Argon2id com parâmetros explícitos é persistido; senha em texto puro não é persistida. | Comprovado |
| `EXPECT-02` | `src/modules/auth/domain/user.ts`, serializador e filtro global | `register-user.e2e.spec.ts`, `errors.e2e.spec.ts` | Resposta, URL e logs exercitados não expõem senha, hash, JWT ou credenciais. | Comprovado |
| `EXPECT-03` | `src/shared/presentation/http/cors-options.ts`, `src/shared/presentation/http/csrf-protection.middleware.ts` | `cors.e2e.spec.ts`, `csrf.e2e.spec.ts`, `register-user.e2e.spec.ts` | A parcela de proteção de origem/CORS/CSRF prevista na Fase 02 foi comprovada; cookie de autenticação será implementado e revisado na Fase 03. | Parcela da fase comprovada |
| `EXPECT-04` | `src/shared/presentation/errors/api-exception.filter.ts`, `src/shared/presentation/logging/request-logging.interceptor.ts` | `errors.e2e.spec.ts`, `register-user.e2e.spec.ts` | Mensagens não expõem stack, SDK, valores recebidos ou detalhe de infraestrutura. | Comprovado |
| `EXPECT-06` | `src/shared/presentation/openapi/setup-openapi.ts`, DTOs e decorators Auth | `test/e2e/register-user.e2e.spec.ts` | `/docs` e `/docs-json` descrevem entrada, `201`, `400`, `403`, `409` e o cabeçalho CSRF. | Comprovado no recorte da fase |
| `EXPECT-07` | `src/shared/application/ports`, fakes de teste, integração e E2E isolados | Suítes unitária, integração e E2E | Dependências externas são injetadas; tabelas e nomes usam isolamento por processo; execução foi determinística. | Comprovado |
| `EXPECT-08` | `package.json`, configurações Jest/TypeScript/ESLint e `compose.yaml` | Gates abaixo | Lint, tipos, testes, build, Compose e diff concluíram com código 0. | Comprovado |

## Critérios de aceitação da fase

| Critério | Evidência | Status |
| -------- | --------- | ------ |
| Cadastro válido retorna `201` apenas com `id`, `name` e e-mail normalizado. | E2E de cadastro válido e inspeção do corpo HTTP. | Atendido |
| Limites e formato de nome, e-mail e senha são aplicados conforme o PRD. | Testes de domínio e seis cenários E2E inválidos. | Atendido |
| Cadastros concorrentes equivalentes não criam duas contas. | Integração com duas escritas concorrentes e condição DynamoDB. | Atendido |
| Duplicidade retorna `409 EMAIL_ALREADY_EXISTS` sem alterar o registro existente. | Unitário do adaptador e E2E com e-mail normalizado. | Atendido |
| Nenhuma execução cria autenticação ou expõe senha/hash. | E2E sem `Set-Cookie`, corpo público, item persistido e logs sanitizados. | Atendido |

## Resultado dos gates executados

| Comando | Resultado |
| ------- | --------- |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm test -- --runInBand` | 17 suítes e 52 testes passaram |
| `DYNAMODB_ENDPOINT=http://localhost:8000 AWS_REGION=us-east-1 npm run test:integration -- --runInBand` | 2 suítes e 3 testes passaram |
| `DYNAMODB_ENDPOINT=http://localhost:8000 AWS_REGION=us-east-1 npm run test:e2e -- --runInBand` | 5 suítes e 28 testes passaram |
| `npm run build` | Passou |
| `docker compose config` | Passou; configuração renderizada sem erro |
| `git diff --check` | Passou |

## Achados

| ID | Severidade | Achado | Evidência | Impacto | Recomendação | Encaminhamento |
| -- | ---------- | ------ | --------- | ------- | ------------ | -------------- |
| A-01 | Informativo | O serviço local do DynamoDB Compose executa como `root` para permitir escrita no volume nomeado criado pela imagem. | `compose.yaml` e desvio documentado em T04 no estado da implementação. | O ambiente local não reproduz execução sem privilégios para o banco de desenvolvimento; não afeta o contrato da API nem a aplicação publicada nesta fase. | Reavaliar imagem/volume com ownership compatível quando a infraestrutura local for endurecida. | `implement` — acompanhar na Fase 07; não bloqueia a Fase 02. |

## Riscos residuais e ressalvas aceitas

- Login, JWT, cookie `__Host-stone_access_token` e logout não fazem parte da Fase
  02. Permanecem deliberadamente pendentes para a Fase 03.
- O rate limit do cadastro e o comportamento completo de buckets/preflight serão
  conectados e revalidados na Fase 06, conforme a ADR-004.
- Argon2id usa recursos relevantes; os parâmetros estão explícitos e foram
  exercitados, mas a calibração sob carga publicada pertence à validação
  operacional posterior.
- O Compose local mantém o desvio `user: "0:0"` descrito em A-01. O risco é
  local, documentado e não impede a aprovação da fase.

## Veredito

**Veredito:** Aprovado  
**Fundamentação:** todas as tarefas T06–T12, os critérios de aceitação da Fase
02 e a parcela dos requisitos prevista para esta etapa possuem implementação e
evidência objetiva. Os gates automatizados passaram e não há achado bloqueador
ou alto. As capacidades ausentes — autenticação por cookie, rate limit e
entrega operacional — estão no plano das fases posteriores e não são falhas da
Fase 02.

## Próxima ação

Marcar a Fase 02 como `Concluída` no estado da implementação. Manter a Fase 03
como `Pendente` e não iniciar sua preparação ou execução sem nova instrução do
usuário.

## Histórico de revisões anteriores

| Versão | Data | Escopo | Veredito | Resumo |
| ------ | ---- | ------ | -------- | ------ |
| 1 | 2026-09-04 | Fase 01 — Tracer bullet e fundação observável | Aprovado | Bootstrap, fronteiras, erros/correlação, DynamoDB Local e readiness passaram os gates; A-01 registrou o usuário `root` somente no DynamoDB Local. A Fase 01 foi encerrada e a Fase 02 iniciada conforme a ordem do plano. |
