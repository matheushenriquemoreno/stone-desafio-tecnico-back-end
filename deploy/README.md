# Artefatos de operação

O Compose local na raiz continua reservado ao DynamoDB Local. Os arquivos
deste diretório descrevem a topologia publicada:

```text
/opt/stone-app/
|-- compose.yaml
|-- .env                 # criado somente na VPS, nunca versionado
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
sudo chmod 600 /opt/stone-app/.env
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
  docker compose -f deploy/compose.production.yaml config
```
