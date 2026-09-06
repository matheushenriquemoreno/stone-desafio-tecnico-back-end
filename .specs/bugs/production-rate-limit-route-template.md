# Bug — Rate limit de produção ignora políticas por rota

| Status       | Resolvido |
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

## Causa raiz confirmada

`RateLimitMiddleware` usa `request.path || request.originalUrl`. No middleware
montado pelo wildcard do Nest, o Express expõe em `request.path` apenas o trecho
remanescente `/`, enquanto `request.originalUrl` preserva a rota completa. A
normalização recebe `/`, não encontra a política específica e aplica o fallback
de 30 requisições por minuto. Como a chave também recebe `/`, operações com o
mesmo método compartilham indevidamente o mesmo bucket.

## Proposta de correção

Usar `request.originalUrl` como fonte primária da rota, manter `request.path`
somente como fallback e canonicalizar barras finais sem alterar a raiz.
Adicionar E2E para `/auth/register` e `/auth/register/`, exigindo cinco
respostas de validação seguidas de `429` em ambos.

## Teste de regressão

O teste E2E executa seis cadastros inválidos na aplicação Nest real. Antes da
correção, a sexta chamada retorna `400`; depois da correção, retorna `429` com
`RATE_LIMIT_EXCEEDED` e `Retry-After`.

## Validações realizadas

- Teste de regressão antes da correção: falhou pelo motivo esperado; a sexta
  chamada retornou `400` em vez de `429`.
- Correção aplicada: `RateLimitMiddleware` agora prioriza
  `request.originalUrl`; a normalização canonicaliza barras finais; o E2E
  inicializa o mesmo pipe global de validação usado pela aplicação.
- Teste de regressão depois: passou para `/auth/register` e
  `/auth/register/`; em ambos, cinco respostas `400` foram seguidas de `429`
  com `RATE_LIMIT_EXCEEDED` e `Retry-After` na rota canônica.
- Reprodução original: não ocorre mais no pipeline HTTP local. A confirmação na
  URL pública depende do merge e do deploy desta correção.
- Testes relevantes do projeto: lint e typecheck aprovados; 172 testes
  unitários, 9 de integração e 93 E2E aprovados; build concluído.

## Riscos e prevenções futuras

- Rotas com limite igual ao fallback podem esconder regressões de resolução de
  template. A suíte deve incluir ao menos uma política cujo limite seja menor
  que o padrão e atravessar o pipeline HTTP real.
- O ambiente publicado permanece com a versão defeituosa até a implantação da
  branch corrigida; repetir o smoke test depois do deploy.

## Histórico de review

- **Versão 1 — Reprovado:** a correção inicial selecionou a rota canônica, mas
  `/auth/register/` continuou usando o fallback de 30 requisições por minuto.
