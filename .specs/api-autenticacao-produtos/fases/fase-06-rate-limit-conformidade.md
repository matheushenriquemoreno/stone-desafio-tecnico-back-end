# Fase 06 — Rate limit e conformidade operacional da API

| Status       | Concluída   |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-04 |

**Objetivo e resultado esperado:** aplicar a política Fixed Window de forma determinística a todas as operações, completar o OpenAPI operacional e comprovar a conformidade transversal da API sem vazamento de dados sensíveis.

**Capacidade ou fluxo coberto:** IP efetivo confiável, buckets por método/template, `429` com `Retry-After`, documentação `/docs` e `/docs-json` e auditoria integrada dos critérios funcionais e não funcionais.

**Requisitos relacionados:** `AAP-23`, `AAP-24`, `AAP-50`–`AAP-57`, `EXPECT-01`–`EXPECT-08`, `EXPECT-11`.

**Dependências externas:** nenhuma para testes locais; a cadeia Cloudflare/NGINX será validada na Fase 07.

## Tarefa T28 — Resolver o IP efetivo somente pela cadeia confiável

Implementar a porta/componente de identificação do IP efetivo usando a conexão observada e configuração explícita de proxies confiáveis. Cabeçalhos `X-Forwarded-For`, `X-Real-IP` ou `CF-Connecting-IP` enviados fora dessa cadeia não podem alterar a identidade do cliente usada nos buckets.

- **Requisitos relacionados:** `AAP-53`, `EXPECT-07`, `EXPECT-11`.
- **Referência ao design:** `DEC-12`, `DEC-19`; seções “Identificação do IP” da ADR-004 e “Segurança”.
- **Dependências:** `T01`, `T02`.
- **Parte do sistema afetada:** configuração de proxy, resolvedor de IP, contexto da requisição e testes HTTP.
- **Testes e verificações:** conexão direta com cabeçalhos forjados; um e múltiplos proxies autorizados; configuração inválida; provar qual IP alimenta a chave sem registrar o valor bruto nos logs do rate limiter.
- **Critérios de conclusão:** cliente direto não controla seu IP por cabeçalho; somente a cadeia configurada é confiável; configuração ambígua falha no startup.
- **Riscos ou premissas:** a validação local simula a cadeia; o comportamento real do NGINX/Cloudflare será integrado em `T36`.

## Tarefa T29 — Implementar armazenamento Fixed Window determinístico

Criar o armazenamento em memória com chave composta por IP efetivo, método HTTP e template normalizado da rota. A primeira requisição abre uma janela fixa; chamadas seguintes não prorrogam sua expiração; o bucket é descartado ao fim da janela. Injetar relógio e uma fonte controlável de IP para testes sem espera real.

- **Requisitos relacionados:** `AAP-53`, `EXPECT-07`.
- **Referência ao design:** `DEC-12`; ADR-004 “Decisão” e “Armazenamento e topologia”.
- **Dependências:** `T02`, `T28`.
- **Parte do sistema afetada:** serviço/armazenamento do rate limiter, chave de bucket e testes unitários.
- **Testes e verificações:** limite inclusivo, próxima requisição bloqueada, janela não deslizante, expiração, IPs/métodos/templates independentes e IDs distintos compartilhando `:id`; verificar liberação/limpeza de buckets expirados.
- **Critérios de conclusão:** semântica Fixed Window é comprovada; a chave usa template, não URL concreta; reinício perde apenas contadores; nenhum estado vai ao DynamoDB.
- **Riscos ou premissas:** instância única permanece obrigatória; rajadas na fronteira e NAT compartilhado são limitações aceitas.

## Tarefa T30 — Aplicar políticas por endpoint na ordem correta do pipeline

Conectar o rate limiter antes de autenticação, validação e acesso ao banco, mas depois do tratamento de preflight. Configurar os limites explícitos da ADR-004 para cadastro, login, logout, listagem, criação, consulta, atualização, exclusão e health; garantir que falhas de autenticação e validação consumam o bucket e `OPTIONS` não consuma o da operação real.

A ADR-004 define 30 requisições por minuto e IP em buckets independentes para `/docs` e `/docs-json`, além das políticas das rotas de negócio e health.

- **Requisitos relacionados:** `AAP-23`, `AAP-24`, `AAP-53`, `EXPECT-07`.
- **Referência ao design:** `DEC-05`, `DEC-12`, `DEC-13`; tabela “Política de limites de requisição” e ADR-004.
- **Dependências:** `T10`, `T11`, `T17`, `T20`, `T21`, `T24`, `T26`–`T29`.
- **Parte do sistema afetada:** pipeline HTTP, metadados/configuração de políticas, rotas existentes e testes E2E.
- **Testes e verificações:** cada limite explícito; fallback em rota de teste não configurada; requisições inválidas/não autenticadas; `OPTIONS`; templates com IDs distintos; spies para provar a ordem antes de guard, DTO e repositório.
- **Critérios de conclusão:** as nove operações de negócio/health e as duas rotas de documentação usam exatamente os limites aprovados; nenhuma rota concluída depende apenas do fallback; preflight não altera buckets de negócio.
- **Riscos ou premissas:** `/docs` e `/docs-json` possuem buckets independentes de 30 requisições por minuto e IP; rotas adicionais continuam exigindo política explícita antes de serem concluídas.

## Tarefa T31 — Padronizar 429, Retry-After e observabilidade agregada

