# Terraform da infraestrutura AWS

Este diretório provisiona somente os recursos persistentes e a identidade de
runtime da API:

- tabela `users`, com chave simples `email`;
- tabela `products`, com chave simples `id`;
- duas tabelas em `PAY_PER_REQUEST`, sem sort key ou GSI;
- usuário IAM exclusivo da API;
- política inline limitada a `DescribeTable`, `GetItem`, `Scan`, `PutItem`,
  `UpdateItem` e `DeleteItem` nas duas tabelas.

O usuário que executa o Terraform é a identidade administrativa de
provisionamento. Ele não deve ser usado pela API. O Terraform também não cria
access key: gere a credencial do usuário de runtime separadamente, copie-a
somente para o arquivo protegido da VPS e planeje a rotação operacional.

## Preparação única

1. Crie um bucket S3 privado para o estado e uma tabela DynamoDB para lock.
2. Copie `backend.hcl.example` para `backend.hcl` e substitua os placeholders.
3. Copie `terraform.tfvars.example` para `terraform.tfvars` e ajuste região,
   nomes e tags. `terraform.tfvars` não deve entrar no Git.
4. Configure localmente uma identidade administrativa com permissão para
   provisionar os recursos. Não use a credencial de runtime nesta etapa.

## Fluxo seguro

```bash
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive
terraform validate
terraform plan -var-file=terraform.tfvars -out=tfplan
terraform show -no-color tfplan
terraform apply tfplan
```

Antes de aplicar, confirme no plano que só aparecem duas tabelas, um usuário
IAM e a política inline. Não aceite ações administrativas na política da API,
recursos `*`, sort key ou GSI não previstos.

Depois do apply:

```bash
terraform output
```

Use os nomes retornados no `.env` da VPS. Crie a access key do usuário
`runtime_user_name` pelo procedimento controlado da conta AWS; não a grave em
`terraform.tfvars`, no estado em texto local, na imagem Docker ou no Git.

O `lifecycle.prevent_destroy` das tabelas é intencional: rollback de aplicação
troca somente a imagem e nunca remove dados.
