# Bug — Rate limit de produção ignora políticas por rota

| Status       | Em correção |
|--------------|------------|
| Created      | 2026-09-06 |
| Last Updated | 2026-09-06 |

## Comportamento esperado e observado

**Esperado:** `POST /auth/register` aceita cinco requisições por IP em uma
janela de 15 minutos e bloqueia a sexta com `429 RATE_LIMIT_EXCEEDED` e
`Retry-After`.

**Observado:** a API publicada aceita mais requisições que o limite específico.
As seis primeiras chamadas inválidas de cadastro retornaram
`400 VALIDATION_ERROR`. Em uma reprodução complementar, `POST /auth/login`
aceitou 30 chamadas inválidas e bloqueou somente a 31ª, que é o limite padrão.

## Contexto e evidências

- **Entradas:** `POST` com `Content-Type: application/json` e corpo `{}`.
- **Ambiente:** `https://apiproducts.devmoreno.com.br`, imagem do commit
  `70c0bb459d80dc30eceaad6da323654c09d9ba58` publicada pelo workflow concluído
  com sucesso em 2026-09-06.
- **Frequência:** sempre, enquanto o bucket padrão não estiver previamente
  consumido.
- **Evidências:** cadastro retornou seis respostas `400`; login retornou 30
  respostas `400` e a 31ª resposta foi `429` com `Retry-After: 59`.

## Reprodução

1. Enviar seis requisições consecutivas para `POST /auth/register` com corpo
   `{}` a partir do mesmo cliente.
2. Observar que a sexta resposta ainda é `400 VALIDATION_ERROR`.
3. Em um bucket novo, enviar 31 requisições inválidas para `POST /auth/login`.
4. Observar que somente a 31ª é bloqueada.

**Confirmação:** sim. O bloqueio na 31ª chamada demonstra que o middleware está
ativo, porém resolve a política padrão de 30 requisições por minuto.

## Hipóteses testadas e resultados

| # | Hipótese | Teste (uma variável por vez) | Resultado |
|---|----------|------------------------------|-----------|
| H1 | A imagem publicada não contém o rate limiter atual. | Conferir SHA do deploy e provocar o limite padrão. | Refutada: a imagem corresponde à `main` e respondeu `429` na 31ª chamada. |
| H2 | O contador é perdido entre requisições. | Repetir 31 chamadas na mesma janela. | Refutada: o contador acumulou e bloqueou a 31ª. |
| H3 | O template usado pela política perde a rota no middleware montado pelo Nest. | Comparar `request.path` e `request.originalUrl` no caminho HTTP e cobrir a rota específica em E2E. | Confirmada: a política padrão é observável e a implementação defeituosa priorizava `request.path`. |
| H4 | Usar `originalUrl` sem canonicalizar a barra final ainda permite o fallback. | Enviar chamadas para `/auth/register/`, que o Nest aceita como cadastro. | Confirmada no review v1: a 31ª chamada, não a 6ª, recebeu `429`. |
| H5 | Preservar maiúsculas permite que uma rota equivalente use outro bucket e o fallback. | Enviar chamadas para `/AUTH/REGISTER`, aceita pelo roteamento padrão. | Confirmada no review v2: a 31ª chamada, não a 6ª, recebeu `429`. |
| H6 | Usar a URL original integral permite que request-target absoluto inclua host/esquema na chave. | Enviar `POST http://host/auth/register`, aceito como cadastro pelo runtime HTTP. | Confirmada no review v3: a 31ª chamada, não a 6ª, recebeu `429`. |
| H7 | Usar o parser WHATWG normaliza dot-segments codificados antes de identificar uma rota dinâmica. | Enviar `PATCH /products/%2e`, aceito como `PATCH /products/:id`. | Confirmada no review v4: a 21ª chamada recebeu `401`; somente a 31ª recebeu `429`. |

## Causa raiz confirmada

`RateLimitMiddleware` usa `request.path || request.originalUrl`. No middleware
montado pelo wildcard do Nest, o Express expõe em `request.path` apenas o trecho
remanescente `/`, enquanto `request.originalUrl` preserva a rota completa. A
normalização recebe `/`, não encontra a política específica e aplica o fallback
de 30 requisições por minuto. Como a chave também recebe `/`, operações com o
mesmo método compartilham indevidamente o mesmo bucket.

## Proposta de correção

Usar `request.originalUrl` como fonte primária da rota, manter `request.path`
somente como fallback, extrair o caminho bruto de origin-form ou absolute-form
sem normalizar segmentos codificados e canonicalizar apenas os aspectos do
roteamento padrão do Express: minúsculas e barras finais, preservando a raiz.
Adicionar E2E para as variações aceitas de `/auth/register` e para a rota
dinâmica com identificador codificado.

## Teste de regressão

O teste E2E executa seis cadastros inválidos na aplicação Nest real. Antes da
correção, a sexta chamada retorna `400`; depois da correção, retorna `429` com
`RATE_LIMIT_EXCEEDED` e `Retry-After`.

## Validações realizadas

- Teste de regressão antes da correção: falhou pelo motivo esperado; a sexta
  chamada retornou `400` em vez de `429`.
- Correção aplicada: `RateLimitMiddleware` agora prioriza
  `request.originalUrl`; a normalização extrai o caminho bruto sem reescrever
  segmentos percent-encoded e canonicaliza maiúsculas e barras finais; o E2E
  inicializa o mesmo pipe global de validação usado pela aplicação.
- Teste de regressão depois: passou para `/auth/register`,
  `/auth/register/`, `/AUTH/REGISTER` e request-target absoluto; em todos, cinco
  respostas `400` foram seguidas de `429` com `RATE_LIMIT_EXCEEDED` e
  `Retry-After` na rota canônica.
- A regressão de rota dinâmica passou para `PATCH /products/%2e`: vinte
  respostas `401` foram seguidas de `429`, provando a política de 20 por minuto.
- O middleware registra `RATE_LIMIT_FALLBACK_APPLIED` em nível `warn` sempre que
  aplica a política padrão, com método, identificador estático de rota, limite,
  janela e `correlationId`, sem registrar o caminho concreto nem o IP.
- Reprodução original: não ocorre mais no pipeline HTTP local. A confirmação na
  URL pública depende do merge e do deploy desta correção.
- Testes relevantes do projeto: lint e typecheck aprovados; 176 testes
  unitários, 9 de integração e 96 E2E aprovados; build concluído.

## Riscos e prevenções futuras

- Rotas com limite igual ao fallback podem esconder regressões de resolução de
  template. A suíte deve incluir ao menos uma política cujo limite seja menor
  que o padrão e atravessar o pipeline HTTP real.
- O ambiente publicado permanece com a versão defeituosa até a implantação da
  branch corrigida; repetir o smoke test depois do deploy.

## Histórico de review

- **Versão 1 — Reprovado:** a correção inicial selecionou a rota canônica, mas
  `/auth/register/` continuou usando o fallback de 30 requisições por minuto.
- **Versão 2 — Reprovado:** a barra final foi canonicalizada, mas
  `/AUTH/REGISTER` ainda criava outro bucket e usava o fallback de 30 por minuto.
- **Versão 3 — Reprovado:** casing foi canonicalizado, mas um request-target
  absoluto ainda incorporava host/esquema à chave e usava o fallback.
- **Versão 4 — Reprovado:** o parser de URL corrigiu absolute-form, mas também
  normalizou dot-segments codificados antes de identificar rotas dinâmicas.
