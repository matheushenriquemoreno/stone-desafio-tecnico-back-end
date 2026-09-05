# API de cadastro, autenticação e catálogo de produtos

| Status       | Aprovado   |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-05 |

## Histórico de atualizações

| Data       | Alteração |
|------------|-----------|
| 2026-09-03 | Versão inicial consolidada a partir dos requisitos, contratos e decisões aceitas do back-end. |
| 2026-09-03 | PRD aprovado pelo solicitante após definição das validações de produto e dos limites de paginação. |
| 2026-09-04 | Revisão material da proteção CSRF: cookie `SameSite=Strict`, validação `Origin`/`Referer` e compatibilidade explícita com clientes sem contexto de navegador. |
| 2026-09-05 | Revisão material aprovada: a listagem passa a retornar a quantidade total exata de produtos no campo obrigatório `total`. |

## Visão geral

Esta iniciativa entrega uma API independente para que pessoas possam criar uma conta, autenticar-se com segurança e acessar um catálogo compartilhado de produtos. Pessoas autenticadas poderão criar, listar, consultar, atualizar e excluir produtos, enquanto clientes web terão um contrato consistente para integrar esses fluxos. A solução também deverá oferecer proteção contra abuso, respostas de erro seguras, documentação operacional e um indicador de prontidão. O escopo é exclusivo dos domínios de usuários, autenticação e produtos.

## Problema e impacto

**Problema:** ainda não existe uma API executável que permita a um cliente web cadastrar usuários, autenticar seu acesso e administrar um catálogo compartilhado de produtos por meio de contratos HTTP estáveis e protegidos.

**Quem é afetado:** pessoas que precisam criar uma conta e acessar o catálogo, pessoas autenticadas que gerenciam produtos, desenvolvedores que integram clientes web e avaliadores que precisam verificar o desafio de ponta a ponta.

**Impacto se não for resolvido:** o fluxo depende de preparação manual de usuários, o catálogo não pode ser administrado por uma interface consumidora e os requisitos de segurança, integração e qualidade do desafio não podem ser demonstrados objetivamente.

## Usuários e perfis afetados

| Perfil | Contexto de uso | Necessidade principal |
|--------|-----------------|----------------------|
| Visitante | Primeiro acesso por um cliente web | Criar uma conta e autenticar-se sem manipular credenciais internas da API. |
| Pessoa autenticada | Uso cotidiano do catálogo compartilhado | Visualizar e gerenciar produtos dentro das regras do catálogo. |
| Desenvolvedor de cliente web | Integração direta com a API | Consumir contratos previsíveis de autenticação, produtos, paginação e erros. |
| Pessoa avaliadora | Validação funcional e técnica do desafio | Executar fluxos reproduzíveis e verificar os critérios de entrega. |

## Objetivos e critérios de sucesso

| Objetivo | Critério de sucesso | Forma de verificação |
|----------|--------------------|----------------------|
| Permitir a criação de contas sem preparação manual | Um visitante consegue cadastrar dados válidos, recebe apenas dados públicos da nova conta e não é autenticado automaticamente. | Testes E2E de cadastro válido, validação, normalização e duplicidade. |
| Oferecer autenticação segura para clientes web | Login válido cria uma credencial protegida por 15 minutos; login inválido não revela a existência da conta; logout remove a credencial do navegador. | Inspeção das respostas HTTP e testes E2E de login, autorização, expiração e logout. |
| Disponibilizar o catálogo compartilhado de produtos | Uma pessoa autenticada consegue executar criação, listagem paginada, consulta, atualização parcial e exclusão conforme o contrato. | Testes E2E cobrindo os cinco comportamentos e seus erros. |
| Entregar uma API integrável e verificável | OpenAPI, erros padronizados, readiness, rate limit, CORS e proteção contra requisições forjadas funcionam como documentado. | Validação do documento OpenAPI, testes automatizados e execução bem-sucedida de lint, verificação de tipos e build. |

