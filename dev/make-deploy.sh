#!/bin/sh
# Copies exactly the files that belong on Aptitude into deploy/, ready to drag into FileZilla.
cd "$(dirname "$0")/.." || exit 1

rm -rf deploy
mkdir -p deploy/assets deploy/includes

cp index.html favicon.svg icons.svg .htaccess .user.ini deploy/
cp admin_register.php moderator_requests.php moderator_approve.php proof_file.php logout.php login.php register.php deploy/
cp includes/*.php deploy/includes/
cp assets/* deploy/assets/
[ -f config.local.php ] && cp config.local.php deploy/

echo "deploy/ is ready:"
find deploy -type f | sort
