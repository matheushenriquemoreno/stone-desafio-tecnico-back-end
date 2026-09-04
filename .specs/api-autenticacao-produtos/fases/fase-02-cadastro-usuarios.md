# Fase 02 — Cadastro seguro de usuários

| Status       | Concluída |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-04 |

**Objetivo e resultado esperado:** permitir que um visitante crie uma conta única com dados normalizados, senha protegida e resposta estritamente pública, sem autenticação automática.

**Capacidade ou fluxo coberto:** `POST /auth/register` do DTO HTTP até a escrita condicional em `users`, incluindo validações, Argon2id, erros seguros e OpenAPI.

**Requisitos relacionados:** `AAP-01`–`AAP-09`, `AAP-20`–`AAP-24`, `AAP-50`–`AAP-52`, `EXPECT-01`–`EXPECT-04`, `EXPECT-06`–`EXPECT-08`.

**Dependências externas:** DynamoDB Local da Fase 01.

## Tarefa T06 — Modelar usuário, e-mail normalizado e invariantes de cadastro

Criar o domínio Auth com usuário e value objects/funções que validem nome entre 2 e 100 caracteres, senha entre 8 e 128, remoção de espaços externos e conversão do e-mail para minúsculas antes da validação de formato. A senha em texto puro deve existir somente como entrada transitória do caso de uso e nunca integrar a entidade persistível.

- **Requisitos relacionados:** `AAP-01`–`AAP-06`, `AAP-09`, `EXPECT-01`, `EXPECT-02`.
- **Referência ao design:** `DEC-01`, `DEC-11`; matriz de dados da tabela `users`.
- **Dependências:** `T02`.
- **Parte do sistema afetada:** `src/auth/domain`, erros de domínio e testes unitários.
- **Testes e verificações:** tabelas de casos-limite para nome e senha; e-mails com espaços/maiúsculas, formatos inválidos e equivalência após normalização; teste de que objetos/erros não serializam senha.
- **Critérios de conclusão:** todas as invariantes do cadastro são independentes de NestJS; normalização acontece antes da validação e da comparação; limites inclusivos e inválidos estão cobertos.
- **Riscos ou premissas:** normalizar nome significa apenas o tratamento já aprovado na fronteira, sem inventar transformação cultural ou colapso de caracteres.

### Evidência de execução T06

- `npm run lint` — concluído sem erros, incluindo as fronteiras das camadas
  internas.
- `npm run typecheck` — concluído com TypeScript estrito.
- `npm test -- --runInBand` — concluído; 14 suítes e 39 testes aprovados,
  incluindo limites inclusivos de nome e senha, normalização de e-mail e
  serialização pública segura do usuário.
- `npm run build` — concluído.
- `git diff --check` — concluído sem erros.
- O domínio Auth não importa NestJS, HTTP, AWS SDK, JWT ou Argon2; a senha
  em texto puro não aparece em `User` e o `toJSON` expõe apenas `id`, `name` e
  e-mail.

## Tarefa T07 — Implementar hash Argon2id por porta

Definir a porta de hash de senha e seu adaptador Argon2id, com criação e verificação de hash. Parâmetros devem ser configurados explicitamente, adequados ao ambiente demonstrativo e substituíveis nos testes sem reduzir a regra de produção.

- **Requisitos relacionados:** `AAP-03`, `AAP-10`, `EXPECT-01`, `EXPECT-02`, `EXPECT-07`.
- **Referência ao design:** `DEC-11`, seção “Segurança”.
- **Dependências:** `T01`, `T06`.
- **Parte do sistema afetada:** porta na aplicação Auth, adaptador Argon2id, configuração e testes unitários.
- **Testes e verificações:** hash difere da senha e usa variante Argon2id; verificação aceita senha correta e recusa incorreta; logs e mensagens de erro não contêm entrada nem hash.
- **Critérios de conclusão:** somente o hash deixa a fronteira do adaptador; parâmetros não dependem de relógio ou espera real nos testes; nenhuma senha ou hash aparece em saída pública.
- **Riscos ou premissas:** calibrar parâmetros sem criar uma meta de latência inexistente no PRD; registrar os valores adotados no código/configuração.

### Evidência de execução T07

- `npm test -- --runInBand src/modules/auth/infrastructure/security/argon2-password-hasher.spec.ts` — concluído; 1 suíte e 3 testes aprovados.
- O adaptador produz hashes na variante `Argon2id` com parâmetros explícitos
  `memoryCost=19456`, `timeCost=2` e `parallelism=1`; o teste confirma o
  formato e a verificação da senha correta.
