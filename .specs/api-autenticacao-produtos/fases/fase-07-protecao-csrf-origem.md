# Fase 07 — Proteção CSRF por cookie e validação de origem

| Status       | Concluída |
|--------------|-------------|
| Created      | 2026-09-04 |
| Last Updated | 2026-09-04 |

**Objetivo e resultado esperado:** substituir o header customizado de CSRF por
`SameSite=Strict` no cookie JWT e validação de `Origin` com fallback de
`Referer`, preservando compatibilidade com Swagger, CLI e back-ends que omitem
os headers de contexto de navegador.

**Requisitos relacionados:** `AAP-20`, `AAP-21`, `AAP-22`, `AAP-23`, `AAP-24`,
`AAP-60`, `EXPECT-03`, `EXPECT-06`–`EXPECT-08`.

**Decisões relacionadas:** `DEC-20` e a [ADR-006](../../../docs/adr/ADR-006-protecao-csrf-origem.md).
As decisões de cookie, JWT e consumo direto reaproveitadas da ADR-005 continuam
válidas; somente sua estratégia anterior de CSRF/origem foi substituída.

## Tarefa T34 — Aplicar `SameSite=Strict` ao cookie JWT

Atualizar a fábrica comum usada na criação e expiração do cookie para aplicar
`SameSite=Strict`, mantendo `HttpOnly`, `Secure` conforme o ambiente, prefixo
`__Host-` em produção, `Path=/`, ausência de `Domain` e duração de 900 segundos.
Local e testes também devem exercitar `SameSite=Strict`, preservando apenas a
exceção local de `Secure=false` e nome sem prefixo quando necessário para HTTP.

- **Verificação:** testes da fábrica e E2E de login/logout inspecionam criação e expiração.
- **Critério:** ambos os fluxos publicam os mesmos atributos e `SameSite=Strict`.

## Tarefa T35 — Validar origem das requisições não seguras

Adaptar o middleware transversal para isentar `GET`, `HEAD` e `OPTIONS`. Para os
demais métodos, `Origin` presente deve ser HTTP(S), bem formado e corresponder
exatamente à origem da API ou à allowlist. `null`, vazio, malformado e não
autorizado retornam `403 REQUEST_FORBIDDEN`. Somente na ausência de `Origin`,
extrair a origem de `Referer`; `Referer` inválido ou não autorizado também
retorna `403`. Um `Origin` inválido nunca usa `Referer` como compensação. Com
ambos ausentes, a chamada segue para autenticação, validação e caso de uso.

- **Verificação:** E2E cobre origem permitida, própria, `Referer` permitido,
  valores inválidos, precedência de `Origin`, ausência simultânea e métodos seguros.
- **Critério:** a rejeição ocorre antes do controller e chamadas compatíveis sem
  contexto de navegador chegam às etapas posteriores.

## Tarefa T36 — Remover o header customizado dos contratos e consumidores

Remover o header da configuração CORS, do OpenAPI, dos controllers, clientes e
fixtures de teste. Atualizar a matriz de conformidade e os testes do contrato
para demonstrar autenticação por cookie sem esquema de header CSRF. A política
de origem e o risco residual devem permanecer documentados no PRD, no design,
na ADR-006 e no contrato da API.

- **Verificação:** busca residual, E2E de CORS/OpenAPI, matriz de aceitação,
  lint, typecheck, testes e build.
- **Critério:** nenhum contrato ativo ou consumidor exige ou anuncia o header;
  Swagger e chamadas sem `Origin`/`Referer` permanecem compatíveis.

## Gate da fase

Executar `npm run lint`, `npm run typecheck`, `npm test`,
`npm run test:integration`, `npm run test:e2e`, `npm run build` e `git diff --check`.
Depois do gate, a Fase 07 deve passar por review aprovado antes do início da
Fase 09 de entrega operacional, após a revisão material de 2026-09-05.