## Escopo e não objetivos

### Dentro do escopo

- Cadastro público de usuários com nome, e-mail e senha.
- Login com credencial de curta duração protegida do JavaScript.
- Logout idempotente.
- Autorização das operações de produtos.
- Criação de produtos.
- Listagem paginada de produtos.
- Consulta individual de produtos.
- Atualização parcial de produtos.
- Exclusão de produtos.
- Catálogo compartilhado entre todas as pessoas autenticadas.
- Validação das entradas públicas.
- Respostas de erro padronizadas e seguras.
- Proteção contra abuso por limites de requisição.
- Integração direta e controlada com clientes web.
- Proteção das operações que alteram estado contra requisições forjadas.
- Documentação OpenAPI acessível e exportável.
- Endpoint público de readiness.
- Entrega automatizada e reproduzível do back-end para o ambiente demonstrativo.

### Fora do escopo

- Pedidos — o domínio e o CRUD desta iniciativa são exclusivamente de produtos.
- Interface front-end — este repositório entrega somente a API; a interface é um cliente externo.
- Camada BFF ou endpoints intermediários — o navegador consumirá a API diretamente.
- Perfis, papéis ou aprovação administrativa — qualquer pessoa autenticada possui as mesmas permissões sobre o catálogo compartilhado.
- Separação de produtos por proprietário — produtos não pertencem individualmente ao usuário que os criou.
- Confirmação de e-mail — a posse do endereço não será comprovada nesta versão.
- Recuperação ou alteração de senha — o fluxo inicial cobre somente cadastro e login.
- Login automático após cadastro — cadastro e autenticação permanecem operações independentes.
- Upload, armazenamento ou processamento do arquivo de imagem — somente a URL HTTP(S) será recebida e mantida.
- Pesquisa, filtros ou ordenação global de produtos — não há padrão de acesso aprovado para essas capacidades.
- Paginação por número de página ou deslocamento — a navegação será sequencial por cursor.
- Salto direto para página ainda não visitada — o contrato não oferece acesso aleatório às páginas.
- Autenticação por `Authorization: Bearer` — esta versão expõe um único mecanismo de autenticação para clientes web.
- Endpoint HTTP de liveness — o estado do processo ou container cumprirá essa função.
- Garantias corporativas de alta disponibilidade, recuperação de desastre ou implantação sem interrupção — o ambiente publicado é demonstrativo e opera com uma instância.

### Adiado

- Refresh token e renovação silenciosa — adiados para evitar um segundo ciclo de credenciais no escopo inicial.
- Revogação antecipada de tokens e sessões persistidas — adiadas porque a autenticação inicial é stateless e a credencial expira em 15 minutos.
- Rate limit distribuído e execução com múltiplas instâncias — adiados enquanto a demonstração operar em uma única instância.
- Índice ou remodelagem para listagens de grande volume — adiados até existir um padrão de acesso ou escala que justifique a evolução.
- TLS no trecho entre a borda e a origem — reconhecido como evolução obrigatória antes de reutilizar a arquitetura como referência de produção.

## Requisitos funcionais

Prioridades: **Essencial** bloqueia a entrega; **Importante** deve entrar; **Desejável** entra se não comprometer os demais requisitos.

### Cadastro de usuários

- **Essencial** `AAP-01` O sistema deve permitir que um visitante solicite o cadastro informando nome, e-mail e senha.
- **Essencial** `AAP-02` O sistema deve aceitar nomes com comprimento entre 2 e 100 caracteres após a normalização aplicável.
- **Essencial** `AAP-03` O sistema deve aceitar senhas com comprimento entre 8 e 128 caracteres.
- **Essencial** `AAP-04` O sistema deve remover espaços nas extremidades do e-mail antes de utilizá-lo.
- **Essencial** `AAP-05` O sistema deve converter o e-mail para letras minúsculas antes de utilizá-lo.
- **Essencial** `AAP-06` O sistema deve rejeitar um e-mail que não possua formato válido.
- **Essencial** `AAP-07` O sistema deve impedir o cadastro de mais de uma conta com o mesmo e-mail normalizado.
- **Essencial** `AAP-08` O sistema deve retornar somente identificador, nome e e-mail após um cadastro válido.
- **Essencial** `AAP-09` O sistema deve manter cadastro e autenticação como operações separadas.

