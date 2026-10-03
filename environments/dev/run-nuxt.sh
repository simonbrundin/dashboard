#!/bin/sh
set -eu

ENV_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
NUXT_DIR="$ENV_DIR/../../src/nuxt"

set -a
. "$ENV_DIR/.env"
set +a

cd "$NUXT_DIR"
exec "$NUXT_DIR/node_modules/.bin/nuxt" dev "$@"
