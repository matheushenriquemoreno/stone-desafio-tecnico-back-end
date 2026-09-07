# Artefatos de operação

Este diretório contém a configuração de execução da API em uma VPS: Docker
Compose, NGINX, scripts de deploy e arquivos de exemplo de ambiente.

## Guia completo

Para o provisionamento passo a passo da VPS, consulte o
[`vps-setup-guide.md`](./vps-setup-guide.md). O guia cobre SSH, Docker, GHCR,
Cloudflare, GitHub Actions, hardening e firewall.

## Regras de segurança

- Nunca versione `.env`, `.runtime.env`, chaves SSH, PATs ou JWT secrets.
- Mantenha o token de leitura do GHCR no credential store da VPS.
- Revise as faixas oficiais da Cloudflare em
  `nginx/conf.d/00-cloudflare-real-ip.conf`.
- Restrinja o SSH às origens administrativas e desabilite login por senha e
  root.
- O trecho Cloudflare → VPS permanece HTTP conforme a decisão aprovada; TLS
  ponta a ponta é obrigatório antes de reutilizar esta topologia como produção
  real.
