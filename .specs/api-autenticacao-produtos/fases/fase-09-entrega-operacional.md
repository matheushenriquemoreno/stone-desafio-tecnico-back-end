# Fase 09 — Empacotamento, infraestrutura e entrega

| Status       | Em execução |
|--------------|------------|
| Created      | 2026-09-03 |
| Last Updated | 2026-09-05 |

**Objetivo e resultado esperado:** produzir uma imagem imutável e sem privilégios, provisionar os recursos DynamoDB/IAM mínimos e automatizar publicação, deploy, verificação de readiness e rollback por SHA.

**Capacidade ou fluxo coberto:** checkout validado → imagem GHCR por commit → Compose/NGINX na VPS → DynamoDB gerenciado → `/health` público, com retorno seguro ao SHA anterior.

**Requisitos relacionados:** `AAP-20`, `AAP-22`, `AAP-53`, `AAP-58`, `AAP-59`, `EXPECT-02`, `EXPECT-03`, `EXPECT-08`–`EXPECT-11`.

**Dependências externas:** conta AWS, estado remoto Terraform, GHCR, GitHub Actions, VPS Oracle, DNS/proxy Cloudflare, SSH dedicado e segredos de ambiente.

Nesta execução, T39–T43 foram autorizadas para preparação dos artefatos locais.
A configuração de credenciais, aplicação em AWS/VPS, publicação no GHCR e
deploy/readiness/rollback reais permanecem sob responsabilidade do responsável
do projeto.

## Tarefa T39 — Empacotar a API em imagem mínima e sem privilégios

Criar `Dockerfile` multiestágio e `.dockerignore`. A etapa final deve conter somente aplicação compilada e dependências de produção, executar como usuário não administrativo, receber segredos apenas em runtime e expor o processo necessário à readiness/liveness do container. Fixar a versão-base de Node compatível com `T01`.

- **Requisitos relacionados:** `EXPECT-02`, `EXPECT-08`–`EXPECT-10`.
- **Referência ao design:** `DEC-19`; seções “Desenvolvimento em containers” e “Infraestrutura de entrega”.
- **Dependências:** `T01`, `T33`.
- **Parte do sistema afetada:** `Dockerfile`, `.dockerignore`, scripts de start e documentação de build.
- **Testes e verificações:** construir a imagem sem segredos; inspecionar usuário, camadas e conteúdo; iniciar contra DynamoDB Local; executar `/health`; scanner de vulnerabilidades se já disponível no pipeline.
- **Critérios de conclusão:** build é reproduzível; processo não roda como root; imagem não contém `.env`, código/testes desnecessários ou credenciais; aplicação compilada inicia e fica pronta.
- **Riscos ou premissas:** não usar tag flutuante como única identificação; digest/SHA é a referência operacional.

## Tarefa T40 — Provisionar tabelas e IAM mínimo com Terraform

Definir Terraform idempotente para tabelas `users` e `products` em `PAY_PER_REQUEST`, sem sort key/GSI, e política de execução limitada a `DescribeTable`, `GetItem`, `Scan`, `PutItem`, `UpdateItem` e `DeleteItem` nos ARNs dessas tabelas. Separar identidade administrativa de provisionamento da credencial de runtime e documentar backend/variáveis sem incluir segredo.

- **Requisitos relacionados:** `AAP-07`, `AAP-25`, `AAP-31`–`AAP-49`, `AAP-58`, `AAP-59`, `EXPECT-09`, `EXPECT-10`.
- **Referência ao design:** `DEC-06`, `DEC-07`, `DEC-19`; seções “DynamoDB e IAM” e “Migração”.
- **Dependências:** `T19`, `T23`, `T26`, `T27`.
- **Parte do sistema afetada:** diretório Terraform, variáveis, outputs, política IAM e documentação operacional.
- **Testes e verificações:** `terraform fmt -check`, `terraform validate`, análise do plano em ambiente não publicado e verificação automática de ações/recursos permitidos; segundo plano sem mudança após aplicação autorizada.
- **Critérios de conclusão:** modelo corresponde ao design; execução não possui ações administrativas ou tabelas curingas; provisionamento é idempotente; estado e credenciais ficam fora do Git.
- **Riscos ou premissas:** aplicar em AWS altera estado externo e exige credenciais/ambiente fornecidos pelo responsável; testes locais não substituem evidência do plano/aplicação autorizada.

