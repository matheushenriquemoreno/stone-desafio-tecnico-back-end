# Review — Bug `start:dev` falha na injeção do `ConfigService`

| Status       | Aprovado |
|--------------|----------|
| Created      | 2026-09-04 |
| Last Updated | 2026-09-04 |

**Escopo revisado:** correção do bug `start-dev-di-injection`
**Versão da avaliação:** 1

## Artefatos analisados

- Relatório do bug: [start-dev-di-injection.md](start-dev-di-injection.md)
- Scripts: `package.json` e `package-lock.json`
- Documentação: `README.md`
- Bootstrap: `src/main.ts`
- Convenções: `rules/README.md`, `rules/principios-de-design.md`, `rules/codigo-como-um-livro.md` e `rules/checklist-de-implementacao.md`

## Resumo executivo

A correção foi revisada a partir da reprodução original, da causa confirmada e
do diff do commit `9707ee8`. O runner problemático `tsx watch` foi substituído
por `tsc-watch` usando `tsconfig.build.json`, preservando o metadata de
decorators do TypeScript e mantendo o reinício automático da API compilada.
O teste de regressão iniciou o NestJS, registrou as rotas e obteve `200` em
`GET /docs-json`. Não há achados bloqueadores, altos ou pendências abertas.

## Resultado das verificações obrigatórias

| Verificação | Resultado | Evidência |
| ------------ | --------- | --------- |
| Reprodução original | Atendida | `npm run start:dev` com o runner antigo reproduziu o `TypeError` no construtor do strategy. |
| Causa raiz | Atendida | Comparação mostrou `design:paramtypes` no JavaScript de `tsc` e sua ausência na saída esbuild usada por `tsx`. |
| Correção | Atendida | `package.json` executa `tsc-watch -p tsconfig.build.json --onSuccess "node dist/main.js"`. |
| Teste de regressão | Atendida | O novo `npm run start:dev` compilou sem erros, iniciou a aplicação e `GET /docs-json` retornou `200`. |
| Isolamento da saída | Atendida | Não há `.js`, `.d.ts` ou mapas gerados em `src`, `test` ou `scripts`; a saída fica em `dist`. |
| Dependências | Atendida | `tsc-watch` está registrado no `devDependencies` e o `npm ci` passou sem vulnerabilidades reportadas. |
| Documentação | Atendida | README descreve `start`, `start:dev`, build, DynamoDB Local e provisionamento. |
| Qualidade | Atendida | Lint, typecheck, build, suíte unitária e `git diff --check` passaram. |
| Escopo | Atendida | A correção altera somente runner, dependência, documentação e o relatório do bug; não muda contratos da API. |
| Segurança e operação | Atendida | `.env` foi usado apenas temporariamente na validação, removido e não versionado; `start` continua executando o build compilado. |

## Matriz de rastreabilidade

| Requisito/critério | Código | Teste/evidência | Status |
| ------------------ | ------ | --------------- | ------ |
| `start:dev` inicia a API | `package.json`, `tsconfig.build.json` | Execução real de `npm run start:dev`; logs mostram `Nest application successfully started`. | Comprovado |
| Injeção do `ConfigService` funciona | `dist/modules/auth/presentation/cookie-access-token.strategy.js` gerado por `tsc` | Bootstrap real passou pelo `CookieAccessTokenStrategy` sem `TypeError`. | Comprovado |
| Desenvolvimento continua observando mudanças | `tsc-watch` com `--onSuccess` | O processo permaneceu em `Watching for file changes` durante a validação. | Comprovado |
| Endpoints continuam registrados | `src/main.ts`, módulos Nest | `GET /docs-json` retornou `200`; logs registraram `/auth`, `/health` e `/products`. | Comprovado |
| Nenhuma saída de compilação polui o código-fonte | `tsconfig.build.json` e comando `tsc-watch -p` | Verificação manual encontrou `SOURCE_ARTIFACTS=0` em `src`, `test` e `scripts`. | Comprovado |

## Achados

Nenhum achado bloqueador, alto, médio, baixo ou informativo foi identificado.

## Riscos residuais e ressalvas aceitas

- `npm run start` continua dependendo de `npm run build` antes da execução,
  conforme documentado no README; isso é comportamento intencional para o
  runner de produção.
- `tsc-watch` é uma dependência de desenvolvimento e deve permanecer incluída
  nas instalações usadas por `start:dev`.

## Veredito

**Veredito:** Aprovado

**Fundamentação:** a reprodução falha antes da correção e não falha depois; a
causa raiz foi confirmada por comparação de artefatos; o runner final preserva
metadata, observa mudanças, inicia a API e não gera arquivos fora de `dist`.
Os gates relevantes passaram e o escopo permaneceu restrito ao bug.

## Próxima ação

Bug fechado. Nenhuma ação adicional é necessária neste escopo.

## Histórico de revisões anteriores

Não há revisões anteriores para este bug.
