# ADR-004: Rate limit por endpoint com janela fixa e IP

## Status

Aceita

## Data da decisão

2026-09-03

## Documentos relacionados

- [Requisitos do back-end](../Requisitos.md)
- [Contrato da API](../Contrato-da-API.md)
- [Decisões de tecnologia do back-end](../Decisao-tecnologias.md)
- [Decisão de deploy do back-end](../Decisao-deploy.md)
- [ADR-002: Cadastro de usuários na API](./ADR-002-cadastro-de-usuarios.md)
- [ADR-005: Autenticação web direta por cookie HttpOnly](./ADR-005-autenticacao-cookie-http-only.md)

## Contexto

A API possui endpoints públicos de cadastro, login e saúde, além de logout e CRUD autenticado de produtos. Todos precisam de proteção básica contra abuso, mas têm custos e riscos diferentes. Cadastro e login são mais sensíveis a automação e tentativa de credenciais; leituras podem receber mais tráfego; escritas devem ter limites menores.

Esta primeira versão atende a uma demonstração técnica executada em uma única instância. A prioridade é adotar uma solução simples, determinística e fácil de testar, sem introduzir infraestrutura distribuída.

## Decisão

A API aplicará rate limit na camada NestJS usando o algoritmo **Fixed Window** (janela fixa), com contadores independentes por combinação de:

```text
IP efetivo + método HTTP + template normalizado da rota
```

O identificador da rota usará seu template, e não o valor recebido no parâmetro. Portanto, chamadas a `GET /products/123` e `GET /products/456` compartilham o bucket de `GET /products/:id` quando partem do mesmo IP.

A janela de cada bucket começa na primeira requisição contabilizada, mantém duração fixa e não é prolongada por novas requisições. As primeiras requisições até o limite são aceitas; a seguinte e as demais antes do encerramento da janela recebem `429 Too Many Requests`. Encerrada a janela, o contador é descartado e uma nova janela pode começar.

## Regras por endpoint

| Endpoint | Autenticação | Limite por IP | Janela |
|---|---|---:|---:|
| `POST /auth/register` | Pública | 5 requisições | 15 minutos |
| `POST /auth/login` | Pública | 10 requisições | 15 minutos |
| `POST /auth/logout` | Cookie opcional | 20 requisições | 1 minuto |
| `GET /products` | JWT | 60 requisições | 1 minuto |
| `POST /products` | JWT | 20 requisições | 1 minuto |
| `GET /products/:id` | JWT | 60 requisições | 1 minuto |
| `PATCH /products/:id` | JWT | 20 requisições | 1 minuto |
| `DELETE /products/:id` | JWT | 10 requisições | 1 minuto |
| `GET /health` | Pública | 120 requisições | 1 minuto |
| `GET /docs` | Pública | 30 requisições | 1 minuto |
| `GET /docs-json` | Pública | 30 requisições | 1 minuto |

Uma rota HTTP nova que não esteja na tabela receberá provisoriamente o limite padrão de 30 requisições por minuto por IP. Antes de ser considerada concluída, a nova rota deverá ganhar uma regra explícita nesta ADR; o limite padrão é somente uma proteção contra omissão.

Requisições rejeitadas por autenticação ou validação também consomem o limite do endpoint. Assim, tentativas inválidas não podem contornar a proteção e o rate limiter atua antes de operações de domínio ou acesso ao DynamoDB.

Requisições `OPTIONS` de preflight CORS não consomem os buckets dos endpoints de negócio. Elas serão respondidas pela política CORS antes do rate limiter, evitando que uma única operação do navegador seja contabilizada duas vezes.

## Identificação do IP

O IP efetivo será obtido da conexão HTTP após a configuração explícita dos proxies confiáveis. Cabeçalhos como `X-Forwarded-For`, `X-Real-IP` ou `CF-Connecting-IP` enviados diretamente por um cliente não serão aceitos como autoridade.

No ambiente publicado, somente a cadeia Cloudflare → NGINX → NestJS poderá fornecer o IP encaminhado. A origem deverá restringir o acesso à Cloudflare quando viável, e o NGINX deverá remover valores recebidos do cliente e reconstruir os cabeçalhos encaminhados. Sem essa cadeia confiável, será usado o endereço observado na conexão direta.

O navegador acessará a API diretamente. No ambiente publicado, a cadeia confiável Cloudflare → NGINX preservará o IP observado na borda, sem depender de cabeçalhos fornecidos pelo front-end.

## Armazenamento e topologia

Os contadores ficarão em memória no processo da API. Cada registro manterá somente a chave do bucket, a contagem e o instante de expiração; nenhum dado será persistido no DynamoDB.

Reiniciar a aplicação apaga os contadores. Em múltiplas instâncias, cada processo teria contadores independentes e o limite deixaria de ser global. Enquanto essa estratégia estiver vigente, a API será executada em uma única instância.

