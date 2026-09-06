# Bug — Suíte E2E encerra o processo no GitHub Actions

| Status       | Resolvido      |
|--------------|-----------------|
| Created      | 2026-09-06      |
| Last Updated | 2026-09-06      |

## Comportamento esperado e observado

**Esperado:** `npm run test:e2e` conclui todas as suítes E2E com código de saída
zero no GitHub Actions.

**Observado:** no GitHub Actions, as suítes funcionais exibem `PASS`, mas o
processo termina com código de saída `1` ao inicializar
`test/e2e/openapi.e2e.spec.ts`. O Jest registra `process.exit called with "1"`
em `NestFactory.create` (linha 31 da suíte OpenAPI), sem apresentar a causa
original da falha de inicialização.

## Contexto e evidências

- **Entradas:** `npm run test:e2e`, que executa Jest em modo sequencial
  (`--runInBand`) contra todas as suítes E2E.
- **Ambiente:** GitHub Actions, workflow `.github/workflows/api-delivery.yml`,
  Node.js `22.13.1`, DynamoDB Local em `localhost:8000`.
- **Frequência:** ocorre em ambiente sem `.env` quando a suíte OpenAPI é
  carregada antes de configurar as variáveis de teste; a suíte passa quando o
  ambiente já está configurado.
- **Evidências:** a saída externa mostra todas as suítes anteriores como
  `PASS`, seguida de `process.exit called with "1"` em
  `test/e2e/openapi.e2e.spec.ts:31` e `Error: Process completed with exit code
  1`.

## Reprodução

1. Iniciar o DynamoDB Local na porta `8000`.
2. Usar Node.js `22.13.1`.
3. Executar `npm ci`.
4. Executar `npm run test:e2e` no workflow do GitHub Actions.

**Confirmação:** confirmado. Ao executar a suíte OpenAPI com o diretório de
trabalho apontando para uma pasta sem `.env`, o mesmo `process.exit called with
"1"` ocorre em `openapi.e2e.spec.ts:31`. A suíte OpenAPI isolada passa quando o
`.env` local está disponível, o que explica a diferença entre local e CI.

## Hipóteses testadas e resultados

| # | Hipótese | Teste (uma variável por vez) | Resultado |
|---|----------|------------------------------|-----------|
| H1 | A própria suíte OpenAPI sempre falha ao inicializar a aplicação. | Executar somente `test/e2e/openapi.e2e.spec.ts` com o `.env` local. | Refutada: 1 suíte e 1 teste passaram. |
| H2 | A configuração depende de um `.env` presente no diretório de trabalho. | Executar a mesma suíte com `process.cwd()` em uma pasta sem `.env`. | Confirmada: o processo termina em `NestFactory.create` com `process.exit(1)`. |
| H3 | A falha é causada pelo aviso de VM Modules. | Comparar a suíte sem `.env` com a suíte isolada usando o `.env`. | Refutada: o aviso aparece nos dois cenários; somente o cenário sem `.env` falha. |
| H4 | O import estático de `AppModule` ocorre antes do ambiente de teste ser configurado. | Comparar o import estático de OpenAPI/rate limit com os imports dinâmicos após `beforeAll`. | Confirmada: `ConfigModule.forRoot` valida o ambiente capturado durante a criação do módulo; os imports dinâmicos existentes passam. |

## Causa raiz confirmada

As suítes `openapi.e2e.spec.ts` e `rate-limit.e2e.spec.ts` importam
`AppModule` estaticamente antes do `beforeAll` definir as variáveis de teste.
Sem um `.env` no CI, `ConfigModule.forRoot` não recebe as variáveis obrigatórias
no momento em que o módulo dinâmico é preparado. A inicialização posterior do
NestJS falha e o `DEFAULT_TEARDOWN` chama `process.exit(1)`, ocultando a
mensagem de configuração. A reprodução sem `.env` confirma esse mecanismo.

## Proposta de correção

Remover os imports estáticos de `AppModule` dessas duas suítes e importá-lo
dinamicamente somente depois de configurar o ambiente de teste. Em
`rate-limit.e2e.spec.ts`, o módulo de probe também será criado nesse ponto.
Isso mantém o contrato da aplicação e alinha as duas suítes ao padrão já usado
pelas demais suítes E2E.

## Teste de regressão

Executar `test/e2e/openapi.e2e.spec.ts` com um `setupFiles` que muda
`process.cwd()` para uma pasta sem `.env`. Antes da correção, o comando falha
com `process.exit called with "1"` em `NestFactory.create`; depois, a suíte
deve passar sem depender do arquivo local. Repetir o comando oficial completo
no ambiente sem `.env` também é a regressão final.

## Validações realizadas

- Teste de regressão antes da correção: falhou pelo motivo certo — sem `.env`,
  `openapi.e2e.spec.ts` terminou com `process.exit called with "1"` na criação
  do `AppModule`.
- Correção aplicada: `AppModule` passou a ser importado após o ambiente nas
  suítes OpenAPI e rate limit; o módulo de probe do rate limit passou a ser
  criado no mesmo ponto.
- Teste de regressão depois: passou com a pasta de trabalho sem `.env` — 15
  suítes e 91 testes E2E aprovados.
- Reprodução original: não reproduziu mais no cenário equivalente ao CI.
- Testes relevantes do projeto: `npm run test:e2e` (15/91), E2E com ambiente
  sem `.env` (15/91), E2E com Node.js `22.13.1` (15/91), `npm test`
  (35/171), `npm run test:integration` (3/9), `npm run lint`,
  `npm run typecheck`, `npm run build` e `git diff --check` aprovados.

## Riscos e prevenções futuras

- Suítes E2E mutam `process.env` globalmente; imports de módulos que validam
  ambiente devem permanecer depois da configuração específica da suíte.
- `NestFactory.create` usa `process.exit(1)` por padrão em falhas de bootstrap;
  testes de inicialização devem usar uma estratégia de captura que preserve o
  erro sem encerrar abruptamente o processo de testes.
