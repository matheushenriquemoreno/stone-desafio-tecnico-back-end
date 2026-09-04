# Fase 03 — Autenticação e proteção do cliente web

| Status       | Pendente   |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-03 |

**Objetivo e resultado esperado:** autenticar contas existentes por uma credencial JWT de 900 segundos transportada exclusivamente em cookie HttpOnly, permitir logout idempotente e bloquear todas as operações de produtos sem credencial válida.

**Capacidade ou fluxo coberto:** login, emissão e validação do JWT/cookie, logout e guard reutilizável, integrados à política CORS/CSRF da fase anterior.

**Requisitos relacionados:** `AAP-10`–`AAP-24`, `AAP-50`, `EXPECT-02`–`EXPECT-08`, `EXPECT-11`.

**Dependências externas:** nenhuma além das dependências do projeto e do DynamoDB Local já estabelecido.

## Tarefa T13 — Implementar emissão e validação JWT HS256 por porta

Definir a porta de token e o adaptador JWT que emite somente `sub`, `iss`, `aud`, `iat` e `exp`, aceita exclusivamente `HS256` e garante `exp - iat = 900`. Validar segredo com no mínimo 256 bits, emissor e audiência no startup, usar relógio injetável e não fornecer valor padrão publicado.

- **Requisitos relacionados:** `AAP-11`, `AAP-18`, `AAP-19`, `EXPECT-02`, `EXPECT-03`, `EXPECT-05`, `EXPECT-07`.
- **Referência ao design:** `DEC-03`, `DEC-04`; seção “JWT e cookie”.
- **Dependências:** `T01`, `T02`.
- **Parte do sistema afetada:** porta de token Auth, adaptador JWT, configuração e testes unitários.
- **Testes e verificações:** emitir/validar com relógio fixo; verificar claims e TTL exatos; recusar algoritmo, assinatura, emissor, audiência e expiração inválidos; confirmar que payload e logs não contêm nome, e-mail ou segredo.
- **Critérios de conclusão:** token válido por exatamente 900 segundos; somente `HS256` é aceito; configuração fraca ou ausente impede startup; falhas não expõem motivo criptográfico ao cliente.
- **Riscos ou premissas:** rotação e múltiplas chaves permanecem fora do escopo; todas as instâncias futuras precisariam compartilhar a mesma configuração.

## Tarefa T14 — Orquestrar autenticação com erro indistinguível

Implementar `AuthenticateUser` para normalizar o e-mail, buscar o usuário, verificar Argon2id e emitir a credencial somente quando conta e senha coincidirem. Conta ausente e senha incorreta devem resultar no mesmo erro `INVALID_CREDENTIALS`, sem diferença pública de mensagem ou status.

- **Requisitos relacionados:** `AAP-10`, `AAP-11`, `AAP-14`, `AAP-15`, `EXPECT-01`, `EXPECT-02`, `EXPECT-04`, `EXPECT-05`.
- **Referência ao design:** `DEC-03`, `DEC-04`, `DEC-11`; fluxo de login.
- **Dependências:** `T07`, `T08`, `T13`.
- **Parte do sistema afetada:** caso de uso `AuthenticateUser` e testes unitários.
- **Testes e verificações:** e-mail normalizado, senha correta/incorreta, conta ausente, usuário persistido inválido e falha técnica; assegurar que emissor de token não roda em credenciais inválidas.
- **Critérios de conclusão:** somente credenciais corretas produzem token; todas as credenciais inválidas geram o mesmo erro público; nenhuma falha cria cookie.
- **Riscos ou premissas:** o teste deve evitar afirmar detalhes de timing não exigidos pelo PRD, mas preservar a indistinguibilidade do contrato.

## Tarefa T15 — Expor login por cookie HttpOnly sem corpo

