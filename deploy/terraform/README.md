# Terraform da infraestrutura AWS

Este diretório provisiona os recursos persistentes e a identidade de runtime
da API:

- tabelas `users` e `products` em `PAY_PER_REQUEST`;
- usuário IAM exclusivo da API;
- política inline limitada às operações necessárias nas duas tabelas.

## Guia completo

Consulte o [`infra-terraform-guia.md`](./infra-terraform-guia.md) para o passo
a passo completo de instalação, configuração da AWS CLI, backend remoto,
execução do Terraform e criação da credencial de runtime.

## Segurança

- Mantenha `backend.hcl`, `terraform.tfvars`, `tfplan` e o state fora do Git.
- Não grave access keys na configuração Terraform, imagem Docker ou código.
- Gere a access key do usuário de runtime separadamente e armazene-a somente
  no arquivo protegido da VPS.
- Não aceite recursos `*`, permissões administrativas, sort keys ou GSIs não
  previstos.

O `lifecycle.prevent_destroy` das tabelas é intencional: rollback da aplicação
troca somente a imagem e nunca remove dados.