### Autenticação

- **Essencial** `AAP-10` O sistema deve autenticar uma pessoa quando o e-mail normalizado e a senha corresponderem a uma conta cadastrada.
- **Essencial** `AAP-11` O sistema deve criar uma credencial de acesso válida por exatamente 900 segundos após um login válido.
- **Essencial** `AAP-12` O sistema deve entregar a credencial de acesso somente em cookie inacessível ao JavaScript.
- **Essencial** `AAP-13` O sistema deve concluir um login válido sem retornar a credencial no corpo da resposta.
- **Essencial** `AAP-14` O sistema deve responder a credenciais inválidas com uma mensagem genérica que não revele a existência da conta.
- **Essencial** `AAP-15` O sistema deve evitar a criação do cookie de autenticação quando as credenciais forem inválidas.
- **Essencial** `AAP-16` O sistema deve remover o cookie de autenticação quando o logout for solicitado.
- **Essencial** `AAP-17` O sistema deve concluir o logout com sucesso mesmo quando o cookie estiver ausente, inválido ou expirado.

### Autorização e proteção do cliente web

- **Essencial** `AAP-18` O sistema deve exigir uma credencial válida em todas as operações de produtos.
- **Essencial** `AAP-19` O sistema deve recusar operações de produtos quando a credencial estiver ausente, inválida ou expirada.
- **Essencial** `AAP-20` O sistema deve permitir credenciais do navegador somente para origens web explicitamente autorizadas.
- **Essencial** `AAP-21` O sistema deve proteger operações mutáveis com cookie `SameSite=Strict` e validação de origem conforme o contrato.
- **Essencial** `AAP-22` O sistema deve recusar operações mutáveis originadas de uma origem web não autorizada.
- **Importante** `AAP-60` O sistema deve aceitar operações mutáveis sem `Origin` e `Referer` e encaminhá-las para autenticação, validação e caso de uso.
- **Importante** `AAP-23` O sistema deve responder ao preflight de uma origem autorizada sem exigir autenticação.
- **Importante** `AAP-24` O sistema deve evitar que o preflight consuma o limite da operação de negócio correspondente.

### Produtos

