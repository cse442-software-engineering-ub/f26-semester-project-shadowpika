#!/bin/sh
# Runs session/account APIs locally against SQLite. Search/listing APIs still require MySQL.
# Build deploy first. Pair it with `npm run dev` in frontend.
cd "$(dirname "$0")/../.." || exit 1

if [ ! -f scripts/local-dev/runtime/local.sqlite ]; then
    php scripts/local-dev/setup_local_db.php || exit 1
fi

mkdir -p scripts/local-dev/runtime/sessions
echo "PHP backend on http://localhost:8000 (Ctrl+C to stop)"
KARAVAN_DB_DSN="sqlite:$(pwd)/scripts/local-dev/runtime/local.sqlite" \
KARAVAN_UPLOAD_DIR="$(pwd)/scripts/local-dev/runtime/uploads" \
exec php \
    -d session.save_path="$(pwd)/scripts/local-dev/runtime/sessions" \
    -d upload_max_filesize=2M \
    -d post_max_size=8M \
    -S localhost:8000 -t deploy