- A verificação da senha incorreta e de hash malformado retorna `false`, sem
  exceção pública com entrada, hash ou detalhe interno.
- `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` —
  concluídos sem erros.
- A aplicação depende da porta `PasswordHasher`; Argon2id aparece somente no
  adaptador de infraestrutura e não nas camadas internas.

## Tarefa T08 — Persistir usuários com unicidade atômica

Definir uma porta específica `UserRepository` e implementar o adaptador DynamoDB para `PutItem` condicional por e-mail normalizado e `GetItem` para autenticação futura. Mapear somente a falha de condição para conflito de e-mail e tratar demais falhas como erro interno sanitizado.

- **Requisitos relacionados:** `AAP-07`, `EXPECT-01`, `EXPECT-02`, `EXPECT-07`.
- **Referência ao design:** `DEC-06`, `DEC-10`; seção “Tabela users”.
- **Dependências:** `T04`, `T06`.
- **Parte do sistema afetada:** porta de repositório Auth, mapeador de usuário, adaptador DynamoDB e testes de integração.
- **Testes e verificações:** integração real com DynamoDB Local para criar, buscar e disputar cadastros do mesmo e-mail normalizado; inspecionar item persistido e confirmar ausência de senha em texto puro.
- **Critérios de conclusão:** `attribute_not_exists(email)` elimina janela de corrida; item contém apenas `email`, `id`, `name`, `passwordHash` e `createdAt`; falhas técnicas não viram falso conflito.
- **Riscos ou premissas:** a chave por e-mail normalizado é a decisão aprovada; não criar índice ou tabela adicional.

### Evidência de execução T08

- `npm test -- --runInBand src/modules/auth/infrastructure/persistence/dynamodb-user.repository.spec.ts` — concluído; 1 suíte e 4 testes unitários aprovados para escrita, conflito condicional, falha técnica e leitura.
- `npm run test:integration -- --runInBand` com DynamoDB Local — concluído; 2 suítes e 3 testes aprovados, incluindo persistência/leitura, inspeção do item e disputa concorrente pelo mesmo e-mail normalizado.
- A escrita usa `PutCommand` com `attribute_not_exists(email)` e o item contém
  somente `email`, `id`, `name`, `passwordHash` e `createdAt`; a senha em texto
  puro não é persistida.
- Somente `ConditionalCheckFailedException` é convertido em
  `EmailAlreadyExistsError`; falhas técnicas são propagadas para o mapeamento
  global de erro.
- `npm run lint`, `npm run typecheck`, `npm test` (16 suítes/46 testes),
  `npm run build` e `git diff --check` — concluídos sem erros.

## Tarefa T09 — Orquestrar o caso de uso RegisterUser

Implementar `RegisterUser` para validar e normalizar a entrada, gerar ID e instante, criar o hash e solicitar a escrita condicional. O resultado do caso de uso deve conter somente `id`, `name` e `email`; nenhum token ou cookie é emitido.

- **Requisitos relacionados:** `AAP-01`, `AAP-04`, `AAP-05`, `AAP-07`–`AAP-09`, `EXPECT-01`, `EXPECT-05`.
- **Referência ao design:** `DEC-01`, `DEC-10`, `DEC-14`; fluxo de cadastro.
- **Dependências:** `T02`, `T06`, `T07`, `T08`.
- **Parte do sistema afetada:** `src/auth/application/register-user`, DTO interno do caso de uso e testes unitários.
- **Testes e verificações:** testar ordem de normalização/hash/persistência, sucesso determinístico, duplicidade e falha técnica; afirmar que emissor JWT não é dependência do caso de uso.
- **Critérios de conclusão:** cadastro válido produz somente dados públicos; duplicidade produz erro estável mapeável para `409`; cadastro nunca autentica o visitante.
- **Riscos ou premissas:** retentativa de infraestrutura não pode gerar identidade lógica diferente para a mesma execução.

### Evidência de execução T09

- `npm test -- --runInBand src/modules/auth/application/register-user/register-user.spec.ts` — concluído; 1 suíte e 6 testes aprovados.
- O caso de uso valida antes do hash, normaliza nome/e-mail, gera ID e
  instante uma vez, chama `PasswordHasher`, persiste pela porta e retorna
  somente `id`, `name` e e-mail.
- O teste de ordem registra `hash` antes de `save`; entradas inválidas não
  chegam ao hash nem ao repositório; duplicidade e falha técnica são
  propagadas sem criar token ou cookie.
