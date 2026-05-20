#!/bin/bash
# Deploy LocalPOS tarballs to VPS via Cloudflare Access SSH.
# 1) Asks whether to build and package first (creates all tarballs).
# 2) Asks for each app: Deploy X? [y/N]
# 3) Uploads deploy-pos-server.sh and selected tarballs to /tmp/ on the server.
# 4) Runs deploy-pos-server.sh on the server with DEPLOY_BFC=..., etc.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cloudflare Access SSH
SSH_HOST="${SSH_HOST:-ssh.bfcpos.com}"
SSH_USER="${SSH_USER:-admin93}"
SSH_OPTS=(-o "ProxyCommand=cloudflared access ssh --hostname %h")
SSH_TARGET="${SSH_USER}@${SSH_HOST}"

# Apps and their tarballs
declare -A TARBALLS
TARBALLS[bfcpos]="bfcpos-deploy.tar.gz"
TARBALLS[adorapos]="adorapos-deploy.tar.gz"
TARBALLS[seapos]="seapos-deploy.tar.gz"
TARBALLS[coffeehouse]="coffeehouse-deploy.tar.gz"
TARBALLS[bar]="bar-deploy.tar.gz"

echo "===== Deploy to VPS (Cloudflare Access SSH) ====="
echo "Server: $SSH_TARGET"
echo ""

# --- Step 1: Optional build and package ---
read -p "Build and package all POS tarballs first? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if [ ! -f "BUILD_AND_PACKAGE.sh" ]; then
    echo "Error: BUILD_AND_PACKAGE.sh not found."
    exit 1
  fi
  bash BUILD_AND_PACKAGE.sh
  echo ""
fi

# --- Step 2: Ask for each app (always prompt; skip upload if tarball missing) ---
DEPLOY_BFC=false
DEPLOY_ADORA=false
DEPLOY_SEA=false
DEPLOY_COFFEEHOUSE=false
DEPLOY_BAR=false

for app in bfcpos adorapos seapos coffeehouse bar; do
  tarball="${TARBALLS[$app]}"
  read -p "Deploy $app? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    continue
  fi
  if [ -z "$tarball" ] || [ ! -f "$SCRIPT_DIR/$tarball" ]; then
    echo "  $tarball not found; run 'Build and package' first. Skipping $app."
    continue
  fi
  case $app in
    bfcpos)       DEPLOY_BFC=true ;;
    adorapos)     DEPLOY_ADORA=true ;;
    seapos)       DEPLOY_SEA=true ;;
    coffeehouse)  DEPLOY_COFFEEHOUSE=true ;;
    bar)          DEPLOY_BAR=true ;;
  esac
done

# --- Step 3: Upload server script and selected tarballs ---
echo ""
echo "===== Uploading deploy-pos-server.sh and tarballs to /tmp/ ====="

if [ ! -f "$SCRIPT_DIR/deploy-pos-server.sh" ]; then
  echo "Error: deploy-pos-server.sh not found in $SCRIPT_DIR"
  exit 1
fi
scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/deploy-pos-server.sh" "${SSH_TARGET}:/tmp/deploy-pos-server.sh"
echo "  deploy-pos-server.sh uploaded"

uploaded_any=false
$DEPLOY_BFC       && { scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/bfcpos-deploy.tar.gz"       "${SSH_TARGET}:/tmp/" && uploaded_any=true; } || true
$DEPLOY_ADORA     && { scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/adorapos-deploy.tar.gz"     "${SSH_TARGET}:/tmp/" && uploaded_any=true; } || true
$DEPLOY_SEA       && { scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/seapos-deploy.tar.gz"     "${SSH_TARGET}:/tmp/" && uploaded_any=true; } || true
$DEPLOY_COFFEEHOUSE && { scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/coffeehouse-deploy.tar.gz" "${SSH_TARGET}:/tmp/" && uploaded_any=true; } || true
$DEPLOY_BAR       && { scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/bar-deploy.tar.gz"          "${SSH_TARGET}:/tmp/" && uploaded_any=true; } || true

if [ "$uploaded_any" != "true" ]; then
  echo "No tarballs uploaded. Exiting."
  exit 0
fi

# --- Step 4: Run server deploy script with flags (-t gives sudo a TTY for password) ---
# Strip Windows CRLF line endings on server; pass deploy flags as arguments (sudo often strips env vars)
echo ""
echo "===== Running deploy-pos-server.sh on server ====="
ssh -t "${SSH_OPTS[@]}" "$SSH_TARGET" "sed -i 's/\\r\$//' /tmp/deploy-pos-server.sh; sudo bash /tmp/deploy-pos-server.sh $DEPLOY_BFC $DEPLOY_ADORA $DEPLOY_SEA $DEPLOY_COFFEEHOUSE $DEPLOY_BAR"

echo ""
echo "===== Done ====="
