# Requisitos do back-end

## Objetivo

Desenvolver uma API robusta para cadastro e autenticação de usuários e gestão de produtos. Todas as rotas de produtos devem ser protegidas por JWT, a listagem deve ser paginada e a API deve aplicar rate limit.

## Tecnologias Utilizadas

- Node.js e TypeScript.
- NestJS.
- Autenticação com JWT.
- Banco de dados DynamoDB.

## Requisitos funcionais

### Cadastro de usuários

- O cadastro receberá nome, e-mail e senha.
- O e-mail será normalizado e único.
- A senha será armazenada somente como hash seguro.
- O cadastro não criará sessão nem emitirá JWT automaticamente.
- O endpoint público terá validação e rate limit próprios.

### Autenticação

- O login validará e-mail e senha e gravará um access token JWT válido por 15 minutos em cookie seguro e inacessível ao JavaScript.
- O JWT não será retornado no corpo da resposta de login.
- Credenciais inválidas produzirão mensagem genérica, sem revelar se o usuário existe.
- A resposta nunca exporá senha, hash ou detalhes internos do usuário.
- O logout removerá o cookie de autenticação sem exigir estado de sessão no servidor.

### CRUD de produtos

A API permitirá:

- criar um produto;
- listar produtos de forma paginada;
- consultar um produto por identificador;
- atualizar um produto existente;
- excluir um produto.

A atualização parcial aceitará somente os campos editáveis enviados, exigirá ao menos um campo e rejeitará valores `null` ou desconhecidos.

Todas as rotas de produtos serão protegidas por JWT. Nesta versão, qualquer usuário autenticado poderá visualizar e gerenciar o catálogo compartilhado, sem perfis, papéis ou separação por proprietário.

## Validação e respostas

- Todas as entradas serão validadas.
- Erros de autenticação, validação, conflito e recurso não encontrado terão respostas consistentes.
- Operações e respostas constarão na documentação OpenAPI.
- A listagem usará paginação por cursor opaco alinhada ao DynamoDB.
- Requisições acima do limite retornarão `429 Too Many Requests`.
- Erros seguirão um schema único com código HTTP, código estável, mensagem segura e identificador de correlação.
- `GET /health` representará readiness da API e retornará `503` quando o DynamoDB necessário não estiver disponível.

## Integração com clientes web

- Navegadores consumirão a API diretamente, sem endpoints intermediários.
- A API aceitará credenciais somente das origens web explicitamente configuradas, sem curinga em CORS.
- Requisições autenticadas deverão enviar o cookie automaticamente, sem permitir que o JavaScript leia o JWT.
- Operações que alteram estado exigirão uma proteção CSRF verificável pela API.

## Entregáveis

- Documentação OpenAPI acessível pela aplicação e exportável em JSON.
- Documentação dos fluxos e contratos da API.
- Descrição das tabelas e padrões de acesso ao DynamoDB.
- Testes unitários dos domínios e casos de uso.
- Testes de integração dos adaptadores de persistência.
- Testes E2E de cadastro, login, logout, autorização, CORS, preflight, CSRF, health, paginação, CRUD e rate limit.
- Instruções de configuração, execução, testes e build no `README.md` do projeto implementado.

## Critérios de entrega

- Cadastro, login e CRUD atendem ao contrato documentado.
- Senhas nunca são persistidas ou registradas em texto puro.
- Rotas de produtos recusam tokens ausentes, inválidos ou expirados.
- O login e o logout criam e removem o cookie conforme o contrato, sem expor o JWT ao JavaScript.
- Origens não autorizadas e operações mutáveis sem a proteção CSRF são recusadas.
- A paginação retorna itens e `nextCursor` quando houver outra página.
- Os testes usam dados determinísticos e ambiente DynamoDB isolado.
- Lint, verificação de tipos, testes e build são executados com sucesso.