A integração com o NestJS usará `@nestjs/throttler`, com armazenamento compatível com a semântica de janela fixa descrita nesta ADR. A semântica deverá ser comprovada por testes; não se deve assumir que qualquer armazenamento alternativo preserva o mesmo algoritmo.

## Resposta ao limite excedido

Quando o limite for excedido, a API retornará:

- status `429 Too Many Requests`;
- corpo de erro no formato padrão da API, sem revelar dados internos do contador;
- cabeçalho `Retry-After` com o número inteiro de segundos restantes até o encerramento da janela atual.

O cliente preservará o status `429`, respeitará `Retry-After` e apresentará uma mensagem segura para o usuário. Ele não fará novas tentativas automáticas de operações de escrita.

## Observabilidade e privacidade

A API registrará métricas agregadas de respostas `429` por endpoint. Logs poderão conter o template da rota, o status e um identificador de correlação, mas não registrarão o IP bruto especificamente para o rate limit, senhas, JWTs ou cabeçalhos de autenticação.

Picos de `429` em cadastro ou login devem ser investigados como possível abuso ou como sinal de que usuários legítimos estão compartilhando um IP por NAT ou rede corporativa.

## Testes

- Cada endpoint aceita exatamente a quantidade de requisições definida na tabela e rejeita a seguinte dentro da mesma janela.
- O contador é independente entre IPs, métodos e templates de rota.
- Valores diferentes de `:id` compartilham o mesmo bucket do template da rota.
- Uma nova janela volta a aceitar requisições depois da expiração, sem ser prolongada pelas chamadas intermediárias.
- Respostas bloqueadas retornam `429` e `Retry-After` coerente com o tempo restante.
- Respostas bloqueadas usam o schema padrão com `code=RATE_LIMIT_EXCEEDED` e identificador de correlação.
- Requisições inválidas e não autenticadas consomem o limite do endpoint.
- Cabeçalhos de IP enviados fora da cadeia de proxies confiáveis não alteram a chave do cliente.
- O limite padrão protege uma rota ainda não configurada explicitamente.
- `/docs` e `/docs-json` possuem buckets independentes de 30 requisições por minuto.
- Preflight `OPTIONS` sem cookie não altera o contador da operação real; a requisição posterior começa no mesmo total observado antes do preflight.

Os testes controlarão o relógio e o IP de origem para permanecerem determinísticos e não dependerem de espera real.

## Consequências

### Positivas

- Implementação e operação simples para uma única instância.
- Regras explícitas e auditáveis para todos os endpoints atuais.
- Consumo de memória constante por bucket ativo e expiração previsível.
- Proteção aplicada antes de autenticação, validação e acesso ao banco.

### Negativas

- Uma janela fixa permite rajadas próximas à fronteira entre duas janelas.
- NAT e redes corporativas podem fazer usuários legítimos compartilharem o mesmo limite.
- O contador é perdido em reinícios e não é coordenado entre instâncias.
- Limitar somente por IP não diferencia usuários autenticados nem impede atacantes com muitos endereços.

## Alternativas consideradas

### Sliding Window

Oferece distribuição mais precisa das requisições ao longo do tempo e reduz rajadas na fronteira, mas exige controle mais complexo dos eventos ou subcontadores. Foi adiada em favor da simplicidade inicial.

### Token Bucket

Permite rajadas controladas e reposição gradual, sendo útil para clientes com tráfego variável. Foi rejeitada nesta versão por exigir mais parâmetros e tornar os testes e a explicação operacional menos diretos.

### Chave por usuário autenticado

Evita que usuários autenticados no mesmo IP compartilhem limites, mas não atende sozinha aos endpoints públicos e cria políticas diferentes de identificação. Foi adiada; toda a versão inicial usará IP para manter uma única regra de chaveamento.

### Contador distribuído

Redis ou serviço equivalente permitiria coordenação entre réplicas, mas adicionaria infraestrutura, custo e modos de falha desnecessários para uma única instância demonstrativa. Esse ponto devera ser reconsiderado antes de escalar horizontalmente, com a adição de mais replicas.

## Critérios para revisão desta decisão

Esta ADR deverá ser revista se ocorrer qualquer uma das condições abaixo:

- publicação com múltiplas instâncias da API;
- falsos positivos frequentes causados por NAT ou IP compartilhado;
- necessidade de limites por usuário, organização ou credencial;
- necessidade de absorver rajadas legítimas sem rejeição;
- adoção de proteção de borda como WAF ou API Gateway com política equivalente.

Inundação volumétrica de `OPTIONS` não será tratada pelo contador da aplicação nesta versão. Essa proteção pertence à borda e deverá ser revista antes de exposição pública com tráfego relevante.