- **Essencial** `AAP-25` O sistema deve permitir que uma pessoa autenticada crie um produto informando nome, descrição, preço e URL da imagem.
- **Essencial** `AAP-26` O sistema deve aceitar nomes de produto com comprimento entre 2 e 100 caracteres.
- **Essencial** `AAP-27` O sistema deve aceitar descrições de produto com comprimento entre 1 e 500 caracteres.
- **Essencial** `AAP-28` O sistema deve aceitar somente preços maiores que zero com até duas casas decimais.
- **Essencial** `AAP-29` O sistema deve aceitar somente URLs de imagem HTTP(S) com no máximo 2.048 caracteres.
- **Essencial** `AAP-30` O sistema deve retornar identificador, nome, descrição, preço, URL da imagem, data de criação e data da última atualização para cada produto.
- **Essencial** `AAP-31` O sistema deve listar produtos para uma pessoa autenticada.
- **Essencial** `AAP-32` O sistema deve paginar a listagem de produtos por cursor opaco.
- **Essencial** `AAP-33` O sistema deve usar 20 produtos como limite padrão quando o cliente não informar `limit`.
- **Essencial** `AAP-34` O sistema deve aceitar `limit` inteiro entre 1 e 100 produtos por requisição.
- **Essencial** `AAP-35` O sistema deve retornar `nextCursor` quando existir uma próxima página.
- **Essencial** `AAP-36` O sistema deve omitir `nextCursor` quando não existir uma próxima página.
- **Essencial** `AAP-37` O sistema deve rejeitar cursores inválidos sem expor seu conteúdo interno.
- **Essencial** `AAP-61` O sistema deve retornar em toda listagem a quantidade total exata de produtos existentes no catálogo, independentemente do limite ou cursor solicitado.
- **Essencial** `AAP-38` O sistema deve permitir a consulta de um produto por seu identificador.
- **Essencial** `AAP-39` O sistema deve permitir a atualização parcial de nome, descrição, preço ou URL da imagem.
- **Essencial** `AAP-40` O sistema deve preservar os campos editáveis que forem omitidos em uma atualização parcial.
- **Essencial** `AAP-41` O sistema deve exigir ao menos um campo editável em uma atualização parcial.
- **Essencial** `AAP-42` O sistema deve rejeitar valores nulos em uma atualização parcial.
- **Essencial** `AAP-43` O sistema deve rejeitar propriedades desconhecidas em uma atualização parcial.
- **Essencial** `AAP-44` O sistema deve aplicar à atualização parcial as mesmas validações de cada campo usadas na criação.
- **Essencial** `AAP-45` O sistema deve permitir a exclusão de um produto por seu identificador.
- **Essencial** `AAP-46` O sistema deve informar que o produto não foi encontrado ao consultar um identificador inexistente.
- **Essencial** `AAP-47` O sistema deve informar que o produto não foi encontrado ao atualizar um identificador inexistente.
- **Essencial** `AAP-48` O sistema deve informar que o produto não foi encontrado ao excluir um identificador inexistente.
- **Essencial** `AAP-49` O sistema deve permitir que qualquer pessoa autenticada gerencie qualquer produto do catálogo compartilhado.

### Respostas, proteção contra abuso e operação

- **Essencial** `AAP-50` O sistema deve responder a todo erro com código HTTP, código estável, mensagem segura e identificador de correlação.
- **Essencial** `AAP-51` O sistema deve identificar os campos públicos afetados por um erro de validação.
- **Essencial** `AAP-52` O sistema deve omitir valores sensíveis recebidos dos detalhes de erros de validação.
- **Essencial** `AAP-53` O sistema deve limitar requisições por IP efetivo, método HTTP e operação conforme a política deste PRD.
- **Essencial** `AAP-54` O sistema deve responder ao limite excedido com status `429`.
- **Essencial** `AAP-55` O sistema deve informar em `Retry-After` os segundos restantes da janela atual ao recusar uma requisição por limite excedido.
- **Importante** `AAP-56` O sistema deve disponibilizar documentação OpenAPI acessível pela aplicação.
- **Importante** `AAP-57` O sistema deve permitir a exportação da documentação OpenAPI em JSON.
- **Essencial** `AAP-58` O sistema deve informar readiness positivo somente quando a aplicação estiver inicializada e conseguir acessar os dados necessários de usuários e produtos.
- **Essencial** `AAP-59` O sistema deve responder com indisponibilidade temporária quando alguma dependência necessária ao readiness não estiver acessível.

## Expectativas não funcionais

