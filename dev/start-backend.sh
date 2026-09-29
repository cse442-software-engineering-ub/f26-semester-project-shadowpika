#!/bin/sh
# Runs the PHP backend locally against dev/local.sqlite (no MySQL needed).
# Pair it with `npm run dev:backend` in karavan-login, then open http://localhost:5173
cd "$(dirname "$0")/.." || exit 1

if [ ! -f dev/local.sqlite ]; then
    php dev/setup_local_db.php || exit 1
fi

mkdir -p dev/sessions
echo "PHP backend on http://localhost:8000 (Ctrl+C to stop)"
KARAVAN_DB_DSN="sqlite:$(pwd)/dev/local.sqlite" \
KARAVAN_UPLOAD_DIR="$(pwd)/dev/uploads" \
exec php \
    -d session.save_path="$(pwd)/dev/sessions" \
    -d upload_max_filesize=11M \
    -d post_max_size=12M \
    -S localhost:8000 -t .