- O módulo `RegisterUser` não importa NestJS, HTTP, DynamoDB, Argon2, JWT ou
  cookie. `npm run lint`, `npm run typecheck`, `npm run build` e
  `git diff --check` — concluídos sem erros.

## Tarefa T10 — Configurar CORS exato e preflight antes do pipeline de negócio

Implementar CORS com credenciais somente para origens configuradas por correspondência exata. Permitir explicitamente `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`, os cabeçalhos `Content-Type` e `X-CSRF-Protection` e a exposição de `Retry-After`. O preflight autorizado deve terminar antes de autenticação, rate limit e caso de uso.

- **Requisitos relacionados:** `AAP-20`, `AAP-23`, `AAP-24`, `EXPECT-03`, `EXPECT-07`.
- **Referência ao design:** `DEC-02`, `DEC-05`, `DEC-12`; seção “CORS e CSRF”.
- **Dependências:** `T01`, `T03`.
- **Parte do sistema afetada:** bootstrap HTTP, configuração de origens, middleware CORS e testes E2E de preflight.
- **Testes e verificações:** origem autorizada e recusada; credenciais; métodos e cabeçalhos anunciados; `OPTIONS` sem cookie; prova por spy/contador de que autenticação, rate limiter e caso de uso não executam no preflight.
- **Critérios de conclusão:** não existe curinga com credenciais; somente origens exatas recebem headers CORS; preflight autorizado é resolvido antes do pipeline de negócio.
- **Riscos ou premissas:** origens precisam ser configuração obrigatória por ambiente; previews de terceiros permanecem fora do fluxo autenticado.

### Evidência de execução T10

- `npm run test:e2e -- --runInBand` — concluído; 3 suítes e 9 testes
  aprovados, incluindo preflight CORS autorizado e recusado.
- O bootstrap registra a política com correspondência exata de origem,
  credenciais habilitadas, métodos explícitos `GET`, `POST`, `PATCH`, `DELETE`
  e `OPTIONS`, cabeçalhos `Content-Type` e `X-CSRF-Protection`, e exposição de
  `Retry-After`.
- O preflight autorizado responde `204`, anuncia a política e não executa o
  controller; uma origem semelhante mas não igual não recebe
  `Access-Control-Allow-Origin`.
- `npm run lint`, `npm run typecheck`, `npm test` (17 suítes/52 testes),
  `npm run build` e `git diff --check` — concluídos sem erros.

## Tarefa T11 — Bloquear mutações sem proteção CSRF ou com origem inválida

Criar o componente reutilizável que exija `X-CSRF-Protection: 1` em `POST`, `PATCH` e `DELETE`. Quando `Origin` existir, aceitar somente a origem própria da API ou uma origem cliente permitida. A rejeição deve ocorrer com `403 REQUEST_FORBIDDEN` antes de qualquer caso de uso ou acesso ao DynamoDB.

- **Requisitos relacionados:** `AAP-21`, `AAP-22`, `AAP-50`, `EXPECT-03`, `EXPECT-04`, `EXPECT-07`.
- **Referência ao design:** `DEC-05`, `DEC-13`; seção “Proteção contra CSRF”.
- **Dependências:** `T03`, `T10`.
- **Parte do sistema afetada:** guard/middleware CSRF e origem, metadados de rotas e testes HTTP.
- **Testes e verificações:** ausência e valor incorreto do cabeçalho; origem autorizada, própria, ausente e recusada; asserts de que o caso de uso e repositório não foram chamados.
- **Critérios de conclusão:** toda mutação fica protegida por padrão; rejeições retornam erro padrão correlacionado; a política não cria sessão ou token CSRF.
- **Riscos ou premissas:** requisições sem `Origin` continuam sujeitas ao cabeçalho CSRF conforme o contrato de clientes não web.

### Evidência de execução T11

- `npm run test:e2e -- --runInBand test/e2e/csrf.e2e.spec.ts` — concluído; 1
  suíte e 8 testes aprovados.
- `CsrfProtectionMiddleware` protege globalmente `POST`, `PATCH` e `DELETE`,
  exige o valor literal `1`, permite origem ausente, origem própria exata ou
  origem da allowlist e rejeita demais combinações antes do controller.
- Respostas bloqueadas foram convertidas pelo filtro global em `403
  REQUEST_FORBIDDEN` correlacionado; o contador do controller permaneceu zero.
