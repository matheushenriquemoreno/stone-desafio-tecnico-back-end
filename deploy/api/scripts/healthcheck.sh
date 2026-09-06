#!/usr/bin/env bash
set -Eeuo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
app_directory="${APP_DIRECTORY:-$(cd -- "$script_directory/.." && pwd)}"
compose_file="${COMPOSE_FILE:-$app_directory/compose.yaml}"
image_env_file="${IMAGE_ENV_FILE:-$app_directory/.image.env}"
attempts="${HEALTH_ATTEMPTS:-30}"
delay_seconds="${HEALTH_DELAY_SECONDS:-2}"

compose_args=(--env-file "$image_env_file" -f "$compose_file")

for ((attempt = 1; attempt <= attempts; attempt += 1)); do
  container_id="$(docker compose "${compose_args[@]}" ps -q backend)"

  if [[ -n "$container_id" ]]; then
    health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id")"

    if [[ "$health_status" == "healthy" ]]; then
      exit 0
    fi

    if [[ "$health_status" == "unhealthy" || "$health_status" == "missing" ]]; then
      printf 'O container backend não ficou saudável: %s.\n' "$health_status" >&2
      exit 1
    fi
  fi

  sleep "$delay_seconds"
done

printf 'Timeout aguardando a saúde do container backend.\n' >&2
exit 1