## Tarefa T41 — Configurar Compose e NGINX publicados com cadeia de proxy confiável

Criar manifestos de produção para uma única instância `backend` atrás de `nginx`. Expor somente o NGINX, remover cabeçalhos de encaminhamento recebidos do cliente, reconstruí-los a partir da cadeia Cloudflare confiável, aplicar limites de corpo/timeouts/headers de segurança, rotação de logs e manter segredos em arquivo protegido fora do repositório.

- **Requisitos relacionados:** `AAP-20`, `AAP-22`, `AAP-53`, `EXPECT-02`, `EXPECT-03`, `EXPECT-10`, `EXPECT-11`.
- **Referência ao design:** `DEC-02`, `DEC-12`, `DEC-19`, `DEC-20`; seções “Organização na VPS” e “Segurança operacional”.
- **Dependências:** `T28`, `T39`.
- **Parte do sistema afetada:** Compose de produção, configuração NGINX, exemplo de ambiente e documentação da VPS/Cloudflare.
- **Testes e verificações:** `docker compose config`; teste local do proxy com headers forjados e confiáveis; porta NestJS não publicada; arquivo de segredos ausente do Git; logs sem cookie/JWT; configuração restrita a uma réplica.
- **Critérios de conclusão:** IP efetivo observado pela API coincide com a cadeia confiável; cliente não injeta cabeçalhos autoritativos; somente NGINX é público; segredos não entram na imagem/manifesta.
- **Riscos ou premissas:** o trecho Cloudflare–NGINX permanece HTTP por decisão aceita da demonstração; restringir a origem à Cloudflare quando viável e registrar a necessidade futura de TLS ponta a ponta.

## Tarefa T42 — Validar, publicar e identificar imagens por SHA no CI

Criar workflow GitHub Actions que instale por lockfile, execute `lint`, `typecheck`, testes e build, construa a imagem e publique no GHCR com o SHA completo. Secrets devem ser referenciados apenas no ambiente do workflow e nunca impressos, incorporados na imagem ou substituídos por valores reais no repositório.

- **Requisitos relacionados:** `EXPECT-02`, `EXPECT-08`–`EXPECT-11`.
- **Referência ao design:** `DEC-18`, `DEC-19`; seção “Pipeline”.
- **Dependências:** `T33`, `T39`.
- **Parte do sistema afetada:** `.github/workflows`, configuração GHCR e documentação de CI.
- **Testes e verificações:** validar sintaxe do workflow; executar equivalente local dos jobs; confirmar ordem de gates antes do push; inspecionar tags/digest e logs de uma execução autorizada.
- **Critérios de conclusão:** falha de qualidade impede publicação; imagem é rastreável ao commit; nenhuma credencial aparece em log/artefato; `latest`, se existir, não é referência exclusiva.
- **Riscos ou premissas:** publicação real depende de permissões GHCR e GitHub; evidência local não prova a integração externa.

## Tarefa T43 — Automatizar deploy, readiness e rollback sem apagar dados

Completar o workflow/runbook para acessar a VPS com chave dedicada, atualizar o SHA no Compose, executar pull, recriar somente a API e validar `GET /health` público por HTTPS. Em falha, reapontar ao SHA anterior, recriar o serviço e repetir readiness; nunca destruir ou reverter tabelas como parte do rollback da aplicação.

