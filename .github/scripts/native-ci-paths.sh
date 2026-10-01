#!/usr/bin/env bash
set -euo pipefail

# Unknown paths run CI so new build inputs cannot silently lose coverage.
native=false
while IFS= read -r -d '' path; do
  case "$path" in
    test/highlight-compat/*|.github/workflows/highlight-compat.yml)
      ;;
    docs/src/assets/js/playground.js|docs/*.toml)
      native=true
      ;;
    docs/*|README.md|CONTRIBUTING.md|CHANGELOG.md|LICENSE|FUNDING.json|.github/FUNDING.yml|.github/ISSUE_TEMPLATE/*|.github/pull_request_template.md)
      ;;
    *)
      native=true
      ;;
  esac
  # Consume the entire diff even after a match to avoid SIGPIPE in the producer.
done
printf '%s\n' "$native"
