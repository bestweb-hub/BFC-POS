#!/bin/bash
# Package POS instances for deployment (source only; server builds with npm run build using .env.production)
# Dist is excluded to keep tarballs small and speed up uploads.

set -e

echo "===== Packaging POS Instances (source only, no dist) ====="

# Package for BFC POS
echo "Creating bfcpos-deploy.tar.gz..."
tar -czf bfcpos-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='dist' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  client server shared migrations scripts \
  package.json package-lock.json \
  tsconfig.json vite.config.ts tailwind.config.ts \
  postcss.config.js drizzle.config.ts components.json \
  ecosystem-bfc.config.cjs env.production.bfc.example bfcpos.service

# Common files for all POS apps (no dist; server runs npm install + npm run build)
# start.sh is created on server by deploy-pos-server.sh
POS_FILES="client server shared migrations scripts package.json package-lock.json tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js drizzle.config.ts components.json"

# Adora POS
echo "Creating adorapos-deploy.tar.gz..."
tar -czf adorapos-deploy.tar.gz \
  --exclude='node_modules' --exclude='.git' --exclude='.env*' --exclude='dist' --exclude='*.log' --exclude='.DS_Store' \
  $POS_FILES adorapos.service ecosystem-adora.config.cjs env.production.adora.example

# Sea POS
echo "Creating seapos-deploy.tar.gz..."
tar -czf seapos-deploy.tar.gz \
  --exclude='node_modules' --exclude='.git' --exclude='.env*' --exclude='dist' --exclude='*.log' --exclude='.DS_Store' \
  $POS_FILES seapos.service ecosystem-sea.config.cjs env.production.sea.example

# Coffeehouse POS
echo "Creating coffeehouse-deploy.tar.gz..."
tar -czf coffeehouse-deploy.tar.gz \
  --exclude='node_modules' --exclude='.git' --exclude='.env*' --exclude='dist' --exclude='*.log' --exclude='.DS_Store' \
  $POS_FILES coffeehouse.service ecosystem-coffeehouse.config.cjs env.production.coffeehouse.example

# Bar POS (uses barpos.service - systemd unit name is barpos)
echo "Creating bar-deploy.tar.gz..."
tar -czf bar-deploy.tar.gz \
  --exclude='node_modules' --exclude='.git' --exclude='.env*' --exclude='dist' --exclude='*.log' --exclude='.DS_Store' \
  $POS_FILES barpos.service ecosystem-bar.config.cjs env.production.bar.example

echo "✓ Deployment packages created!"
echo ""
echo "Packages ready:"
echo "  - bfcpos-deploy.tar.gz"
echo "  - adorapos-deploy.tar.gz"
echo "  - seapos-deploy.tar.gz"
echo "  - coffeehouse-deploy.tar.gz"
echo "  - bar-deploy.tar.gz"
echo ""
echo "Next step: Run ./deploy-to-vps.sh to upload and deploy via Cloudflare Access SSH"

