#!/bin/bash
# Pull latest bfcpos project from VPS server into LocalPOS-new (excludes node_modules, uploads).
# Run from LocalPOS-new: bash scripts/pull-from-server-bfcpos.sh
# Override: SERVER=admin93@other-host bash scripts/pull-from-server-bfcpos.sh

set -e
SERVER="${SERVER:-admin93@192.168.1.2}"
REMOTE_DIR="/var/www/bfcpos"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Pulling from $SERVER:$REMOTE_DIR into $LOCAL_DIR"
echo "Excluding: node_modules, uploads, .env.production"
echo ""

if command -v rsync &>/dev/null; then
  rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude 'uploads' \
    --exclude '.env.production' \
    --exclude 'dist' \
    "$SERVER:$REMOTE_DIR/" "$LOCAL_DIR/"
  echo ""
  echo "Done. Run: npm install"
else
  echo "rsync not found. Using scp (will copy everything including node_modules)..."
  echo "To exclude node_modules, install rsync (e.g. via Git for Windows) and run again."
  read -p "Continue with full scp? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    scp -r "$SERVER:$REMOTE_DIR"/* "$LOCAL_DIR/"
    [ -d "$LOCAL_DIR/node_modules" ] && echo "Tip: rm -rf node_modules && npm install for a clean install"
  fi
fi