Mapear bloqueio para `429 RATE_LIMIT_EXCEEDED` no schema comum, calcular `Retry-After` como inteiro de segundos restantes da janela corrente e registrar métrica agregada por template sem IP bruto. Requisições bloqueadas não podem alcançar autenticação, DTO, caso de uso ou DynamoDB.

- **Requisitos relacionados:** `AAP-50`, `AAP-53`–`AAP-55`, `EXPECT-02`, `EXPECT-04`, `EXPECT-07`, `EXPECT-11`.
- **Referência ao design:** `DEC-12`, `DEC-13`; ADR-004 “Resposta ao limite excedido” e “Observabilidade e privacidade”.
- **Dependências:** `T03`, `T29`, `T30`.
- **Parte do sistema afetada:** exceção/filtro do rate limit, resposta HTTP, métricas e testes unitários/E2E.
- **Testes e verificações:** segundos exatos no início/fim da janela, schema e correlação, ausência de chamadas downstream, nova janela, métrica por template e logs sem IP/JWT/cookie.
- **Critérios de conclusão:** critério 22 do PRD passa em cada classe de operação; `Retry-After` é coerente e exposto por CORS; corpo não revela contador ou IP.
- **Riscos ou premissas:** arredondamento deve impedir valor zero enquanto a janela ainda bloqueia.

## Tarefa T32 — Consolidar e validar OpenAPI navegável e exportável

Revisar as anotações criadas com cada rota e configurar `/docs` e `/docs-json`. O documento deve descrever cookie auth, cabeçalho CSRF, DTOs, query/cursor, todos os status e schemas de erro, sem introduzir Bearer nem endpoint intermediário. Exportar o JSON de maneira determinística para validação automatizada.

- **Requisitos relacionados:** `AAP-56`, `AAP-57`, `EXPECT-06`, `EXPECT-08`.
- **Referência ao design:** `DEC-02`, `DEC-03`, `DEC-05`, `DEC-13`; seção “Contratos de API”.
- **Dependências:** `T12`, `T15`–`T17`, `T20`, `T21`, `T24`, `T26`, `T27`, `T30`.
- **Parte do sistema afetada:** bootstrap Swagger, decorators/DTOs de todas as rotas, exportador e testes de contrato.
- **Testes e verificações:** acessar UI e JSON; validar documento; comparar caminhos, métodos, segurança, headers, corpos e status com o PRD/Contrato-da-API; snapshot sem valores secretos.
- **Critérios de conclusão:** `/docs` é navegável; `/docs-json` retorna OpenAPI válido; todos os nove endpoints de negócio/health estão descritos; esquemas coincidem com E2E.
- **Riscos ou premissas:** Swagger UI no host da API usa o mesmo cookie; não oferecer fluxo Bearer alternativo.

## Tarefa T33 — Executar auditoria automatizada de conformidade e vazamento

Montar uma matriz automatizada que reutilize os testes das fases e cubra todos os 27 critérios de aceitação do PRD, incluindo duas contas, tempo/IP controlados, persistência isolada, contratos OpenAPI e casos de erro. Capturar respostas, URLs, logs e artefatos produzidos para afirmar ausência de senha, hash, JWT e credenciais de infraestrutura.

- **Requisitos relacionados:** `AAP-01`–`AAP-59`, `EXPECT-01`–`EXPECT-08`, `EXPECT-11`.
- **Referência ao design:** `DEC-13`, `DEC-18`; matriz de rastreabilidade e seção “Segurança, privacidade e observabilidade”.
- **Dependências:** `T01`–`T32`.
- **Parte do sistema afetada:** suítes E2E/integração, fixtures isoladas, verificador OpenAPI, captura segura de logs e documentação de testes.
- **Testes e verificações:** executar comandos oficiais em checkout limpo; gerar relatório requisito → teste; busca negativa por padrões e valores-sentinela de segredo; repetir cenários sensíveis para detectar flakiness.
- **Critérios de conclusão:** cada critério do PRD aponta para teste verde; nenhum teste depende de espera real, IP externo ou dados publicados; varredura não encontra material sensível; lint, tipos, testes e build passam.
- **Riscos ou premissas:** esta tarefa consolida evidência, não posterga testes que pertencem às fases anteriores nem substitui o `review` independente.

## Orientações de implementação

- Não confiar implicitamente na semântica de biblioteca; o armazenamento precisa provar a janela fixa aprovada.
- Manter a tabela de políticas em uma única fonte no código e espelhar exatamente a ADR-004.
- Não registrar IP bruto especificamente para rate limit; métricas são agregadas por template.

## Testes e verificações da fase

Executar a validação padrão, exportar/validar OpenAPI e rodar a matriz de limites com relógio/IP controlados. Comparar os limites no código com a ADR-004 e confirmar que toda rota concluída possui política explícita.

## Critérios de aceitação da fase

1. Fixed Window, chave e ordem do pipeline coincidem com a ADR-004.
2. Cada operação aceita exatamente seu limite e rejeita a próxima com `429` e `Retry-After` correto.
3. IP, método e template produzem buckets independentes; IDs concretos compartilham o template.
4. `OPTIONS` não autentica nem consome o bucket de negócio.
5. OpenAPI UI/JSON e comportamento E2E descrevem o mesmo contrato.
6. Todos os critérios do PRD têm evidência automatizada e não há vazamento sensível.

## Riscos, premissas e dependências externas da fase

- `/docs` e `/docs-json` possuem políticas explícitas na ADR-004 e não dependem do fallback provisório.
- O rate limit em memória não autoriza segunda instância.
- Proteção volumétrica de `OPTIONS` pertence à borda e permanece fora do contador da aplicação.
