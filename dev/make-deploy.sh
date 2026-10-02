#!/bin/sh
# Copies exactly the files that belong on Aptitude into deploy/, ready to drag into FileZilla.
cd "$(dirname "$0")/.." || exit 1

rm -rf deploy
mkdir -p deploy/assets deploy/includes

(cd karavan-login && npx vite build --outDir ../deploy --emptyOutDir false) || exit 1
cp .htaccess deploy/
cp admin_register.php moderator_requests.php moderator_approve.php proof_file.php logout.php login.php register.php deploy/
cp get_approved_locations.php add_approved_location.php remove_approved_location.php deploy/
cp includes/*.php deploy/includes/
[ -f config.local.php ] && cp config.local.php deploy/
# Aptitude ignores .htaccess, so a blank index is what stops Apache listing uploaded documents.
mkdir -p deploy/karavan_uploads && : > deploy/karavan_uploads/index.html

echo "deploy/ is ready:"
find deploy -type f | sort
