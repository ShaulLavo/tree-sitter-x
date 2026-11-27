#!/usr/bin/env bash
# Deploy helper script
set -euo pipefail

export APP_ENV="production"
readonly MAX_RETRIES=3
count=0

log_info() {
  local message="$1"
  printf '[info] %s (%d)\n' "$message" "$count"
}

if [[ -n "${APP_ENV:-}" && "$MAX_RETRIES" -gt 0 ]]; then
  for target in web api worker; do
    log_info "Deploying $target"
    curl -fsSL --retry "$MAX_RETRIES" "https://example.com/$target" | jq '.status' > /dev/null 2>&1
  done
elif [ -f ./fallback.sh ]; then
  source ./fallback.sh
else
  echo 'No deployment target configured' >&2
  exit 1
fi

case "$APP_ENV" in
  production|staging)
    echo "Done: $(date -u +%Y-%m-%d)"
    ;;
  *)
    exit 2
    ;;
esac
