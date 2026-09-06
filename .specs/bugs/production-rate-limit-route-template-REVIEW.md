# Review — Bug de política de rate limit por rota

| Status       | Aprovado |
|--------------|----------|
| Created      | 2026-09-06 |
| Last Updated | 2026-09-06 |

**Escopo revisado:** correção do bug `production-rate-limit-route-template`
**Versão da avaliação:** 5
**Commit revisado:** `60a2f0c`

## Artefatos analisados

- Relatório: `.specs/bugs/production-rate-limit-route-template.md`
- Middleware: `src/shared/presentation/http/rate-limit.middleware.ts`
- Políticas: `src/shared/presentation/http/rate-limit-policies.ts`
- Logging: `src/shared/application/ports/request-logger.ts` e
  `src/shared/infrastructure/logging/console-request.logger.ts`
- Testes unitários e E2E relacionados ao rate limit e ao logging.
- ADR: `docs/adr/ADR-004-rate-limit.md`

## Resumo executivo

A correção passou a resolver a política pelo caminho completo da requisição,
preservando as formas equivalentes aceitas pelo Nest/Express e os segmentos
codificados das rotas dinâmicas. O fallback agora emite um warning estruturado
sem registrar caminho concreto, IP, payload, cookies ou cabeçalhos. Não foram
encontrados achados bloqueadores, altos, médios ou baixos.

## Resultado das verificações obrigatórias

| Verificação | Resultado | Evidência |
|-------------|-----------|-----------|
| Causa raiz | Atendida | `originalUrl` substitui o trecho remanescente de `request.path` |
| Política de cadastro | Atendida | Cinco respostas `400`; sexta resposta `429` |
| Rotas equivalentes | Atendida | Barra final, casing, query e absolute-form compartilham a política |
| Rotas dinâmicas | Atendida | `%2e` e `%2e%2e` preservam o template `/products/:id` |
| AAP-53 | Atendida | Chave permanece IP efetivo, método e template normalizado |
| AAP-54 | Atendida | Excedente retorna `429 RATE_LIMIT_EXCEEDED` |
| AAP-55 | Atendida | Resposta bloqueada inclui `Retry-After` inteiro |
| Preflight | Atendida | `OPTIONS` não consome bucket nem registra warning |
| Observabilidade | Atendida | Cada fallback emite `RATE_LIMIT_FALLBACK_APPLIED` |
| Privacidade do warning | Atendida | Rota estática; IP e token-sentinela ausentes |
| Gates | Atendida | GitHub Actions aprovado no SHA revisado |

## Evidência automatizada

- Lint e typecheck aprovados.
- 35 suítes e 176 testes unitários aprovados.
- 3 suítes e 9 testes de integração aprovados.
- 15 suítes e 96 testes E2E aprovados.
- Build da aplicação e da imagem Docker aprovados.
- `git diff --check main...HEAD` aprovado.

## Achados

| ID | Severidade | Achado | Evidência | Impacto | Recomendação | Encaminhamento |
|----|-----------|--------|-----------|---------|--------------|----------------|
| — | — | Nenhum achado | Código, testes e CI aprovados | — | — | — |

## Riscos residuais e ressalvas aceitas

- A produção mantém o comportamento anterior até merge e deploy; o smoke test
  público deve ser repetido depois da implantação.
- Permanecem as limitações aceitas da ADR-004: armazenamento em memória, uma
  instância, reinício zerando contadores e compartilhamento por NAT.
- O warning é emitido a cada fallback e pode elevar o volume durante varreduras;
  o identificador estático evita cardinalidade e vazamento pelo caminho.

## Veredito

**Veredito:** Aprovado

**Fundamentação:** a causa foi confirmada, as regressões falharam antes e
passaram depois, os requisitos `AAP-53` a `AAP-55` foram comprovados e o warning
de fallback preserva correlação e privacidade.

## Próxima ação

Realizar merge, deploy e smoke test no endpoint público.

## Histórico de revisões anteriores

| Versão | Data | Veredito | Resumo |
|--------|------|----------|--------|
| 1 | 2026-09-06 | Reprovado | Barra final usava o fallback. |
| 2 | 2026-09-06 | Reprovado | Casing criava bucket alternativo. |
| 3 | 2026-09-06 | Reprovado | Absolute-form incluía host e esquema. |
| 4 | 2026-09-06 | Reprovado | Parser normalizava dot-segments codificados. |
| 5 | 2026-09-06 | Aprovado | Correção completa e warning seguro. |
