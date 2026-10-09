#!/bin/sh
# Builds the whole site from this checkout into deploy/, ready to drag into FileZilla.
# deploy/ mirrors the team's single deployment at the root of cse-442j, so it carries
# every feature's backend, not just the admin/community files.
cd "$(dirname "$0")/.." || exit 1

rm -rf deploy
mkdir -p deploy/assets deploy/includes

(cd karavan-login && npx vite build --outDir ../deploy --emptyOutDir false) || exit 1
cp .htaccess deploy/
for file in ./*.php; do
    [ "$file" = ./config.local.example.php ] || cp "$file" deploy/
done
cp includes/*.php deploy/includes/
cp -R api settings deploy/
mkdir -p deploy/listing/uploads
cp -R listing/api listing/lib deploy/listing/
cp listing/uploads/.htaccess deploy/listing/uploads/
[ -f config.local.php ] && cp config.local.php deploy/
# Aptitude ignores .htaccess, so a blank index is what stops Apache listing uploaded documents.
mkdir -p deploy/karavan_uploads && : > deploy/karavan_uploads/index.html
: > deploy/listing/uploads/index.html

echo "deploy/ is ready:"
find deploy -type f | sort