- **Requisitos relacionados:** `AAP-58`, `AAP-59`, `EXPECT-08`–`EXPECT-11`.
- **Referência ao design:** `DEC-17`, `DEC-19`; seções “Pipeline”, “Rollback” e “Observabilidade”.
- **Dependências:** `T40`–`T42`.
- **Parte do sistema afetada:** workflow de deploy, scripts/runbook da VPS, monitor/readiness e procedimento de rollback.
- **Testes e verificações:** ensaio em ambiente autorizado com deploy de um SHA, readiness positivo, simulação controlada de falha e retorno ao SHA anterior; confirmar tabelas preservadas e registrar duração/resultado.
- **Critérios de conclusão:** deploy só termina após `/health` `200`; falha aciona ou orienta rollback determinístico; SHA anterior volta saudável; nenhum passo destrói dados; evidências externas são anexadas ao estado/review.
- **Riscos ou premissas:** uma instância pode causar segundos de indisponibilidade; credenciais AWS duradouras e trecho HTTP de origem continuam limitações conhecidas da demonstração.

## Orientações de implementação

- Separar Compose local do manifesto publicado e evitar qualquer segredo em ambos.
- Infraestrutura persistente não faz parte do rollback da imagem.
- Usar identidade IAM exclusiva da aplicação e chave SSH dedicada; acesso remoto de root e senha ficam desabilitados conforme o runbook.

## Testes e verificações da fase

Executar a validação padrão, build/execução da imagem, `docker compose config`, `terraform fmt -check`, `terraform validate` e validação estática dos workflows. Quando os serviços externos estiverem autorizados, executar publicação, deploy, readiness e rollback reais e anexar as evidências.

## Critérios de aceitação da fase

1. Imagem reproduzível executa sem privilégios e não contém segredos.
2. Terraform descreve exatamente duas tabelas sob demanda e IAM de menor privilégio.
3. NGINX preserva somente a cadeia confiável e a API permanece em uma instância não exposta diretamente.
4. CI só publica após todos os gates e identifica a imagem pelo SHA.
5. Deploy e rollback reais preservam dados e terminam somente com readiness positivo.
6. Logs e artefatos operacionais não expõem senha, hash, JWT ou credenciais de infraestrutura.

## Riscos, premissas e dependências externas da fase

- Sem acesso autorizado a AWS, GitHub/GHCR, Cloudflare e VPS, os artefatos podem ser validados localmente, mas o marco final permanece pendente.
- Preços e gratuidade da AWS devem ser revistos imediatamente antes da aplicação real, sem alterar o escopo funcional.
- TLS ponta a ponta é evolução obrigatória antes de reutilizar a arquitetura como referência de produção.

## Registro de execução local

| Tarefa | Estado | Evidência |
|--------|--------|-----------|
| T39 | Concluída | `Dockerfile` multiestágio e `.dockerignore`; build, inspeção de usuário/healthcheck/conteúdo, execução efêmera contra DynamoDB Local e gates completos aprovados. |
| T40 | Concluída | Terraform em `infra/terraform/`; `terraform fmt -check -recursive`, `terraform init -backend=false`, `terraform validate` e `git diff --check` aprovados. Apply AWS e segundo plan permanecem externos. |
| T41 | Concluída | Compose de produção e NGINX em `deploy/`; `docker compose config`, `nginx -t` em rede Docker e teste de headers forjados/cookie/logs aprovados. Publicação na VPS permanece externa. |
| T42 | Concluída | Workflow de CI/GHCR em `.github/workflows/api-delivery.yml`; `actionlint` e gates equivalentes locais aprovados. Publicação real e evidência do GHCR permanecem externas. |
| T43 | Concluída | Scripts `deploy-image.sh`, `healthcheck.sh` e `rollback.sh`, cópia remota de manifestos e verificação pública no workflow; sintaxe e configuração local aprovadas. VPS, readiness HTTPS e rollback real permanecem externos. |