- `npm run lint`, `npm run typecheck`, `npm test` (17 suítes/52 testes),
  `npm run test:e2e` (4 suítes/17 testes), `npm run build` e
  `git diff --check` — concluídos sem erros.

## Tarefa T12 — Expor POST /auth/register com contrato e E2E

Criar DTO, controller, serialização e documentação OpenAPI do cadastro. A rota deve exigir `X-CSRF-Protection: 1` e origem autorizada quando `Origin` estiver presente, retornar `201` com os três campos públicos, `409 EMAIL_ALREADY_EXISTS` na duplicidade e `400 VALIDATION_ERROR` com campos públicos nos dados inválidos.

- **Requisitos relacionados:** `AAP-01`–`AAP-09`, `AAP-21`, `AAP-22`, `AAP-50`–`AAP-52`, `EXPECT-02`, `EXPECT-04`, `EXPECT-06`–`EXPECT-08`.
- **Referência ao design:** `DEC-05`, `DEC-13`; contrato `POST /auth/register`.
- **Dependências:** `T03`, `T09`, `T10`, `T11`.
- **Parte do sistema afetada:** apresentação Auth, DTOs, controller, decorators OpenAPI e testes E2E.
- **Testes e verificações:** E2E de sucesso, limites de todos os campos, normalização, duplicidade, propriedade desconhecida, ausência de CSRF e origem não autorizada; inspecionar corpo, headers, banco e logs.
- **Critérios de conclusão:** respostas e status coincidem com os critérios 1–3 do PRD; OpenAPI descreve entrada, sucesso e erros; não há cookie ou JWT no cadastro.
- **Riscos ou premissas:** cadastro continua público quanto a autenticação, mas não é isento das proteções de origem, CSRF e do rate limit que será conectado na Fase 06.

### Evidência de execução T12

- `npm run test:e2e -- --runInBand test/e2e/register-user.e2e.spec.ts` — 1
  suíte e 11 testes aprovados, cobrindo cadastro válido, normalização,
  limites, campo desconhecido, duplicidade, ausência de CSRF, origem não
  autorizada, persistência sem senha/hash público e documentação OpenAPI.
- `npm run lint`, `npm run typecheck`, `npm test -- --runInBand` (17 suítes/52
  testes), `npm run test:integration -- --runInBand` (2 suítes/3 testes),
  `npm run test:e2e -- --runInBand` (5 suítes/28 testes), `npm run build` e
  `git diff --check` — concluídos sem erros.
- `POST /auth/register` retorna `201` com somente `id`, `name` e e-mail
  normalizado; duplicidade retorna `409 EMAIL_ALREADY_EXISTS`; entradas
  inválidas retornam `400 VALIDATION_ERROR`; CSRF/origem inválidos retornam
  `403 REQUEST_FORBIDDEN`; não há `Set-Cookie`, JWT, senha ou hash na resposta.
- `GET /docs-json` e `GET /docs` respondem com sucesso e documentam a entrada,
  resposta `201`, erros `400`/`403`/`409` e o cabeçalho obrigatório de CSRF.
- O adaptador persistiu apenas os atributos públicos e o hash Argon2id no
  DynamoDB Local, com condição de unicidade preservada; os logs E2E não
  expuseram dados sensíveis.

## Orientações de implementação

- Repetir invariantes essenciais no domínio mesmo que o DTO já tenha sido validado.
- Não transformar `UserRepository` em abstração genérica e não expor o formato DynamoDB fora do adaptador.
- A resposta pública é um tipo próprio; nunca serializar diretamente o item persistido.

## Testes e verificações da fase

Executar a validação padrão do projeto e repetir os E2E de cadastro contra uma tabela isolada. A revisão da fase deve examinar explicitamente item persistido, corpo HTTP, `Set-Cookie` ausente e logs sanitizados.

## Critérios de aceitação da fase

1. Cadastro válido retorna `201` apenas com `id`, `name` e e-mail normalizado.
2. Limites e formato de nome, e-mail e senha são aplicados conforme o PRD.
3. Cadastros concorrentes equivalentes não criam duas contas.
4. Duplicidade retorna `409 EMAIL_ALREADY_EXISTS` sem alterar o registro existente.
5. Nenhuma execução de cadastro cria autenticação ou expõe senha/hash.

## Riscos, premissas e dependências externas da fase

- A política de rate limit do cadastro será conectada e revalidada na Fase 06 sem alterar seu contrato funcional.
- Argon2id usa recursos relevantes; os testes devem separar fidelidade de produção de velocidade sem mudar o algoritmo contratado.
