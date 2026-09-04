# ADR-006: Proteção CSRF por cookie e validação de origem

## Status

Aceita

## Data da decisão

2026-09-04

## Documentos relacionados

- [PRD da API](../../.specs/api-autenticacao-produtos/PRODUCT-REQUIREMENTS.md)
- [Design técnico](../../.specs/api-autenticacao-produtos/TECHNICAL-DESIGN.md)
- [Contrato da API](../Contrato-da-API.md)
- [ADR-005: Autenticação web direta por cookie HttpOnly](./ADR-005-autenticacao-cookie-http-only.md)
- [OWASP: Cross-Site Request Forgery Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)

## Contexto

A API autentica o navegador com um JWT em cookie HttpOnly. Como navegadores
enviam cookies automaticamente, uma requisição forjada pode tentar executar
uma operação mutável com a credencial já existente. O header customizado usado
na decisão original adicionava uma exigência manual ao contrato de todos os
clientes e não é mais necessário para a política aprovada.

`SameSite` é a primeira camada de defesa. A verificação de origem acrescenta
uma camada independente e barata: o servidor verifica os metadados que o
navegador envia sobre a origem da requisição. A OWASP recomenda verificar
`Origin` e usar `Referer` somente quando `Origin` não estiver presente.

## Decisão

O cookie JWT usará `HttpOnly`, `Secure` no ambiente publicado, prefixo
`__Host-`, `Path=/`, ausência de `Domain`, `SameSite=Strict` e `Max-Age=900`.
A fábrica comum de criação e expiração do cookie aplica os mesmos atributos
nos dois fluxos, inclusive localmente e nos testes; o ambiente local mantém a
exceção já definida de `Secure=false` e nome sem prefixo quando usa HTTP.

O CORS continuará usando origens exatas e credenciais. Ele anunciará somente
`Content-Type` entre os cabeçalhos de requisição e não anunciará um header
customizado de CSRF.

Para `GET`, `HEAD` e `OPTIONS`, a API não executará a validação de origem. Para
qualquer outro método:

1. Se `Origin` estiver presente, ele deve ser uma origem HTTP(S) bem formada e
   corresponder exatamente à origem da API ou a uma origem da allowlist.
2. `Origin: null`, vazio, malformado ou não autorizado retorna
   `403 REQUEST_FORBIDDEN`.
3. Somente se `Origin` estiver ausente, a API extrai a origem de `Referer`.
4. `Referer` malformado ou com origem não autorizada retorna
   `403 REQUEST_FORBIDDEN`.
5. `Origin` inválido nunca é compensado por `Referer` válido.
6. Com ambos ausentes, a requisição é aceita por compatibilidade e segue para
   autenticação, validação e caso de uso.

A origem própria da API é derivada do protocolo e host efetivos da requisição.
A allowlist usa comparação exata; curingas, caminhos, consultas, credenciais e
origens não HTTP(S) não são aceitos como origem autorizada.

## Clientes e limites da compatibilidade

Swagger hospedado pela própria API, CLI e outros back-ends podem chamar a API
sem enviar `Origin` ou `Referer`. Clientes back-end que autenticam por cookie
são arquiteturalmente incomuns, pois cookie foi desenhado para autenticação de
navegador; comunicação servidor-servidor normalmente usa API key, mTLS ou
client credentials. É justamente por isso que a ausência dos dois headers é um
caminho esperado para essa compatibilidade transitória, e não uma prova de que
a chamada veio de um back-end.

Autenticação máquina-a-máquina específica permanece adiada. Quando virar
requisito, deverá receber contrato e decisão próprios. Esta ADR não introduz
`Bearer`, API key, mTLS, client credentials, token CSRF, sessão server-side ou
`Sec-Fetch-Site`.

## Consequências

### Positivas

- O navegador recebe uma proteção padrão do cookie com `SameSite=Strict`.
- A API mantém uma verificação explícita de origem para mutações.
- Swagger, CLI e clientes back-end compatíveis não precisam inventar um header.
- O CORS continua restrito a origens exatas e credenciais.
- A validação ocorre antes do controller, sem dependência de estado de sessão.

### Negativas e risco residual aceito

- Clientes web precisam operar em uma origem da allowlist ou na própria origem
  da API.
- `SameSite=Strict` pode impedir o envio do cookie em navegações iniciadas fora
  do site; isso é aceito pelo fluxo direto entre origens controladas.
- Quando ambos os headers estão ausentes, não é possível classificar com
  certeza navegador e back-end. O risco residual é aceito para compatibilidade;
  autenticação válida, validação de entrada e controle de todos os subdomínios
  permanecem premissas obrigatórias.
- Cookie para back-end é uma compatibilidade transitória e não uma
  recomendação para integração máquina-a-máquina.

## Testes exigidos

- Login e logout publicam `SameSite=Strict`, `HttpOnly`, caminho raiz,
  expiração correta e os demais atributos do cookie.
- Mutação com origem permitida, própria ou extraída de `Referer` passa sem
  header customizado.
- Origem não autorizada, `null`, vazia ou malformada retorna `403` antes do
  controller.
- `Referer` inválido ou não autorizado retorna `403` somente quando `Origin`
  está ausente.
- `Origin` inválido com `Referer` permitido continua retornando `403`.
- Ambos ausentes seguem para autenticação e caso de uso.
- `GET`, `HEAD` e `OPTIONS` permanecem isentos.
- OpenAPI e CORS não anunciam o header removido.

## Referências

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)