- **EXPECT-01** Senhas devem permanecer protegidas contra leitura direta durante todo o armazenamento.
- **EXPECT-02** Senhas em texto puro, hashes de senha, JWTs, credenciais de infraestrutura e cabeçalhos de autenticação não devem aparecer em respostas, URLs ou logs.
- **EXPECT-03** O cookie publicado deve possuir escopo restrito ao host da API, transporte seguro, inacessibilidade ao JavaScript, política `SameSite=Strict`, caminho raiz e expiração compatível com a credencial.
- **EXPECT-04** Mensagens de erro não devem expor stack trace, detalhes da infraestrutura ou informação que permita enumerar contas.
- **EXPECT-05** A API deve continuar sem estado de sessão entre requisições autenticadas.
- **EXPECT-06** Contratos públicos de cadastro, autenticação, produtos, paginação e erros devem permanecer descritos na documentação OpenAPI.
- **EXPECT-07** Testes automatizados que dependam de tempo, IP ou dados persistidos devem ser determinísticos e usar ambiente de dados isolado.
- **EXPECT-08** Lint, verificação de tipos, testes e build devem ser executáveis por comandos documentados e concluir com sucesso antes da entrega.
- **EXPECT-09** A imagem publicada da aplicação deve ser reproduzível, imutável por versão e executada sem privilégios administrativos.
- **EXPECT-10** Segredos de ambiente não devem ser incluídos na imagem publicada nem versionados no repositório.
- **EXPECT-11** Logs operacionais devem permitir correlação de falhas sem registrar dados pessoais ou credenciais desnecessárias.

## Regras de negócio e restrições

### Regras de negócio

