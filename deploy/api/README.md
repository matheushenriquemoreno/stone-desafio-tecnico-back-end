# Artefatos de operação

O Compose local na raiz continua reservado ao DynamoDB Local. Os arquivos
deste diretório descrevem a topologia publicada:

```text
/opt/stone-app/
|-- compose.yaml
|-- .env                 # criado somente na VPS, nunca versionado
|-- .runtime.env         # credenciais AWS, criado somente na VPS
|-- .image.env           # criado pelos scripts, contém somente a imagem
|-- nginx/
`-- scripts/
```

O serviço `backend` não publica portas no host. Somente o NGINX publica a
porta 80, recebe a conexão da Cloudflare e encaminha para a rede privada.

Antes de usar a configuração, revise a lista de faixas Cloudflare em
`nginx/conf.d/00-cloudflare-real-ip.conf` usando a fonte oficial indicada no
arquivo. O trecho Cloudflare → VPS permanece HTTP conforme a decisão aprovada;
TLS ponta a ponta é obrigatório antes de reutilizar esta topologia como
produção real.

## Preparação da VPS

```bash
sudo mkdir -p /opt/stone-app/nginx/conf.d /opt/stone-app/scripts
sudo cp deploy/compose.production.yaml /opt/stone-app/compose.yaml
sudo cp deploy/nginx/nginx.conf /opt/stone-app/nginx/nginx.conf
sudo cp deploy/nginx/conf.d/*.conf /opt/stone-app/nginx/conf.d/
sudo cp deploy/.env.production.example /opt/stone-app/.env
sudo cp deploy/.runtime.env.example /opt/stone-app/.runtime.env
sudo chmod 600 /opt/stone-app/.env /opt/stone-app/.runtime.env
```

Edite `/opt/stone-app/.env` e substitua todos os placeholders. O valor de
`TRUSTED_PROXY_IPS` é o IP fixo do NGINX na rede Compose; se a sub-rede for
alterada, atualize os dois arquivos de forma consistente.

O arquivo `.image.env` não deve conter segredos. Ele é gerenciado pelos
scripts de deploy e guarda a imagem atual e a anterior, identificadas pelo SHA
completo do commit.

Para validar o manifesto sem uma VPS, use o exemplo de ambiente e uma tag
fictícia de imagem:

```bash
API_IMAGE=ghcr.io/example/stone-api:0000000000000000000000000000000000000000 \
API_ENV_FILE=.env.production.example \
AWS_ENV_FILE=.runtime.env.example \
  docker compose -f deploy/compose.production.yaml config
```

## Configuração burocrática do GitHub

O workflow `.github/workflows/api-delivery.yml` executa os gates oficiais em
pull requests. Em push para `main`, publica `ghcr.io/<owner>/<repository>` com
a tag SHA completa e também atualiza `latest` apenas por conveniência. O deploy
usa sempre a tag SHA, nunca `latest`.

Crie um environment GitHub chamado `production` e, se desejar aprovação
manual, habilite os reviewers desse environment. Cadastre nele os secrets:

| Secret | Conteúdo |
|--------|----------|
| `DEPLOY_HOST` | IPv4 ou hostname da VPS |
| `DEPLOY_USER` | Usuário dedicado de deploy, sem login remoto de root |
| `DEPLOY_DIRECTORY` | Caminho absoluto, normalmente `/opt/stone-app` |
| `DEPLOY_SSH_PRIVATE_KEY` | Chave privada dedicada do deploy |
| `DEPLOY_KNOWN_HOSTS` | Saída previamente verificada de `ssh-keyscan` |
| `PUBLIC_HEALTH_URL` | URL HTTPS pública sem `/health`: `https://apiproducts.devmoreno.com.br` |

O workflow usa apenas o `GITHUB_TOKEN` nativo para publicar no GHCR. Na VPS,
configure previamente o login de leitura no GHCR para o usuário que executará
Docker; o token de leitura deve ficar no credential store da VPS e não em
`.env`, no workflow ou no repositório.

## Primeiro provisionamento da VPS

Depois de aplicar o Terraform e criar o usuário IAM de runtime:

1. Instale Docker Engine e o plugin Docker Compose.
2. Crie `/opt/stone-app`, copie os arquivos publicados pelo workflow e copie
   `deploy/.env.production.example` para `.env` e
   `deploy/.runtime.env.example` para `.runtime.env`.
3. Substitua todos os placeholders nos dois arquivos; as credenciais AWS
   ficam somente em `.runtime.env`.
4. Restrinja o firewall: porta 80 somente às faixas Cloudflare quando viável;
   SSH somente às origens administrativas; login por senha e root desabilitados.
5. Configure o DNS `A` da API com proxy Cloudflare habilitado e revise as
   faixas em `nginx/conf.d/00-cloudflare-real-ip.conf`.

O primeiro push autorizado para `main` copia os manifestos, publica a imagem,
inicia o `backend`, inicia o NGINX e valida o endpoint público. O arquivo
`.image.env` é criado pelo script e não contém segredos.

## Rollback manual

Se o workflow falhar depois da publicação, ele executa automaticamente:

```bash
cd /opt/stone-app
./scripts/rollback.sh
```

O script troca somente `API_IMAGE`, recria apenas o `backend` e espera o
healthcheck da imagem. O workflow então valida novamente a URL pública. Nenhum
comando do deploy ou rollback executa Terraform, remove tabelas ou altera
dados do DynamoDB.