Criar DTO e `POST /auth/login`, protegido por CORS/CSRF, que chame `AuthenticateUser` e responda `204` com `Set-Cookie`. Em produção o cookie deve ser `__Host-stone_access_token`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain` e `Max-Age=900`; desenvolvimento HTTP usa nome distinto e nunca relaxa a configuração publicada.

- **Requisitos relacionados:** `AAP-10`–`AAP-15`, `AAP-20`–`AAP-22`, `AAP-50`, `EXPECT-02`–`EXPECT-06`.
- **Referência ao design:** `DEC-02`–`DEC-05`, `DEC-13`; contrato `POST /auth/login`.
- **Dependências:** `T10`, `T11`, `T14`.
- **Parte do sistema afetada:** DTO/controller Auth, fábrica/configuração de cookie, serialização OpenAPI e testes E2E.
- **Testes e verificações:** login válido e inválido; inspeção de todos os atributos do cookie, TTL e corpo vazio; CSRF/origem; busca negativa por token em corpo, URL e logs.
- **Critérios de conclusão:** sucesso retorna `204` sem corpo e somente o cookie aprovado; falha retorna `401 INVALID_CREDENTIALS` sem `Set-Cookie`; OpenAPI descreve o fluxo de cookie.
- **Riscos ou premissas:** testes publicados e locais exercitam configurações distintas para impedir que o cookie de desenvolvimento seja promovido por engano.

## Tarefa T16 — Expor logout idempotente com expiração simétrica

Implementar `POST /auth/logout` sem dependência de sessão ou validação obrigatória do JWT. A resposta deve ser `204` e expirar o mesmo cookie com atributos de escopo idênticos, inclusive quando o cookie estiver ausente, inválido ou expirado.

- **Requisitos relacionados:** `AAP-16`, `AAP-17`, `AAP-20`–`AAP-22`, `AAP-50`, `EXPECT-03`, `EXPECT-05`, `EXPECT-06`.
- **Referência ao design:** `DEC-03`, `DEC-05`; contrato `POST /auth/logout`.
- **Dependências:** `T10`, `T11`, `T15`.
- **Parte do sistema afetada:** controller Auth, utilitário de cookie, OpenAPI e testes E2E.
- **Testes e verificações:** cookie válido, inválido, expirado e ausente; confirmar `Max-Age=0`, corpo vazio, atributos simétricos, CSRF obrigatório e ausência de acesso ao DynamoDB.
- **Critérios de conclusão:** todos os quatro cenários retornam `204`; cookie é expirado corretamente; operação não cria lista de revogação nem sessão.
- **Riscos ou premissas:** uma cópia do JWT continua válida até expirar, limitação aceita e documentada.

## Tarefa T17 — Proteger o módulo Products com extração exclusiva do cookie

Criar estratégia e guard de autenticação que extrai o JWT apenas do cookie configurado, valida-o pela porta e disponibiliza somente a identidade mínima ao contexto da requisição. Aplicar o guard no controller/módulo de produtos como política padrão e mapear ausência, invalidade ou expiração para `401 UNAUTHORIZED`.

- **Requisitos relacionados:** `AAP-18`, `AAP-19`, `AAP-49`, `AAP-50`, `EXPECT-02`–`EXPECT-06`.
- **Referência ao design:** `DEC-03`, `DEC-04`; seção “Módulo Products — apresentação”.
- **Dependências:** `T03`, `T13`.
- **Parte do sistema afetada:** estratégia JWT, extractor de cookie, guard, metadados do módulo Products e testes HTTP.
- **Testes e verificações:** cookie válido, ausente, malformado, assinatura/claims inválidos e expirado; provar que `Authorization: Bearer` não autentica; confirmar erro genérico e logs sem JWT.
- **Critérios de conclusão:** nenhuma rota de produtos pode ser exposta sem o guard; único mecanismo aceito é o cookie; identidade válida não cria estado de sessão.
- **Riscos ou premissas:** a cobertura de todas as rotas será reafirmada nas Fases 04 e 05 e consolidada em `T33`.

## Orientações de implementação

- O pipeline deve manter a ordem: correlação → CORS/preflight → rate limit futuro → CSRF/origem para mutações → autenticação → validação/caso de uso.
- A configuração de cookie deve ser centralizada para garantir simetria entre login e logout.
- Não introduzir Bearer, refresh token, sessão, revogação ou papel de usuário.

## Testes e verificações da fase

Executar a validação padrão do projeto e os E2E de cadastro → login → acesso protegido → logout. Inspecionar diretamente headers, corpo e logs; usar relógio controlado para expiração sem espera real.

## Critérios de aceitação da fase

1. Login válido cria somente o cookie aprovado por 900 segundos e retorna `204` sem corpo.
2. Login inválido é indistinguível quanto à existência da conta e não cria cookie.
3. Logout é idempotente e expira o cookie com escopo simétrico.
4. Rotas de produtos aceitam apenas cookie JWT válido e recusam Bearer, ausência, invalidade e expiração.
5. CORS, preflight e CSRF funcionam sem criar sessão ou endpoint intermediário.

## Riscos, premissas e dependências externas da fase

- Relógio do ambiente publicado precisa permanecer sincronizado; testes usam relógio injetado.
- O segredo HS256 deve ser compartilhado se houver mais de uma instância futura, mas o rate limit ainda impede esse escalonamento nesta versão.
- O cookie de produção pressupõe HTTPS e cliente no mesmo site registrável, conforme design aprovado.
