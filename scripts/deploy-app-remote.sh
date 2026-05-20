#!/bin/bash
# Run on the VPS after extracting a deploy tarball into /var/www/APP_NAME.
# Usage: sudo ./deploy-app-remote.sh APP_NAME [PORT]
# Example: sudo ./deploy-app-remote.sh bfcpos 7000
#
# Does: set permissions, create DB if missing, create .env.production if missing,
#       npm install, npm run build, run migrations, restart service.

set -e

APP_NAME="${1:?Usage: deploy-app-remote.sh APP_NAME [PORT]}"
APP_DIR="/var/www/$APP_NAME"
DEPLOY_USER="${DEPLOY_USER:-nodejs}"
SERVICE_NAME="$APP_NAME"

# Port: from argument, or default per app
if [ -n "$2" ]; then
  PORT="$2"
else
  case "$APP_NAME" in
    bfcpos)      PORT=7000 ;;
    adorapos)    PORT=7010 ;;
    coffeehouse) PORT=7020 ;;
    seapos)      PORT=7030 ;;
    bar)         PORT=7040 ;;
    *)           PORT=7000 ;;
  esac
fi

echo "====== Deploying $APP_NAME (port $PORT) ======"
cd "$APP_DIR"

# Set ownership
echo "Setting permissions..."
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
sudo mkdir -p "$APP_DIR/uploads"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/uploads"

# Create .env.production from template if missing
ENV_FILE="$APP_DIR/.env.production"
TEMPLATE="$APP_DIR/env.production.$APP_NAME.example"
if [ ! -f "$TEMPLATE" ]; then
  TEMPLATE="$APP_DIR/env.production.example"
fi
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$TEMPLATE" ]; then
    echo "Creating .env.production from $TEMPLATE..."
    sudo -u "$DEPLOY_USER" cp "$TEMPLATE" "$ENV_FILE"
    # Ensure PORT is set
    if ! grep -q '^PORT=' "$ENV_FILE"; then
      echo "PORT=$PORT" >> "$ENV_FILE"
    fi
    echo "Created .env.production. Edit it to set DATABASE_URL and SESSION_SECRET."
  else
    echo "ERROR: .env.production missing and no template found (env.production.$APP_NAME.example or env.production.example)."
    exit 1
  fi
else
  echo ".env.production already present, skipping."
fi

# Create PostgreSQL database if not present (parse DATABASE_URL from .env.production)
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a
if [ -n "$DATABASE_URL" ]; then
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^/?]*\).*|\1|p')
  if [ -n "$DB_NAME" ] && command -v psql &>/dev/null; then
    echo "Checking database $DB_NAME..."
    if sudo -u "$DEPLOY_USER" bash -c "set -a && source $ENV_FILE && set +a && psql \"$DATABASE_URL\" -tc 'SELECT 1'" 2>/dev/null | grep -q 1; then
      echo "Database $DB_NAME is reachable."
    else
      # Connect to 'postgres' to create the target database
      CREATE_URL=$(echo "$DATABASE_URL" | sed "s|/${DB_NAME}\$|/postgres|" | sed "s|/${DB_NAME}?|/postgres?|")
      EXISTS=$(sudo -u "$DEPLOY_USER" bash -c "set -a && source $ENV_FILE && set +a && psql \"$CREATE_URL\" -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" 2>/dev/null || true)
      if [ "$EXISTS" = "1" ]; then
        echo "Database $DB_NAME already exists."
      else
        echo "Creating database $DB_NAME..."
        sudo -u "$DEPLOY_USER" bash -c "set -a && source $ENV_FILE && set +a && psql \"$CREATE_URL\" -tc \"CREATE DATABASE \\\"$DB_NAME\\\";\"" 2>/dev/null || echo "Note: Could not create database (ensure user has CREATEDB or create manually)."
      fi
    fi
  fi
fi

# Install dependencies
echo "Installing dependencies..."
sudo -u "$DEPLOY_USER" bash -c "cd $APP_DIR && npm install --no-audit --no-fund"

# Build
echo "Building application..."
sudo -u "$DEPLOY_USER" bash -c "cd $APP_DIR && npm run build"

# Migrations
echo "Running database migrations..."
sudo -u "$DEPLOY_USER" bash -c "set -a && source $APP_DIR/.env.production && set +a && cd $APP_DIR && npm run db:migrate:all" || echo "Warning: Migrations had issues, continuing."

# Copy systemd service if present and reload
if [ -f "$APP_DIR/$APP_NAME.service" ]; then
  sudo cp "$APP_DIR/$APP_NAME.service" "/etc/systemd/system/$SERVICE_NAME.service"
  sudo systemctl daemon-reload
fi

# Start service
echo "Starting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

echo "====== Deploy complete: $APP_NAME ======"
