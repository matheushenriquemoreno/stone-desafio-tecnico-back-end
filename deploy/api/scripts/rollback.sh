#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
app_directory="${APP_DIRECTORY:-$(cd -- "$script_directory/.." && pwd)}"
compose_file="${COMPOSE_FILE:-$app_directory/compose.yaml}"
image_env_file="${IMAGE_ENV_FILE:-$app_directory/.image.env}"

if [[ ! -f "$image_env_file" ]]; then
  printf 'Estado de imagem ausente: %s\n' "$image_env_file" >&2
  exit 2
fi

current_image="$(sed -n 's/^API_IMAGE=//p' "$image_env_file" | head -n 1)"
previous_image="$(sed -n 's/^PREVIOUS_API_IMAGE=//p' "$image_env_file" | head -n 1)"
previous_tag="${previous_image##*:}"

if [[ -z "$previous_image" || "$previous_tag" == "$previous_image" || ! "$previous_tag" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Não existe uma imagem anterior válida para rollback.\n' >&2
  exit 2
fi

temporary_image_env="$(mktemp "$app_directory/.image.env.XXXXXX")"
trap 'rm -f "$temporary_image_env"' EXIT
printf 'API_IMAGE=%s\nPREVIOUS_API_IMAGE=%s\n' "$previous_image" "$current_image" > "$temporary_image_env"
chmod 600 "$temporary_image_env"
mv -- "$temporary_image_env" "$image_env_file"
trap - EXIT

compose_args=(--env-file "$image_env_file" -f "$compose_file")
docker compose "${compose_args[@]}" config --quiet
docker compose "${compose_args[@]}" pull backend
docker compose "${compose_args[@]}" up -d --no-deps backend

"$script_directory/healthcheck.sh"
