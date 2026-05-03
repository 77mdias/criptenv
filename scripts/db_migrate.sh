#!/usr/bin/env sh
set -eu

echo "scripts/db_migrate.sh is a compatibility wrapper. Use 'make db-upgrade' directly."
exec make db-upgrade
