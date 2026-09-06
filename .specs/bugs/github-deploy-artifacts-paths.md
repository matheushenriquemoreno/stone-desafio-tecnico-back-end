# Bug — Workflow referencia caminhos inexistentes dos artefatos de deploy

| Status       | Em validação |
|--------------|-------------|
| Created      | 2026-09-06  |
| Last Updated | 2026-09-06  |

## Comportamento esperado e observado

**Esperado:** o job `deploy` deve copiar o Compose, o NGINX e os scripts do
checkout para `/opt/stone-app` na VPS.

**Observado:** a etapa `Copy immutable deployment artifacts` falha antes da
transferência porque o `scp` não encontra o Compose local.

## Contexto e evidências

- **Ambiente:** GitHub Actions, job `deploy`, execução do commit
  `803ca3d662ba5b0c71e3231f0c86ecd41dc873f5`.
- **Evidência externa:**

  ```text
  scp: stat local "***/compose.production.yaml": No such file or directory
  Error: Process completed with exit code 255.
  ```

- **Evidência local:** a partir da raiz do repositório:

  ```text
  deploy/compose.production.yaml      = inexistente
  deploy/api/compose.production.yaml  = existente
  deploy/nginx/nginx.conf              = inexistente
  deploy/api/nginx/nginx.conf          = existente
  deploy/scripts                       = inexistente
  deploy/api/scripts                   = existente
  ```

## Reprodução

1. Executar o workflow em um push para `main` com os secrets de deploy válidos.
2. Chegar à etapa `Copy immutable deployment artifacts`.
3. Executar `scp deploy/compose.production.yaml ...` a partir da raiz do
   checkout.
4. Observar a falha `No such file or directory`.

**Confirmação:** a reprodução apresenta exatamente o sintoma relatado — sim.

## Hipóteses testadas e resultados

| # | Hipótese | Teste (uma variável por vez) | Resultado |
|---|----------|------------------------------|-----------|
| H1 | A autenticação SSH ou os secrets estão incorretos | Verificar que o job passou da validação e iniciou `scp` com os inputs mascarados | Refutada como causa desta falha |
| H2 | O caminho local dos artefatos não corresponde ao checkout | Testar a existência dos caminhos usados e dos caminhos sob `deploy/api` | Confirmada |
| H3 | A VPS não possui a estrutura remota esperada | A falha ocorre no `stat local` antes de qualquer cópia | Refutada como causa desta falha |

## Causa raiz confirmada

O workflow é executado na raiz do repositório, enquanto os artefatos de deploy
estão em `deploy/api`. Os quatro comandos `scp` usam `deploy/...` sem o
segmento `api`, portanto todos apontam para caminhos locais inexistentes.

## Proposta de correção

Alterar somente os quatro caminhos locais dos comandos `scp` em
`.github/workflows/api-delivery.yml`:

- `deploy/compose.production.yaml` → `deploy/api/compose.production.yaml`;
- `deploy/nginx/nginx.conf` → `deploy/api/nginx/nginx.conf`;
- `deploy/nginx/conf.d` → `deploy/api/nginx/conf.d`;
- `deploy/scripts/*.sh` → `deploy/api/scripts/*.sh`.

Os destinos remotos e a ordem do deploy permanecem inalterados.

## Teste de regressão

Validar a existência dos quatro caminhos corrigidos a partir da raiz do
checkout e executar a validação estática do workflow. Na próxima execução
autorizada, a etapa `Copy immutable deployment artifacts` deve concluir sem o
erro `stat local` e avançar para `Deploy immutable image`.

## Validações realizadas

- Teste de regressão antes da correção: falha pelo motivo certo; os caminhos
  antigos não existem.
- Correção aplicada: ajustados apenas os quatro caminhos `scp` do workflow.
- Teste de regressão depois: validação local dos seis caminhos corrigidos passou;
  a execução externa do GitHub Actions após o merge está pendente.
- Reprodução original: ainda não reexecutada após a correção.
- Testes relevantes: `git diff --check` passou; `actionlint` não está instalado
  no ambiente local; validação externa do workflow pendente.

## Próxima etapa

Após o merge na `main`, executar o workflow e confirmar que `Copy immutable
deployment artifacts` conclui, que `Deploy immutable image` inicia e que o
readiness público passa. Somente então o status deve ser alterado para
`Resolvido`.

## Riscos e prevenções futuras

- **Risco:** mover novamente os artefatos sem atualizar o workflow.
- **Prevenção:** manter os caminhos do workflow alinhados à estrutura real sob
  `deploy/api` e validar sua existência na CI antes do `scp`.
