#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
app_directory="${APP_DIRECTORY:-$(cd -- "$script_directory/.." && pwd)}"
compose_file="${COMPOSE_FILE:-$app_directory/compose.yaml}"
image_env_file="${IMAGE_ENV_FILE:-$app_directory/.image.env}"
image_ref="${1:?Uso: deploy-image.sh ghcr.io/owner/repository:<sha-completo>}"

image_tag="${image_ref##*:}"
if [[ "$image_tag" == "$image_ref" || ! "$image_tag" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'A imagem deve usar uma tag SHA completa de 40 caracteres hexadecimais.\n' >&2
  exit 2
fi

if [[ ! -f "$app_directory/.env" ]]; then
  printf 'Arquivo de ambiente ausente: %s/.env\n' "$app_directory" >&2
  exit 2
fi

if [[ ! -f "$app_directory/.runtime.env" ]]; then
  printf 'Credenciais de runtime ausentes: %s/.runtime.env\n' "$app_directory" >&2
  exit 2
fi

chmod 600 "$app_directory/.env"
chmod 600 "$app_directory/.runtime.env"

current_image=""
if [[ -f "$image_env_file" ]]; then
  current_image="$(sed -n 's/^API_IMAGE=//p' "$image_env_file" | head -n 1)"
fi

temporary_image_env="$(mktemp "$app_directory/.image.env.XXXXXX")"
trap 'rm -f "$temporary_image_env"' EXIT
printf 'API_IMAGE=%s\nPREVIOUS_API_IMAGE=%s\n' "$image_ref" "$current_image" > "$temporary_image_env"
chmod 600 "$temporary_image_env"
mv -- "$temporary_image_env" "$image_env_file"
trap - EXIT

compose_args=(--env-file "$image_env_file" -f "$compose_file")
docker compose "${compose_args[@]}" config --quiet
docker compose "${compose_args[@]}" pull backend
docker compose "${compose_args[@]}" up -d --no-deps backend

"$script_directory/healthcheck.sh"
