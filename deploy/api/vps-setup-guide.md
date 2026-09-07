# Guia de configuração da VPS — Oracle Cloud / Ubuntu 22.04

Este documento cobre o provisionamento manual de uma VPS Oracle Cloud com
Ubuntu 22.04 LTS, desde o acesso inicial até o primeiro deploy bem-sucedido.

> **Pré-requisitos:**
>
> - Conta Oracle Cloud comcompute instance criada (Ubuntu 22.04, ARM ou AMD64).
> - Chave SSH privada configurada no Create Instance (Oracle Cloud Console).
> - Conta GitHub com acesso ao repositório `stone-desafio-tecnico-back-end`.
> - Conta AWS com DynamoDB provisionado pelo Terraform e access key do usuário
>   `stone-api-runtime` gerada.
> - Conta Cloudflare com o domínio da API configurado (proxy habilitado).

---

## Sumário

1. [Acesso inicial](#1-acesso-inicial)
2. [Atualização do sistema e pacotes básicos](#2-atualização-do-sistema-e-pacotes-básicos)
3. [Criação do usuário deploy](#3-criação-do-usuário-deploy)
4. [Instalação do Docker Engine + Compose V2](#4-instalação-do-docker-engine--compose-v2)
5. [Login no GHCR (GitHub Container Registry)](#5-login-no-ghcr-github-container-registry)
6. [Estrutura de diretórios e arquivos de deploy](#6-estrutura-de-diretórios-e-arquivos-de-deploy)
7. [Configuração dos ambientes](#7-configuração-dos-ambientes)
8. [DNS na Cloudflare](#8-dns-na-cloudflare)
9. [Segredos no GitHub Actions](#9-segredos-no-github-actions)
10. [Validação e primeiro deploy](#10-validação-e-primeiro-deploy)
11. [Verificação pós-deploy](#11-verificação-pós-deploy)
12. [Referência rápida de comandos](#12-referência-rápida-de-comandos)
13. [Hardening opcional do SSH](#13-hardening-opcional-do-ssh)
14. [Firewall (UFW)](#14-firewall-ufw)

---

## 1. Acesso inicial

Após criar a instância no Oracle Cloud Console, conecte via SSH:

```bash
# Substitua <ORACLE_PUBLIC_IP> pelo IP público da instância
ssh -i ~/.ssh/sua-chave-privada ubuntu@<ORACLE_PUBLIC_IP>
```

O usuário padrão das imagens Oracle Cloud é `ubuntu` (não `root`).

> **Oracle Cloud — Linux Boot Volume:** Se a instância foi criada com a imagem
> Oracle Linux em vez de Ubuntu, o usuário padrão é `opc` e o gerenciador de
> pacotes é `dnf`. Este guia assume Ubuntu 22.04 com `apt`.

---

## 2. Atualização do sistema e pacotes básicos

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  jq \
  ufw
```

---

## 3. Criação do usuário deploy

O workflow GitHub Actions conecta via SSH com um usuário dedicado. Crie-o
antes de qualquer configuração de SSH:

```bash
# Criar usuário deploy
sudo useradd -m -s /bin/bash deploy

# Adicionar ao grupo docker (será usado depois da instalação)
# O grupo será efetivo somente após re-login
sudo usermod -aG docker deploy
```

### 3.1 Gerar par de chaves para o deploy

No **seu computador local** (não na VPS):

```bash
# Gerar chave dedicada — sem passphrase para uso em CI
ssh-keygen -t ed25519 -C "deploy@stone-api" -f ~/.ssh/stone-deploy -N ""

# Mostrar a chave pública — will be added to VPS
cat ~/.ssh/stone-deploy.pub
```

Na **VPS**, adicione a chave pública ao usuário `deploy`:

```bash
# Criar diretório .ssh
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh

# Adicionar chave pública (cole o conteúdo do cat anterior)
sudo tee /home/deploy/.ssh/authorized_keys > /dev/null <<'EOF'
ssh-ed25519 AAAA... deploy@stone-api
EOF

# Ajustar permissões
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

Teste a conexão em outro terminal, sem sudo:

```bash
ssh -i ~/.ssh/stone-deploy deploy@<ORACLE_PUBLIC_IP>
```

> **Importante:** O usuário `deploy` não deve ter `sudo` sem senha. Se
> precisar de operações administrativas, faça via `ubuntu` + `su -`.

---

## 4. Instalação do Docker Engine + Compose V2

```bash
# Adicionar chave GPG oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Adicionar repositório
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine + Compose V2
sudo apt-get update
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

# Adicionar deploy ao grupo docker (relogin para efeito)
sudo usermod -aG docker deploy
```

### 4.1 Verificar instalação

```bash
# Testar como deploy (faça logout e login novamente)
docker --version
docker compose version
```

Saída esperada:
```
Docker version 24.x.x, build xxxxxxx
Docker Compose version v2.x.x
```

### 4.2 Configurar Docker para iniciar automaticamente

```bash
sudo systemctl enable docker.service
sudo systemctl enable containerd.service
```

---

## 5. Login no GHCR (GitHub Container Registry)

O backend é publicado como imagem Docker no GHCR. A VPS precisa de
permissão de **leitura** para baixar a imagem.

### 5.1 Gerar Personal Access Token (PAT)

1. Acesse [github.com/settings/tokens](https://github.com/settings/tokens).
2. Clique em **Generate new token (classic)**.
3. Nome: `stone-api-ghcr-read`.
4. Permissão: `read:packages`.
5. Expiração: 90 dias (planeje rotação).
6. Gere e copie o token.

### 5.2 Login na VPS

Na VPS, como usuário `deploy`:

```bash
# Login interativo — o token é armazenado no credential store
echo "<SEU_GITHUB_PAT>" | docker login ghcr.io -u "<SEU_GITHUB_USERNAME>" --password-stdin
```

> O token fica salvo em `~/.docker/config.json`. Não exporte em variáveis de
> ambiente, não coloque em arquivos `.env` e não versione no Git.

---

## 6. Estrutura de diretórios e arquivos de deploy

### 6.1 Criar estrutura

```bash
sudo mkdir -p /opt/stone-app/nginx/conf.d /opt/stone-app/scripts
sudo chown -R deploy:deploy /opt/stone-app
```

### 6.2 Copiar arquivos do repositório

No **seu computador local**, com o repositório clonado:

```bash
# Definir variáveis
VPS_IP="<ORACLE_PUBLIC_IP>"
REMOTE="deploy@${VPS_IP}"
SSH_OPTS="-i ~/.ssh/stone-deploy -o IdentitiesOnly=yes"
TARGET="/opt/stone-app"

# Criar diretórios remotos
ssh ${SSH_OPTS} ${REMOTE} \
  "mkdir -p -- '${TARGET}/nginx/conf.d' '${TARGET}/scripts'"

# Copiar compose
scp ${SSH_OPTS} deploy/api/compose.production.yaml \
  "${REMOTE}:${TARGET}/compose.yaml"

# Copiar NGINX
scp ${SSH_OPTS} deploy/api/nginx/nginx.conf \
  "${REMOTE}:${TARGET}/nginx/nginx.conf"
scp -r ${SSH_OPTS} deploy/api/nginx/conf.d \
  "${REMOTE}:${TARGET}/nginx/"

# Copiar scripts
scp ${SSH_OPTS} deploy/api/scripts/*.sh \
  "${REMOTE}:${TARGET}/scripts/"

# Ajustar permissões
ssh ${SSH_OPTS} ${REMOTE} \
  "chmod 700 '${TARGET}/scripts' && chmod 700 '${TARGET}/scripts'/*.sh"
```

### 6.3 Estrutura resultante

```text
/opt/stone-app/
├── compose.yaml          # Copiado de deploy/api/compose.production.yaml
├── .env                  # Criado no passo 7
├── .runtime.env          # Criado no passo 7
├── .image.env            # Criado automaticamente pelo workflow
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       ├── 00-cloudflare-real-ip.conf
│       └── stone-api.conf
└── scripts/
    ├── deploy-image.sh
    ├── healthcheck.sh
    └── rollback.sh
```

---

## 7. Configuração dos ambientes

### 7.1 Arquivo `.env`

Na VPS, como `deploy`:

```bash
cd /opt/stone-app
cp /dev/null .env
```

Cole o conteúdo abaixo e substitua **todos** os placeholders:

```bash
NODE_ENV=production
PORT=3000
DYNAMODB_ENDPOINT=https://dynamodb.<SUA_REGIAO>.amazonaws.com
AWS_REGION=<SUA_REGIAO>
DYNAMODB_TABLE_PREFIX=
USERS_TABLE_NAME=stone_users
PRODUCTS_TABLE_NAME=stone_products
JWT_SECRET=<GERE-UM-SEGURO-MIN-32-CARACTERES>
JWT_ISSUER=stone-api
JWT_AUDIENCE=stone-web
JWT_ACCESS_TTL_SECONDS=900
ALLOWED_ORIGINS=https://<SEU_DOMINIO>
TRUSTED_PROXY_IPS=172.30.0.2
COOKIE_NAME=__Host-stone_access_token
COOKIE_SECURE=true
```

> **Gerar JWT_SECRET seguro:**
>
> ```bash
> openssl rand -base64 48
> ```

### 7.2 Arquivo `.runtime.env`

```bash
cd /opt/stone-app
cp /dev/null .runtime.env
```

Cole e substitua os placeholders:

```bash
AWS_ACCESS_KEY_ID=<ACCESS_KEY_DO_USUARIO_ stone-api-runtime>
AWS_SECRET_ACCESS_KEY=<SECRET_KEY_DO_USUARIO_ stone-api-runtime>
```

### 7.3 Ajustar permissões

```bash
chmod 600 /opt/stone-app/.env /opt/stone-app/.runtime.env
```

### 7.4 Validação do compose (opcional, mas recomendado)

```bash
cd /opt/stone-app
API_IMAGE=ghcr.io/<owner>/<repository>:0000000000000000000000000000000000000000 \
API_ENV_FILE=.env \
AWS_ENV_FILE=.runtime.env \
  docker compose --env-file .image.env -f compose.yaml config
```

Se não houver erros, o manifesto está válido.

## 8. DNS na Cloudflare

1. Acesse o painel Cloudflare.
2. Adicione um registro **A**:
   - **Nome:** `apiproducts` (ou o subdomínio desejado)
   - **IPv4:** `<ORACLE_PUBLIC_IP>`
   - **Proxy status:** **Proxied** (nuvem laranja habilitada)
3. Aguarce a propagação (geralmente < 5 minutos).
4. Verifique:
   ```bash
   # Do seu computador local
   dig +short apiproducts.seudominio.com.br
   ```

---

## 9. Segredos no GitHub Actions

Acesse **Settings → Environments → New environment** no repositório GitHub e
crie o environment `production`.

### 10.1 Segredos do environment `production`

| Secret | Valor |
|--------|-------|
| `DEPLOY_HOST` | `<ORACLE_PUBLIC_IP>` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_DIRECTORY` | `/opt/stone-app` |
| `DEPLOY_SSH_PRIVATE_KEY` | Conteúdo completo da chave privada `~/.ssh/stone-deploy` |
| `DEPLOY_KNOWN_HOSTS` | Saída de `ssh-keyscan` (ver abaixo) |
| `PUBLIC_HEALTH_URL` | `https://apiproducts.seudominio.com.br` (sem `/health`) |

### 10.2 Gerar `DEPLOY_KNOWN_HOSTS`

No seu computador local:

```bash
ssh-keyscan -H <ORACLE_PUBLIC_IP>
```

Copie **toda** a saída e cole como valor do secret `DEPLOY_KNOWN_HOSTS`.

### 10.3 Aprovação manual (opcional)

No environment `production`, habilite **Required reviewers** e adicione seu
nome de usuário GitHub. Assim, cada deploy precisará de aprovação manual
antes de seguir para a VPS.

---

## 10. Validação e primeiro deploy

### 11.1 Verificar GitHub secrets

Antes de fazer push, verifique que todos os secrets estão preenchidos:

```bash
# Usando GitHub CLI (opcional)
gh secret list -e production
```

### 11.2 Verificar GHCR accessibility

Na VPS, como `deploy`:

```bash
# Testar se consegue puxar a imagem (substitua pelo repositório real)
docker pull ghcr.io/<owner>/<repository>:latest
```

### 11.3 Fazer push para main

O workflow `api-delivery.yml` dispara automaticamente em push para `main`:

```bash
# No seu computador local
git push origin main
```

O workflow executa:

1. **Quality gates** — lint, typecheck, testes, build.
2. **Publish image** — publica no GHCR com tag SHA.
3. **Deploy** — copia artefatos, puxa imagem, recria backend, valida health.

### 11.4 Monitorar o workflow

Acesse **Actions** no repositório GitHub e acompanhe os 3 jobs.

Se o deploy falhar, o workflow executa rollback automaticamente.

---

## 11. Verificação pós-deploy

### 12.1 Status dos containers

```bash
# Na VPS, como deploy
cd /opt/stone-app
docker compose --env-file .image.env -f compose.yaml ps
```

Saída esperada:
```
NAME                  IMAGE                          STATUS
stone-api-backend-1   ghcr.io/...:<sha>              Up (healthy)
stone-api-nginx-1     nginx:1.27.5-alpine            Up
```

### 12.2 Health endpoint

```bash
# Localmente
curl -s https://apiproducts.seudominio.com.br/health | jq .

# Ou na VPS
curl -s http://localhost/health | jq .
```

### 12.3 Logs

```bash
cd /opt/stone-app

# Logs do backend
docker compose --env-file .image.env -f compose.yaml logs backend --tail=50

# Logs do NGINX
docker compose --env-file .image.env -f compose.yaml logs nginx --tail=50
```

### 12.4 Arquivo `.image.env`

Verifique que foi criado pelo workflow:

```bash
cat /opt/stone-app/.image.env
```

Saída esperada:
```
API_IMAGE=ghcr.io/<owner>/<repository>:<sha-completo-do-commit>
PREVIOUS_API_IMAGE=
```

---

## 12. Referência rápida de comandos

### Operações do dia a dia

| Comando | Descrição |
|---------|-----------|
| `cd /opt/stone-app && docker compose --env-file .image.env -f compose.yaml ps` | Status dos containers |
| `docker compose --env-file .image.env -f compose.yaml logs -f backend` | Logs em tempo real do backend |
| `docker compose --env-file .image.env -f compose.yaml logs -f nginx` | Logs em tempo real do NGINX |
| `docker compose --env-file .image.env -f compose.yaml restart backend` | Reiniciar backend |

### Rollback manual

```bash
cd /opt/stone-app
./scripts/rollback.sh
```

O script troca a imagem para a anterior (registrada em `.image.env`) e espera
o healthcheck ficar `healthy`.

### Deploy manual (fora do CI)

```bash
cd /opt/stone-app
./scripts/deploy-image.sh ghcr.io/<owner>/<repository>:<sha-completo>
```

### Atualizar faixas Cloudflare

```bash
# Baixar faixas atuais
curl -s https://www.cloudflare.com/ips-v4 | while read -r cidr; do
  echo "set_real_ip_from ${cidr};"
done

# Atualizar /opt/stone-app/nginx/conf.d/00-cloudflare-real-ip.conf
# e reiniciar NGINX:
cd /opt/stone-app
docker compose --env-file .image.env -f compose.yaml exec nginx nginx -s reload
```

### Diagnóstico

| Comando | Descrição |
|---------|-----------|
| `docker compose --env-file .image.env -f compose.yaml config` | Validar compose |
| `docker inspect <container_id> --format '{{json .State.Health}}'` | Ver healthcheck detalhado |
| `curl -v http://localhost/health` | Testar health via NGINX |
| `docker system df` | Uso de disco do Docker |
| `docker image prune -a` | Limpar imagens não utilizadas |

---

## Troubleshooting

### Container backend não fica healthy

```bash
# Verificar logs do backend
docker compose --env-file .image.env -f compose.yaml logs backend

# Verificar se DynamoDB está acessível
curl -s -X POST \
  -H "Content-Type: application/x-amz-json-1.0" \
  -H "X-Amz-Target: DynamoDB_20120810.ListTables" \
  -d '{}' \
  https://dynamodb.<regiao>.amazonaws.com

# Verificar variáveis de ambiente injetadas
docker compose --env-file .image.env -f compose.yaml exec backend env
```

### NGINX retorna 502 Bad Gateway

```bash
# Verificar se o backend está rodando
docker compose --env-file .image.env -f compose.yaml ps backend

# Verificar se o backend escuta na porta correta
docker compose --env-file .image.env -f compose.yaml exec backend \
  node -e "fetch('http://127.0.0.1:3000/health').then(r => console.log(r.status)).catch(e => console.error(e))"
```

### Deploy do GitHub Actions falha no SSH

```bash
# Verificar se o deploy consegue SSH
ssh -i ~/.ssh/stone-deploy deploy@<IP> "docker --version"

# Verificar known_hosts
ssh-keyscan -H <IP>

# Verificar permissões na VPS
ls -la /opt/stone-app/scripts/
# devem ser -rwx------ (700)
```

### Oracle Cloud bloqueia a porta 80

1. Acesse Oracle Cloud Console → **Networking** → **Virtual Cloud Networks**.
2. Clique na VCN → **Security Lists** → **Default Security List**.
3. Adicione **Ingress Rules**:
   - **Source CIDR:** `0.0.0.0/0` (ou faixas Cloudflare)
   - **Destination Port:** `80`
   - **Protocol:** `TCP`

---

## 13. Hardening opcional do SSH (após o primeiro deploy)

Esta etapa **não é necessária para o primeiro deploy** e deve ser executada
somente depois que a API estiver funcionando e o acesso por `deploy` tiver sido
validado em uma segunda sessão SSH.

Mantenha a sessão administrativa atual aberta, abra outra sessão e confirme o
login antes de aplicar qualquer alteração:

```bash
ssh -i ~/.ssh/stone-deploy deploy@<ORACLE_PUBLIC_IP>
```

Na VPS, como `ubuntu`:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
# Desabilitar login por senha sem alterar o PAM do Ubuntu
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no

# Desabilitar login remoto de root
PermitRootLogin no
PubkeyAuthentication yes

# Limitar tentativas e manter conexões ociosas sob controle
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Validar antes de recarregar
sudo sshd -t

# Recarregar preservando a sessão atual
sudo systemctl reload ssh
```

> **Importante:** não adicione `UsePAM no`, não bloqueie a conta `deploy` com
> `passwd -l` e não feche a sessão administrativa até confirmar um novo login.
> Se a validação ou o novo login falhar, restaure o backup pelo console da
> Oracle antes de continuar.

---

## 14. Firewall (UFW) — segurança pós-deploy

Execute esta etapa somente depois de validar a API pública e confirmar o acesso
SSH administrativo em uma segunda sessão. O UFW bloqueia conexões recebidas na
VPS, mantendo aberto apenas o SSH administrativo e o HTTP originado pela
Cloudflare.

Substitua `<SEU_IP_ADMIN>` pelo IP público usado para administrar a VPS antes
de ativar o firewall:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH somente para o IP administrativo
sudo ufw allow from <SEU_IP_ADMIN> to any port 22 proto tcp comment "SSH administrativo"

# HTTP somente para as faixas oficiais da Cloudflare
while read -r cidr; do
  sudo ufw allow from "$cidr" to any port 80 proto tcp comment "Cloudflare IPv4"
done < <(curl -fsSL https://www.cloudflare.com/ips-v4)

while read -r cidr; do
  sudo ufw allow from "$cidr" to any port 80 proto tcp comment "Cloudflare IPv6"
done < <(curl -fsSL https://www.cloudflare.com/ips-v6)

sudo ufw --force enable
sudo ufw status verbose
```

> **Atenção:** confirme novamente o IP administrativo antes de executar
> `ufw enable`. A Security List/NSG da Oracle também precisa permitir as portas
> `22` e `80`; o UFW não substitui as regras da rede Oracle.

---

> **Próximos passos (fora deste guia):**
>
> - Configurar TLS ponta a ponta (Cloudflare Full ou Full Strict).
> - Automatizar rotação do PAT do GHCR.
> - Configurar monitoramento e alertas.
> - Configurar backup do DynamoDB (AWS ou script periódico).