- O e-mail normalizado identifica unicamente uma conta.
- O cadastro não concede acesso autenticado automaticamente.
- Uma credencial de acesso permanece válida por no máximo 15 minutos a partir de sua emissão.
- O logout remove a credencial do navegador, mas não revoga uma cópia do token antes de sua expiração.
- Todos os usuários autenticados possuem a mesma capacidade de leitura e manutenção do catálogo.
- Um produto pertence ao catálogo compartilhado, não ao usuário que o criou.
- Um produto válido possui nome entre 2 e 100 caracteres.
- Um produto válido possui descrição entre 1 e 500 caracteres.
- Um produto válido possui preço maior que zero com até duas casas decimais.
- Um produto válido referencia uma imagem por URL HTTP(S) de até 2.048 caracteres.
- O arquivo da imagem não faz parte do produto mantido pela API.
- O cursor de paginação é um valor opaco que o cliente deve apenas armazenar e reenviar.
- O campo `total` da listagem representa todos os produtos existentes no catálogo, e não somente a quantidade de itens da página atual.
- A ausência de `nextCursor` representa o fim da listagem.
- A API não garante ordenação global da listagem de produtos.
- Uma atualização parcial modifica somente os campos editáveis recebidos e válidos.
- Produtos inexistentes geram uma resposta de recurso não encontrado nas operações individuais.
- Respostas de erro usam os códigos estáveis `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `REQUEST_FORBIDDEN`, `PRODUCT_NOT_FOUND`, `EMAIL_ALREADY_EXISTS`, `RATE_LIMIT_EXCEEDED`, `SERVICE_UNAVAILABLE` ou `INTERNAL_ERROR`, conforme a situação.

#### Política de limites de requisição

| Operação | Acesso | Limite por IP | Janela |
|----------|--------|--------------:|-------:|
| Cadastro | Público | 5 requisições | 15 minutos |
| Login | Público | 10 requisições | 15 minutos |
| Logout | Cookie opcional | 20 requisições | 1 minuto |
| Listar produtos | Autenticado | 60 requisições | 1 minuto |
| Criar produto | Autenticado | 20 requisições | 1 minuto |
| Consultar produto | Autenticado | 60 requisições | 1 minuto |
| Atualizar produto | Autenticado | 20 requisições | 1 minuto |
| Excluir produto | Autenticado | 10 requisições | 1 minuto |
| Consultar readiness | Público | 120 requisições | 1 minuto |

- Requisições rejeitadas por autenticação ou validação consomem o limite da operação.
- Diferentes identificadores de produto compartilham o mesmo limite para o mesmo método e operação.
- Requisições acima do limite permanecem bloqueadas até o encerramento da janela vigente.
- Cada nova operação HTTP ainda não documentada recebe provisoriamente o limite de 30 requisições por minuto por IP, mas precisa de política explícita antes de ser considerada concluída.

### Restrições

- A API será REST com corpos JSON, implementada com Node.js LTS, TypeScript em modo estrito e NestJS — tecnologias obrigatórias do desafio.
- Os dados serão persistidos no DynamoDB — tecnologia obrigatória do desafio.
- Usuários e produtos permanecerão em conjuntos de dados independentes — decisão aceita para os padrões de acesso atuais.
- A autenticação de clientes web utilizará JWT transportado por cookie — não haverá mecanismo Bearer alternativo nesta versão.
- Operações mutáveis validarão `Origin` e, somente quando ele estiver ausente, a origem extraída de `Referer`; quando ambos estiverem ausentes, a chamada seguirá para autenticação e validação conforme `AAP-60`.
- CORS aceitará somente origens exatas configuradas — curingas são incompatíveis com a proteção adotada.
- O ambiente publicado operará com uma única instância da API — os limites em memória não são globais entre instâncias.
- O ambiente local e os testes utilizarão uma instância isolada do DynamoDB Local — dados de teste não devem atingir o ambiente publicado.
- O ambiente demonstrativo será publicado por container atrás de NGINX e Cloudflare, com DynamoDB gerenciado pela AWS — topologia aceita para o desafio.
- A comunicação pública chegará à borda por HTTPS; o trecho HTTP entre Cloudflare e a origem é uma limitação exclusiva da demonstração e não deve ser tratado como prática de produção.
- As permissões de execução sobre dados serão limitadas às operações necessárias de usuários, produtos e readiness — operações administrativas usarão identidade separada.

## Premissas

- O volume inicial de produtos será pequeno o suficiente para sustentar uma listagem integral paginada — risco: volumes maiores aumentam custo e latência, exigindo novo padrão de acesso.
- A contagem exata observa o catálogo durante a requisição, sem snapshot transacional entre páginas internas — risco: criações ou exclusões concorrentes podem produzir diferença momentânea, corrigida na requisição seguinte.
- A demonstração executará somente uma instância da API — risco: uma segunda instância tornaria os limites de requisição inconsistentes entre processos.
- O cliente web publicado e a API pertencerão ao mesmo site registrável — risco: hospedagem permanente em outro site pode impedir o envio esperado do cookie.
- O cliente web enviará credenciais em todas as chamadas; o cookie usará `SameSite=Strict` e as mutações terão origem autorizada — risco: uma origem não cadastrada será recusada.
- Clientes back-end que usam cookie são compatíveis quando omitem `Origin` e `Referer`; esse uso é transitório e não substitui API key, mTLS ou client credentials para integrações máquina-a-máquina.
- A cadeia de proxies publicada será configurada como confiável e impedirá que o cliente falsifique o IP efetivo — risco: configuração incorreta compromete a justiça e a eficácia dos limites.
- As tabelas necessárias estarão provisionadas antes de a aplicação receber tráfego — risco: a API permanecerá indisponível no readiness até a correção operacional.
- Não existe base legada que precise ser migrada — risco: dados anteriores exigiriam uma estratégia de migração fora deste PRD.

## Fluxos e casos de borda

### Fluxos principais

- **Cadastro e acesso:** o visitante envia nome, e-mail e senha; a API valida e cria a conta; o visitante realiza uma chamada separada de login; a API valida as credenciais e cria o cookie; o navegador passa a enviar o cookie automaticamente.
- **Listagem paginada:** a pessoa autenticada solicita a lista; a API retorna até o limite aplicável e a quantidade total de produtos do catálogo; o cliente usa `nextCursor` para buscar a próxima página; a navegação termina quando `nextCursor` não estiver presente.
- **Criação:** a pessoa autenticada envia os quatro campos editáveis; a API valida os valores; um novo produto com identificador e datas é devolvido.
- **Consulta:** a pessoa autenticada informa o identificador; a API devolve o produto correspondente ou o erro seguro de produto não encontrado.
- **Atualização:** a pessoa autenticada envia ao menos um campo editável; a API valida apenas os campos recebidos; campos omitidos permanecem inalterados; o produto atualizado é devolvido.
- **Exclusão:** a pessoa autenticada informa o identificador; a API remove o produto existente; a resposta de sucesso não inclui corpo.
- **Logout:** o cliente solicita a saída; a API expira o cookie mesmo quando ele estiver ausente ou não for mais válido.

### Estados vazios

- A primeira listagem de um catálogo sem produtos retorna `items` vazio, `total` igual a zero e não retorna `nextCursor`.
- Uma página final retorna os itens restantes e não retorna `nextCursor`.
- Um logout sem cookie continua sendo tratado como concluído.

### Erros e falhas

- Dados de entrada inválidos retornam erro de validação com os campos públicos afetados.
- Cadastro com e-mail já existente retorna conflito sem alterar a conta existente.
- Credenciais de login inválidas retornam resposta genérica e não criam cookie.
- Cookie ausente, inválido ou expirado impede o acesso aos produtos.
- `Origin` ausente, nulo, malformado ou não autorizado, e `Referer` malformado ou não autorizado quando usado como fallback, impede a operação antes da execução do caso de uso; a ausência dos dois headers é aceita conforme `AAP-60`.
- Identificador de produto inexistente retorna produto não encontrado nas operações individuais.
- Cursor ou limite de paginação inválido retorna erro de validação.
- Limite de requisições excedido retorna `429`, `Retry-After` e o schema de erro padrão.
- Falha de uma dependência necessária faz o readiness retornar `503` sem expor qual dependência falhou.
- Falhas inesperadas retornam mensagem segura com identificador de correlação, sem detalhes internos.

### Limites

- Nome do usuário: 2 a 100 caracteres após a normalização aplicável.
- Senha: 8 a 128 caracteres.
- Nome do produto: 2 a 100 caracteres.
- Descrição do produto: 1 a 500 caracteres.
- Preço: maior que zero e com no máximo duas casas decimais.
- URL da imagem: esquema HTTP(S) e no máximo 2.048 caracteres.
- Credencial de acesso: 900 segundos.
- Página de produtos: padrão de 20 itens; mínimo de 1; máximo de 100.
- Navegação entre páginas: sequencial por cursor, sem salto por número de página.
- Requisições: limites por operação definidos na política deste PRD.

## Critérios de aceitação

1. Dado um cadastro válido, a API cria uma conta única e responde `201` somente com identificador, nome e e-mail. (`AAP-01` a `AAP-09`)
2. Dado um e-mail com letras maiúsculas ou espaços nas extremidades, a API aplica a normalização antes de verificar a unicidade. (`AAP-04`, `AAP-05`, `AAP-07`)
3. Dado um e-mail já cadastrado após normalização, a API responde `409` com `EMAIL_ALREADY_EXISTS`. (`AAP-07`, `AAP-50`)
4. Dadas credenciais válidas, a API responde `204` e cria o cookie de autenticação com validade de 900 segundos sem retornar o JWT no corpo. (`AAP-10` a `AAP-13`)
5. Dadas credenciais inválidas, a API responde `401` com `INVALID_CREDENTIALS`, não informa se a conta existe e não cria cookie. (`AAP-14`, `AAP-15`, `AAP-50`)
6. Dado um logout com cookie válido, inválido, expirado ou ausente, a API responde `204` e envia a expiração do cookie. (`AAP-16`, `AAP-17`)
7. Dada uma operação de produto sem cookie válido, a API responde `401` com `UNAUTHORIZED`. (`AAP-18`, `AAP-19`, `AAP-50`)
8. Dada uma operação mutável, a API valida `Origin` ou o fallback `Referer`, rejeita origem nula, malformada ou não autorizada com `403 REQUEST_FORBIDDEN`, nunca compensa `Origin` inválido com `Referer` válido e aceita a ausência simultânea dos dois headers para seguir à autenticação. (`AAP-21`, `AAP-22`, `AAP-50`, `AAP-60`)
9. Dada uma origem autorizada, o preflight anuncia métodos e cabeçalhos permitidos sem consumir o limite da operação real. (`AAP-20`, `AAP-23`, `AAP-24`)
10. Dado um produto que atende a todos os limites de campo, uma pessoa autenticada consegue criá-lo e recebe o recurso completo com `201`. (`AAP-25` a `AAP-30`)
11. Dado um produto com nome, descrição, preço ou URL da imagem fora das regras, a API responde `400` com `VALIDATION_ERROR`. (`AAP-26` a `AAP-29`, `AAP-51`, `AAP-52`)
12. Dado um catálogo vazio, a listagem retorna `200`, `items` vazio, `total` igual a zero e nenhum `nextCursor`. (`AAP-31`, `AAP-36`, `AAP-61`)
13. Dado um catálogo com mais itens que o limite, a listagem retorna no máximo o limite solicitado e fornece `nextCursor` para a continuação. (`AAP-32` a `AAP-35`)
14. Quando `limit` é omitido, a listagem considera 20 produtos; quando está fora do intervalo de 1 a 100 ou não é inteiro, a API responde `400`. (`AAP-33`, `AAP-34`)
15. Dado um cursor devolvido pela API, o cliente obtém a página seguinte sem interpretar o valor; dado um cursor inválido, recebe `400` sem detalhes internos. (`AAP-32`, `AAP-37`)
16. Dado um identificador existente, uma pessoa autenticada consulta o produto completo com `200`. (`AAP-30`, `AAP-38`)
17. Dada uma atualização parcial válida, somente os campos enviados são alterados e a resposta contém o produto atualizado. (`AAP-39`, `AAP-40`, `AAP-44`)
18. Dada uma atualização vazia, com valor nulo ou propriedade desconhecida, a API responde `400` sem alterar o produto. (`AAP-41` a `AAP-43`)
19. Dado um identificador existente, uma pessoa autenticada exclui o produto e recebe `204` sem corpo. (`AAP-45`)
20. Dado um identificador inexistente em consulta, atualização ou exclusão, a API responde `404` com `PRODUCT_NOT_FOUND`. (`AAP-46` a `AAP-48`, `AAP-50`)
21. Dado um produto criado por outra conta, qualquer pessoa autenticada consegue consultá-lo, atualizá-lo ou excluí-lo. (`AAP-49`)
22. Dado o número máximo permitido de requisições para uma operação e um IP, a requisição seguinte dentro da mesma janela recebe `429`, `RATE_LIMIT_EXCEEDED` e `Retry-After`. (`AAP-53` a `AAP-55`)
23. Dados IPs, métodos ou operações diferentes, os respectivos contadores de requisição permanecem independentes conforme a política. (`AAP-53`)
24. Dada a aplicação pronta e com acesso aos dados necessários, `/health` responde `200` com estado positivo; sem acesso a uma dependência necessária, responde `503` com `SERVICE_UNAVAILABLE`. (`AAP-58`, `AAP-59`)
25. Dada a aplicação em execução, a documentação OpenAPI descreve os endpoints, cookies, cabeçalhos, entradas, respostas e erros definidos neste PRD, além de estar disponível em JSON. (`AAP-56`, `AAP-57`, `EXPECT-06`)
26. A suíte automatizada cobre cadastro, login, logout, autorização, CORS, preflight, proteção por cookie e origem, health, paginação, CRUD, rate limit e persistência isolada; lint, tipos, testes e build concluem com sucesso. (`EXPECT-07`, `EXPECT-08`)
27. A inspeção de respostas, logs, artefatos versionados e imagem publicada não encontra senha em texto puro, hash de senha, JWT ou credencial de infraestrutura. (`EXPECT-01`, `EXPECT-02`, `EXPECT-10`, `EXPECT-11`)
28. Dado um catálogo estável com produtos, toda página retorna em `total` a quantidade exata de produtos do catálogo, independentemente de `limit`, cursor ou quantidade de itens da página. (`AAP-61`)

## Perguntas em aberto

Nenhuma.
