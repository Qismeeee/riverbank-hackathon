#!/usr/bin/env bash
set -Eeuo pipefail

image=${1:?Usage: deploy.sh IMAGE HEALTH_URL [GHCR_USER]}
health_url=${2:?Missing HEALTH_URL}
registry_user=${3:-}
project=${COMPOSE_PROJECT_NAME:-riverbank-hackathon}
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
root=$(dirname -- "$(dirname -- "$release")")

[[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+:[a-f0-9]{40}$ ]] || {
    echo 'Expected a GHCR image tagged with the full commit SHA' >&2
    exit 1
}
[[ "$release" == "$root/releases/"* && -f "$root/.env" ]] || {
    echo 'Expected releases/<commit>/deploy.sh and a preconfigured .env' >&2
    exit 1
}
[[ "$health_url" == https://* || "$health_url" == http://127.0.0.1:* ]] || {
    echo 'Health URL must use HTTPS (HTTP is allowed only on local test ports)' >&2
    exit 1
}
if [[ "$health_url" == https://* ]]; then
    domain=${health_url#https://}
    domain=${domain%/health}
    grep -Fxq "SITE_ADDRESS=$domain" "$root/.env" || {
        echo 'Health URL does not match SITE_ADDRESS in the server .env' >&2
        exit 1
    }
fi

exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
previous=$(readlink -f "$root/current" 2>/dev/null || true)
if [[ -L "$root/current" || -e "$root/current" ]]; then
    [[ "$previous" == "$root/releases/"* && -f "$previous/image" ]] || {
        echo 'Invalid current release; refusing to change the running stack' >&2
        exit 1
    }
else
    previous=''
fi
started=0
docker_config=''

compose() {
    local directory=$1 selected_image=$2
    shift 2
    local files=(-f "$directory/compose.yaml")
    if [[ -f "$directory/compose.aws.yaml" ]]; then
        files+=(-f "$directory/compose.aws.yaml")
    fi
    API_IMAGE="$selected_image" docker compose \
        --project-name "$project" --env-file "$root/.env" \
        "${files[@]}" "$@"
}

check_health() {
    local attempt
    for ((attempt = 1; attempt <= 12; attempt++)); do
        if curl --fail --silent --show-error --max-time 5 "$health_url" \
            && curl --fail --silent --show-error --max-time 20 "${health_url%/health}/ready"; then
            printf '\n'
            return 0
        fi
        sleep 2
    done
    return 1
}

rollback() {
    local status=${1:-$?}
    trap - ERR INT TERM HUP
    if (( started )); then
        if [[ -n "$previous" ]]; then
            echo 'Deployment failed; restoring the previous image and Compose/Caddy configuration' >&2
            if compose "$previous" "$(cat "$previous/image")" up -d --wait --wait-timeout 90 \
                && check_health; then
                echo 'Rollback passed' >&2
            else
                echo 'ROLLBACK FAILED: operator intervention required' >&2
            fi
        else
            echo 'First deployment failed; stopping the failed stack (volumes retained)' >&2
            compose "$release" "$image" down || true
        fi
    fi
    exit "$status"
}

cleanup() {
    if [[ -n "$docker_config" ]]; then
        # Only files created by docker login inside this fresh temporary directory.
        rm -f -- "$docker_config/config.json"
        rmdir -- "$docker_config" || true
    fi
}
trap cleanup EXIT
trap rollback ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM
trap 'rollback 129' HUP

if [[ -n "$registry_user" ]]; then
    docker_config=$(mktemp -d)
    export DOCKER_CONFIG="$docker_config"
    docker login ghcr.io --username "$registry_user" --password-stdin
fi
compose "$release" "$image" config --quiet
if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker pull "$image"
fi
[[ "$(docker image inspect --format '{{.Architecture}}' "$image")" == arm64 ]]
printf '%s\n' "$image" > "$release/image"
started=1
compose "$release" "$image" up -d --wait --wait-timeout 90
container=$(compose "$release" "$image" ps -q api)
[[ "$(docker inspect --format '{{.Config.Image}}' "$container")" == "$image" ]]
check_health
if [[ -n "$previous" && "$previous" != "$release" ]]; then
    ln -sfn -- "$previous" "$root/previous"
fi
ln -sfn -- "$release" "$root/current"
echo "Deployed $image"
