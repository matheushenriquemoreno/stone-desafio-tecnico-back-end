# Guia Completo: Provisionando Infraestrutura AWS com Terraform

> Documento criado a partir de uma sessão prática de provisionamento da
> infraestrutura do projeto Stone API. Use como material de estudo para
> entender cada etapa do fluxo.

---

## Índice

1. [Visão geral do que foi provisionado](#1-visão-geral-do-que-foi-provisionado)
2. [Conceitos fundamentais](#2-conceitos-fundamentais)
3. [Pré-requisitos — o que precisamos instalar](#3-pré-requisitos)
4. [Etapa 1 — Conta AWS e credenciais](#4-etapa-1--conta-aws-e-credenciais)
5. [Etapa 2 — Configurar AWS CLI localmente](#5-etapa-2--configurar-aws-cli-localmente)
6. [Etapa 3 — Backend remoto (S3 + DynamoDB)](#6-etapa-3--backend-remoto-s3--dynamodb)
7. [Etapa 4 — Arquivos de configuração do Terraform](#7-etapa-4--arquivos-de-configuração-do-terraform)
8. [Etapa 5 — Executar o Terraform](#8-etapa-5--executar-o-terraform)
9. [Etapa 6 — Gerar Access Key para runtime](#9-etapa-6--gerar-access-key-para-runtime)
10. [Segurança — o que nunca fazer](#10-segurança--o-que-nunca-fazer)
11. [Troubleshooting — problemas comuns](#11-troubleshooting--problemas-comuns)
12. [Comandos de referência rápida](#12-comandos-de-referência-rápida)

---

## 1. Visão geral do que foi provisionado

```
┌─────────────────────────────────────────────────────┐
│                    AWS (us-east-1)                   │
│                                                     │
│  ┌──────────────────┐   ┌──────────────────┐       │
│  │  stone_users      │   │  stone_products   │       │
│  │  DynamoDB Table   │   │  DynamoDB Table   │       │
│  │  hash key: email  │   │  hash key: id     │       │
│  │  PAY_PER_REQUEST  │   │  PAY_PER_REQUEST  │       │
│  └──────────────────┘   └──────────────────┘       │
│           ▲                        ▲                │
│           │    Política IAM        │                │
│           │  (DescribeTable,       │                │
│           │   GetItem, Scan,       │                │
│           │   PutItem, UpdateItem, │                │
│           │   DeleteItem)          │                │
│           └────────┬───────────────┘                │
│                    │                                │
│         ┌──────────┴──────────┐                     │
│         │  stone-api-runtime   │                     │
│         │  IAM User (/stone/) │                     │
│         └─────────────────────┘                     │
│                                                     │
│  ┌──────────────────────┐  ┌───────────────────┐   │
│  │ terraform-lock        │  │ terraform-state    │   │
│  │ DynamoDB (lock)       │  │ S3 Bucket          │   │
│  └──────────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Recursos criados pelo Terraform (4):**

| Recurso | Nome | Finalidade |
|---------|------|------------|
| Tabela DynamoDB | `stone_users` | Armazenar usuários da API |
| Tabela DynamoDB | `stone_products` | Armazenar produtos da API |
| Usuário IAM | `stone-api-runtime` | Identidade que a API usa em produção |
| Política IAM | inline no user | Permissões mínimas nas duas tabelas |

**Recursos criados manualmente (pré-requisito):**

| Recurso | Nome | Finalidade |
|---------|------|------------|
| Bucket S3 | `stone-terraform-state-<AWS_ACCOUNT_ID>` | Armazenar o state do Terraform remotamente |
| Tabela DynamoDB | `terraform-lock` | Evitar que dois `terraform apply` rodem ao mesmo tempo |

---

## 2. Conceitos fundamentais

### 2.1 O que é Terraform?

Terraform é uma ferramenta de **Infrastructure as Code (IaC)**. Em vez de criar
recursos na AWS clicando no console, você descreve o que quer em arquivos `.tf`
e o Terraform cria, atualiza ou destrói os recursos automaticamente.

**Fluxo mental:**
```
Você escreve .tf  →  terraform plan  →  terraform apply  →  Recursos na AWS
     (código)         (pré-visualiza)     (executa)
```

### 2.2 State — por que o Terraform lembra do que criou?

O Terraform mantém um arquivo chamado `terraform.tfstate` que mapeia o que
está no código para o que existe na AWS. Sem ele, o Terraform não saberia se
precisa criar, atualizar ou destruir um recurso.

**State local vs. remoto:**
- **Local:** fica no seu computador (perigoso — se perder, perde o controle)
- **Remoto:** fica num bucket S3 com lock via DynamoDB (seguro para equipes)

### 2.3 Lock — por que precisamos do DynamoDB?

Quando duas pessoas (ou CI/CD) rodam `terraform apply` ao mesmo tempo, o
state pode ficar corrompido. O DynamoDB tabela de lock garante que só um
`apply` execute por vez — é um semáforo.

### 2.4 Backend S3

No `versions.tf` temos:
```hcl
backend "s3" {}
```

Os detalhes ficam no `backend.hcl` (que não vai pro Git por conter nomes de
recursos). O `terraform init` lê esse arquivo e configura a conexão com o
bucket.

### 2.5 Providers

Provider é o plugin que o Terraform usa para conversar com um serviço. No
nosso caso, o `hashicorp/aws` versão 5.x. O `versions.tf` declara isso.

### 2.6 Resources vs. Data Sources

- **`resource`**: cria algo novo na AWS (ex: tabela, usuário IAM)
- **`data`**: lê algo que já existe (ex: `aws_iam_policy_document` gera JSON
  de política sem criar nada diretamente)

### 2.7 Lifecycle `prevent_destroy`

```hcl
lifecycle {
  prevent_destroy = true
}
```

Impede que um `terraform destroy` ou uma mudança de config destrua a tabela.
É intencional: rollback de aplicação troca a imagem Docker, nunca apaga dados.

---

## 3. Pré-requisitos

### 3.1 Terraform

```powershell
# Instalar via winget
winget install Hashicorp.Terraform

# Verificar
terraform version
```

**O que aprendemos:** O winget instala em um diretório que nem sempre está no
PATH automaticamente. Se `terraform` não for reconhecido, o executável fica em:
```
C:\Users\<user>\AppData\Local\Microsoft\WinGet\Packages\
  Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe\terraform.exe
```

### 3.2 AWS CLI

```powershell
# Instalar via winget
winget install Amazon.AWSCLI

# Verificar
aws --version
```

**O que aprendemos:** Mesmo problema de PATH. O AWS CLI v2 fica em:
```
C:\Program Files\Amazon\AWSCLIV2\aws.exe
```

**Solução para o PATH do terminal atual (temporário):**
```powershell
$env:PATH += ";C:\Program Files\Amazon\AWSCLIV2"
$env:PATH += ";C:\Users\<user>\AppData\Local\Microsoft\WinGet\Packages\..."
```

**Solução permanente:** Reiniciar o terminal após instalar, ou adicionar ao
PATH do sistema em: Configurações → Sistema → Sobre → Configurações avançadas
→ Variáveis de ambiente.

---

## 4. Etapa 1 — Conta AWS e credenciais

### 4.1 Criar conta AWS

1. Acesse https://aws.amazon.com/pt-br/
2. Clique em **"Criar uma conta AWS"**
3. Preencha e-mail, senha, dados de pagamento (free tier cobre DynamoDB e IAM)
4. Confirme o e-mail

### 4.2 Criar um usuário IAM administrativo

> **Regra de ouro:** nunca use a conta root para programar. Crie um usuário
> IAM com permissões específicas.

1. Console AWS → busca por **IAM**
2. Menu lateral → **Usuários** → **Criar usuário**
3. Nome: `admin-terraform`
4. Marque **"Fornece acesso ao Console"** (opcional, mas útil)
5. Escolha **"Senha personalizada"**

### 4.3 Anexar permissões

1. Na tela de permissões: **Anexar políticas diretamente**
2. Busque por `AdministratorAccess`
3. Marque e prossiga

> ⚠️ `AdministratorAccess` é amplo. Em produção real, crie uma política
> customizada com apenas as permissões necessárias. Para este projeto de
> estudo, é aceitável.

### 4.4 Gerar Access Key

1. IAM → Usuários → `admin-terraform`
2. Aba **Credenciais de segurança**
3. **Chaves de acesso** → **Criar chave de acesso**
4. Caso de uso: **CLI**
5. **Copie e salve** os dois valores:
   - `AWS Access Key ID`
   - `AWS Secret Access Key`

> ⚠️ A **Secret Access Key só é exibida uma vez**. Se perder, precisa gerar
> uma nova.

---

## 5. Etapa 2 — Configurar AWS CLI localmente

```powershell
aws configure
```

Responda:

```
AWS Access Key ID [None]: AKIA...          # sua access key
AWS Secret Access Key [None]: wJalr...     # sua secret key
Default region name [None]: us-east-1     # região N. Virginia
Default output format [None]: json        # formato de saída
```

### Validar

```powershell
aws sts get-caller-identity
```

Resposta esperada:
```json
{
    "UserId": "AIDA...",
    "Account": "<AWS_ACCOUNT_ID>",
    "Arn": "arn:aws:iam::<AWS_ACCOUNT_ID>:user/admin-terraform"
}
```

**O que `sts get-caller-identity` faz?**
Pergunta à AWS: "quem sou eu?". Retorna o ARN (identificador único) do
usuário/role que está autenticado. É o teste mais rápido para saber se as
credenciais estão funcionando.

---

## 6. Etapa 3 — Backend remoto (S3 + DynamoDB)

O Terraform precisa de um lugar para guardar o state. Criamos isso
**antes** do `terraform init`.

### 6.1 Criar o bucket S3

```powershell
aws s3api create-bucket \
  --bucket stone-terraform-state-<AWS_ACCOUNT_ID> \
  --region us-east-1
```

**Por que o nome tem o número da conta?**
Nomes de bucket S3 são **globalmente únicos** em toda a AWS. Todos os
usuários de todas as contas compartilham o mesmo namespace. Adicionar o
ID da conta garante unicidade.

**Resposta:**
```json
{
    "Location": "/stone-terraform-state-<AWS_ACCOUNT_ID>",
    "BucketArn": "arn:aws:s3:::stone-terraform-state-<AWS_ACCOUNT_ID>"
}
```

### 6.2 Criar a tabela DynamoDB de lock

```powershell
aws dynamodb create-table \
  --table-name terraform-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

**Breakdown do comando:**
- `--table-name terraform-lock` — nome da tabela
- `--attribute-definitions AttributeName=LockID,AttributeType=S` — define
  que o atributo `LockID` é do tipo String (S)
- `--key-schema AttributeName=LockID,KeyType=HASH` — `LockID` é a chave
  primária (hash/partition key)
- `--billing-mode PAY_PER_REQUEST` — paga por requisição, não provisiona
  capacidade fixa (ideal para lock, que é esporádico)

---

## 7. Etapa 4 — Arquivos de configuração do Terraform

### 7.1 `backend.hcl`

```hcl
bucket         = "stone-terraform-state-<AWS_ACCOUNT_ID>"
key            = "stone-api/production/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "terraform-lock"
encrypt        = true
```

**O que cada campo faz:**
- `bucket` — nome do bucket S3 onde o state será salvo
- `key` — caminho do arquivo dentro do bucket (como uma pasta)
- `region` — região do bucket
- `dynamodb_table` — tabela de lock
- `encrypt` — criptografa o state em repouso no S3

### 7.2 `terraform.tfvars`

```hcl
aws_region          = "us-east-1"
environment         = "production"
project_name        = "stone-api"
users_table_name    = "stone_users"
products_table_name = "stone_products"
runtime_user_name   = "stone-api-runtime"

tags = {
  Owner = "admin-terraform"
}
```

**O que é `.tfvars`?**
É o arquivo de valores para as variáveis declaradas em `variables.tf`. O
Terraform lê automaticamente `terraform.tfvars` se ele existir no diretório.

### 7.3 Por que `.gitignore`?

```
backend.hcl           # contém nomes de recursos AWS (não é segredo, mas é
!backend.hcl.example  # específico do ambiente)

*.tfvars              # pode conter valores sensíveis (tags, nomes)
!*.tfvars.example     # o exemplo vai pro Git como template
```

---

## 8. Etapa 5 — Executar o Terraform

### 8.1 `terraform init`

```powershell
terraform init -backend-config=backend.hcl
```

**O que faz:**
- Lê o `backend.hcl` e configura a conexão com o S3
- Baixa o provider `hashicorp/aws` (~5.0)
- Cria o diretório `.terraform/` com os plugins
- Gera/atualiza `.terraform.lock.hcl` (lockfile de versões)

**Output esperado:**
```
Successfully configured the backend "s3"!
Terraform has been successfully initialized!
```

### 8.2 `terraform validate`

```powershell
terraform validate
```

**O que faz:**
Verifica se os arquivos `.tf` são sintaticamente válidos e se as referências
entre recursos fazem sentido. Não acessa a AWS — é uma validação local.

### 8.3 `terraform plan`

```powershell
terraform plan -var-file=terraform.tfvars -out=tfplan
```

**O que faz:**
- Lê o state atual (do S3) e compara com o código `.tf`
- Mostra o que será criado, alterado ou destruído
- Salva o plano em `tfplan` para aplicação idêntica

**Por que `-out=tfplan`?**
Garante que o `apply` execute **exatamente** o que foi planejado. Sem isso,
se algo mudar entre o `plan` e o `apply` (outro pessoa criou um recurso, por
exemplo), o resultado pode ser diferente.

### 8.4 `terraform apply`

```powershell
terraform apply tfplan
```

**O que faz:**
Executa as ações do plano salvo. Cria os recursos na AWS.

**Output esperado:**
```
aws_iam_user.runtime: Creating...
aws_dynamodb_table.users: Creating...
aws_dynamodb_table.products: Creating...
aws_iam_user.runtime: Creation complete after 0s
aws_dynamodb_table.users: Creation complete after 8s
aws_dynamodb_table.products: Creation complete after 8s
aws_iam_user_policy.runtime: Creating...
aws_iam_user_policy.runtime: Creation complete after 1s

Apply complete! Resources: 4 added, 0 changed, 0 destroyed.
```

### 8.5 `terraform output`

```powershell
terraform output
```

Mostra os valores de saída definidos em `outputs.tf` — os ARNs e nomes dos
recursos criados.

---

## 9. Etapa 6 — Gerar Access Key para runtime

O Terraform **deliberadamente** não cria access keys. Isso é uma decisão de
segurança: a key seria salva no state em texto claro.

### Via CLI (com o admin-terraform)

```powershell
aws iam create-access-key --user-name stone-api-runtime
```

Resposta:
```json
{
    "AccessKey": {
        "UserName": "stone-api-runtime",
        "AccessKeyId": "AKIA...",
        "SecretAccessKey": "...",
        "Status": "Active"
    }
}
```

### Usar no `.env` da aplicação

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
USERS_TABLE_NAME=stone_users
PRODUCTS_TABLE_NAME=stone_products
```

---

## 10. Segurança — o que nunca fazer

| ❌ Nunca | ✅ Faça assim |
|----------|---------------|
| Commitar `backend.hcl` no Git | Manter no `.gitignore` e versionar só o `.example` |
| Commitar `terraform.tfvars` no Git | Manter no `.gitignore` e versionar só o `.example` |
| Usar o `admin-terraform` na API | Usar o `stone-api-runtime` com permissões mínimas |
| Gravar access key na imagem Docker | Passar via variável de ambiente no deploy |
| Salvar secret key no código-fonte | Usar `.env` no servidor, fora do Git |
| Usar `*` em recursos da política IAM | Listar ARNs específicos das tabelas |
| Rodar `terraform destroy` em produção | As tabelas têm `prevent_destroy` — é intencional |

---

## 11. Troubleshooting — problemas comuns

### "`terraform` não é reconhecido como comando"

O Terraform foi instalado mas o PATH não atualizou. Soluções:
1. **Reiniciar o terminal** (fecha e abre de novo)
2. Adicionar manualmente ao PATH da sessão:
   ```powershell
   $env:PATH += ";C:\Users\<user>\AppData\Local\Microsoft\WinGet\Packages\Hashicorp.Terraform_..."
   ```

### "`aws` não é reconhecido como comando"

Mesmo problema. O AWS CLI v2 fica em `C:\Program Files\Amazon\AWSCLIV2\`.

### "Error: Too many command line arguments"

O `terraform` interpretou mal os argumentos. Geralmente acontece quando o
`cd` não funcionou antes do comando. Solução: use `Set-Location` como
comando separado no PowerShell:
```powershell
Set-Location "D:\Projects\StoneDesafio\...\deploy\terraform"
terraform init -backend-config=backend.hcl
```

### "No tables listed in the console"

O Console AWS estava mostrando uma região diferente. As tabelas foram criadas
em `us-east-1`. Verifique o seletor de região no canto superior direito do
Console.

### "Deprecated Parameter: dynamodb_table"

A versão mais recente do provider AWS (5.x) avisa que `dynamodb_table` no
backend será substituído por `use_lockfile`. Ainda funciona, mas é bom
atualizar quando conveniente.

---

## 12. Comandos de referência rápida

### AWS CLI

```powershell
# Identidade atual
aws sts get-caller-identity

# Listar tabelas DynamoDB
aws dynamodb list-tables --region us-east-1

# Listar buckets S3
aws s3api list-buckets

# Criar access key para um user
aws iam create-access-key --user-name stone-api-runtime

# Verificar região configurada
aws configure get region
```

### Terraform

```powershell
# Inicializar (primeira vez ou após mudanças de backend)
terraform init -backend-config=backend.hcl

# Validar sintaxe
terraform validate

# Planejar mudanças
terraform plan -var-file=terraform.tfvars -out=tfplan

# Aplicar plano salvo
terraform apply tfplan

# Ver outputs
terraform output

# Listar recursos gerenciados
terraform state list

# Ver detalhes de um recurso no state
terraform state show aws_dynamodb_table.users

# Formatar código
terraform fmt -recursive

# Destruir tudo (CUIDADO!)
terraform destroy -var-file=terraform.tfvars
```

---

## Fluxo completo resumido

```
1. Instalar Terraform + AWS CLI
2. Criar conta AWS + IAM user admin + Access Key
3. aws configure (credenciais + região)
4. Criar S3 bucket + DynamoDB lock table (pré-requisito)
5. Criar backend.hcl e terraform.tfvars
6. terraform init -backend-config=backend.hcl
7. terraform validate
8. terraform plan -var-file=terraform.tfvars -out=tfplan
9. terraform apply tfplan
10. terraform output → usar valores no .env da aplicação
11. Criar Access Key do runtime user → usar no .env
```
