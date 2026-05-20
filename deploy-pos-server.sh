#!/bin/bash
set -e

# Deployment flags: pass as arguments (e.g. sudo bash deploy-pos-server.sh true true false false false)
# so they work even when sudo strips environment variables. Defaults: all true if no args.
DEPLOY_BFC=${1:-true}
DEPLOY_ADORA=${2:-true}
DEPLOY_SEA=${3:-true}
DEPLOY_COFFEEHOUSE=${4:-true}
DEPLOY_BAR=${5:-true}

echo "=========================================="
echo "Server-side Deployment"
echo "=========================================="
echo "Deploying:"
[ "$DEPLOY_BFC" = "true" ] && echo "  ✓ BFC POS" || echo "  ✗ BFC POS (skipped)"
[ "$DEPLOY_ADORA" = "true" ] && echo "  ✓ Adora POS" || echo "  ✗ Adora POS (skipped)"
[ "$DEPLOY_SEA" = "true" ] && echo "  ✓ Sea POS" || echo "  ✗ Sea POS (skipped)"
[ "$DEPLOY_COFFEEHOUSE" = "true" ] && echo "  ✓ Coffeehouse POS" || echo "  ✗ Coffeehouse POS (skipped)"
[ "$DEPLOY_BAR" = "true" ] && echo "  ✓ Bar POS" || echo "  ✗ Bar POS (skipped)"
echo "=========================================="

# Backup all POS PostgreSQL databases before any deploy (preserves existing products/data)
echo ""
echo "=========================================="
echo "Backing up PostgreSQL databases..."
echo "=========================================="
BACKUP_PARENT="/var/backups/pos-db-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_PARENT/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_PARENT" 2>/dev/null || true
for db in bfcpos_db adorapos_db seapos_db coffeehouse_db barpos_db; do
  if sudo -u postgres psql -lqt 2>/dev/null | cut -d '|' -f 1 | grep -qw "$db"; then
    echo "  Backing up $db..."
    sudo -u postgres pg_dump "$db" 2>/dev/null | gzip > "$BACKUP_DIR/${db}.sql.gz" && echo "    ✓ $db" || echo "    ✗ $db failed"
  else
    echo "  Skipping $db (does not exist)"
  fi
done
echo "✓ Backups saved to $BACKUP_DIR"
echo "=========================================="
echo ""

# Function to free up memory
free_memory() {
    echo "Freeing up memory..."
    sync
    echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
    sleep 2
}

# Function to check available memory
check_memory() {
    local available
    available=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    echo "Available memory: ${available}MB"
    if [ "$available" -lt 500 ]; then
        echo "Warning: Low memory detected (${available}MB). Freeing up memory..."
        free_memory
    fi
}

# Check if nodejs user exists, create if not
if ! id "nodejs" &>/dev/null; then
    echo "Creating nodejs user..."
    useradd -r -s /bin/bash -m -d /home/nodejs nodejs || true
    mkdir -p /home/nodejs
    chown -R nodejs:nodejs /home/nodejs
fi

# Create directories
echo "Creating application directories..."
mkdir -p /var/www/bfcpos /var/log/bfcpos /var/backups/bfcpos
mkdir -p /var/www/adorapos /var/log/adorapos /var/backups/adorapos
mkdir -p /var/www/seapos /var/log/seapos /var/backups/seapos
mkdir -p /var/www/coffeehouse /var/log/coffeehouse /var/backups/coffeehouse
mkdir -p /var/www/bar /var/log/bar /var/backups/bar
mkdir -p /var/www/bfcpos/uploads  /var/www/adorapos/uploads /var/www/seapos/uploads /var/www/coffeehouse/uploads /var/www/bar/uploads
# Set ownership - split into separate commands to avoid memory issues
chown -R nodejs:nodejs /var/www/bfcpos || echo "Warning: Failed to chown /var/www/bfcpos"
chown -R nodejs:nodejs /var/log/bfcpos || echo "Warning: Failed to chown /var/log/bfcpos"
chown -R nodejs:nodejs /var/backups/bfcpos || echo "Warning: Failed to chown /var/backups/bfcpos"
chown -R nodejs:nodejs /var/www/adorapos || echo "Warning: Failed to chown /var/www/adorapos"
chown -R nodejs:nodejs /var/log/adorapos || echo "Warning: Failed to chown /var/log/adorapos"
chown -R nodejs:nodejs /var/backups/adorapos || echo "Warning: Failed to chown /var/backups/adorapos"
chown -R nodejs:nodejs /var/www/seapos || echo "Warning: Failed to chown /var/www/seapos"
chown -R nodejs:nodejs /var/log/seapos || echo "Warning: Failed to chown /var/log/seapos"
chown -R nodejs:nodejs /var/backups/seapos || echo "Warning: Failed to chown /var/backups/seapos"
chown -R nodejs:nodejs /var/www/coffeehouse || echo "Warning: Failed to chown /var/www/coffeehouse"
chown -R nodejs:nodejs /var/log/coffeehouse || echo "Warning: Failed to chown /var/log/coffeehouse"
chown -R nodejs:nodejs /var/backups/coffeehouse || echo "Warning: Failed to chown /var/backups/coffeehouse"
chown -R nodejs:nodejs /var/www/bar || echo "Warning: Failed to chown /var/www/bar"
chown -R nodejs:nodejs /var/log/bar || echo "Warning: Failed to chown /var/log/bar"
chown -R nodejs:nodejs /var/backups/bar || echo "Warning: Failed to chown /var/backups/bar"
# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL not found. Installing..."
    apt update
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# Create databases and users if they don't exist
echo "Setting up databases..."
export PWD=/tmp
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_database WHERE datname = 'bfcpos_db'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE DATABASE bfcpos_db" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_database WHERE datname = 'adorapos_db'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE DATABASE adorapos_db" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_database WHERE datname = 'seapos_db'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE DATABASE seapos_db" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_database WHERE datname = 'coffeehouse_db'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE DATABASE coffeehouse_db" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_database WHERE datname = 'barpos_db'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE DATABASE barpos_db" 2>/dev/null || true

# Create users if they don't exist
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_user WHERE usename = 'bfcpos_user'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE USER bfcpos_user WITH PASSWORD 'BfcPOS2024!Secure'" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_user WHERE usename = 'adorapos_user'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE USER adorapos_user WITH PASSWORD 'AdoraPOS2024!Secure'" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_user WHERE usename = 'seapos_user'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE USER seapos_user WITH PASSWORD 'SeaPOS2024!Secure'" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_user WHERE usename = 'coffeehouse_user'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE USER coffeehouse_user WITH PASSWORD 'CoffeehousePOS2024!Secure'" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "SELECT 1 FROM pg_user WHERE usename = 'barpos_user'" 2>/dev/null | grep -q 1 || sudo -u postgres env PWD=/tmp psql -c "CREATE USER barpos_user WITH PASSWORD 'BarPOS2024!Secure'" 2>/dev/null || true

# Grant privileges
sudo -u postgres env PWD=/tmp psql -c "GRANT ALL PRIVILEGES ON DATABASE bfcpos_db TO bfcpos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "GRANT ALL PRIVILEGES ON DATABASE adorapos_db TO adorapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "GRANT ALL PRIVILEGES ON DATABASE seapos_db TO seapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "GRANT ALL PRIVILEGES ON DATABASE coffeehouse_db TO coffeehouse_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -c "GRANT ALL PRIVILEGES ON DATABASE barpos_db TO barpos_user" 2>/dev/null || true

# Connect to each database and grant schema privileges
sudo -u postgres env PWD=/tmp psql -d bfcpos_db -c "GRANT ALL ON SCHEMA public TO bfcpos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d bfcpos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bfcpos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d bfcpos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bfcpos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d adorapos_db -c "GRANT ALL ON SCHEMA public TO adorapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d adorapos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO adorapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d adorapos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO adorapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d seapos_db -c "GRANT ALL ON SCHEMA public TO seapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d seapos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO seapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d seapos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO seapos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d coffeehouse_db -c "GRANT ALL ON SCHEMA public TO coffeehouse_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d coffeehouse_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO coffeehouse_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d coffeehouse_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO coffeehouse_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d barpos_db -c "GRANT ALL ON SCHEMA public TO barpos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d barpos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO barpos_user" 2>/dev/null || true
sudo -u postgres env PWD=/tmp psql -d barpos_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO barpos_user" 2>/dev/null || true

# Deploy BFC POS
if [ "$DEPLOY_BFC" = "true" ]; then
echo ""
echo "=========================================="
echo "Deploying BFC POS..."
echo "=========================================="

cd /var/www/bfcpos
echo "Extracting package..."
tar -xzf /tmp/bfcpos-deploy.tar.gz --overwrite

if [ -f "ecosystem-bfc.config.cjs" ] && [ ! -f "ecosystem.config.cjs" ]; then
    mv ecosystem-bfc.config.cjs ecosystem.config.cjs
fi
if [ -f "start-bfc.sh" ] && [ ! -f "start.sh" ]; then
    mv start-bfc.sh start.sh
    chmod +x start.sh
fi

cat > start.sh << 'STARTSH'
#!/bin/bash
# BFC POS System - Startup Wrapper Script
set -e
set -a
source /var/www/bfcpos/.env.production
set +a
cd /var/www/bfcpos
exec node dist/index.js
STARTSH
chmod +x start.sh

if [ ! -f ".env.production" ]; then
    echo "Creating .env.production for BFC POS from example..."
    if [ -f "env.production.bfc.example" ]; then
        cp env.production.bfc.example .env.production
        SESSION_SECRET=$(openssl rand -base64 32)
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env.production
    else
        SESSION_SECRET=$(openssl rand -base64 32)
        cat > .env.production << ENVEOF
DATABASE_URL=postgresql://bfcpos_user:BfcPOS2024!Secure@localhost:5432/bfcpos_db
SESSION_SECRET=$SESSION_SECRET
PORT=7050
NODE_ENV=production
CENTRAL_DASHBOARD_API_KEY=central-dashboard-2024-secure-key
ENVEOF
    fi
    chmod 600 .env.production
fi

free_memory
echo "Setting permissions for BFC POS..."
sudo -u nodejs bash -c "cd /var/www/bfcpos && rm -rf node_modules" 2>/dev/null || true
chown -R nodejs:nodejs /var/www/bfcpos 2>/dev/null || echo "Warning: Failed to chown /var/www/bfcpos"
check_memory

echo "Installing all dependencies (full install)..."
MAX_RETRIES=5
RETRY_COUNT=0
INSTALL_SUCCESS=false
while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$INSTALL_SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        echo "npm install attempt $RETRY_COUNT/$MAX_RETRIES failed, freeing memory and retrying..."
        free_memory
        check_memory
        sleep 2
    fi
    if sudo -u nodejs bash -c "cd /var/www/bfcpos && npm install --no-audit --no-fund --prefer-offline" 2>&1; then
        if sudo -u nodejs bash -c "cd /var/www/bfcpos && test -d node_modules/express" 2>/dev/null; then
            INSTALL_SUCCESS=true
            echo "✓ Dependencies installed successfully"
        else
            echo "⚠ Installation incomplete, missing packages detected"
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ "$INSTALL_SUCCESS" = false ]; then
    echo "ERROR: Failed to install dependencies after $MAX_RETRIES attempts"
    exit 1
fi

echo "Building application (using .env.production)..."
sudo -u nodejs bash -c "set -a && source /var/www/bfcpos/.env.production && set +a && cd /var/www/bfcpos && npm run build" || { echo "ERROR: Build failed"; exit 1; }

if [ ! -d "/var/www/bfcpos/dist/public" ] || [ ! -f "/var/www/bfcpos/dist/index.js" ]; then
    echo "ERROR: Build did not produce dist/public or dist/index.js"
    exit 1
fi
echo "✓ Build completed"

echo "Running database migrations..."
sudo -u nodejs bash -c "set -a && source /var/www/bfcpos/.env.production && MIGRATION_QUIET=1 && set +a && cd /var/www/bfcpos && npm run db:migrate:all" || echo "Warning: Migration had issues, but continuing..."

echo "Setting up systemd service..."
cp bfcpos.service /etc/systemd/system/bfcpos.service
systemctl daemon-reload
systemctl enable bfcpos
systemctl restart bfcpos
echo "✓ BFC POS deployed!"
free_memory
fi

# Deploy Adora POS
if [ "$DEPLOY_ADORA" = "true" ]; then
echo ""
echo "=========================================="
echo "Deploying Adora POS..."
echo "=========================================="

cd /var/www/adorapos
echo "Extracting package..."
tar -xzf /tmp/adorapos-deploy.tar.gz --overwrite

if [ -f "ecosystem-adora.config.cjs" ] && [ ! -f "ecosystem.config.cjs" ]; then
    cp ecosystem-adora.config.cjs ecosystem.config.cjs
fi
if [ -f "start-bfc.sh" ] && [ ! -f "start.sh" ]; then
    cp start-bfc.sh start.sh
    chmod +x start.sh
fi

cat > start.sh << 'STARTSH'
#!/bin/bash
# Adora POS System - Startup Wrapper Script
set -e
set -a
source /var/www/adorapos/.env.production
set +a
cd /var/www/adorapos
exec node dist/index.js
STARTSH
chmod +x start.sh

if [ ! -f ".env.production" ]; then
    echo "Creating .env.production for Adora POS from example..."
    if [ -f "env.production.adora.example" ]; then
        cp env.production.adora.example .env.production
        SESSION_SECRET=$(openssl rand -base64 32)
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env.production
    else
        SESSION_SECRET=$(openssl rand -base64 32)
        cat > .env.production << ENVEOF
DATABASE_URL=postgresql://adorapos_user:AdoraPOS2024!Secure@localhost:5432/adorapos_db
SESSION_SECRET=$SESSION_SECRET
PORT=7060
NODE_ENV=production
CENTRAL_DASHBOARD_API_KEY=central-dashboard-2024-secure-key
ENVEOF
    fi
    chmod 600 .env.production
fi

free_memory
echo "Setting permissions for Adora POS..."
sudo -u nodejs bash -c "cd /var/www/adorapos && rm -rf node_modules" 2>/dev/null || true
chown -R nodejs:nodejs /var/www/adorapos 2>/dev/null || echo "Warning: Failed to chown /var/www/adorapos"
free_memory
check_memory

echo "Installing all dependencies (full install)..."
MAX_RETRIES=5
RETRY_COUNT=0
INSTALL_SUCCESS=false
while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$INSTALL_SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        echo "npm install attempt $RETRY_COUNT/$MAX_RETRIES failed, freeing memory and retrying..."
        free_memory
        check_memory
        sleep 2
    fi
    if sudo -u nodejs bash -c "cd /var/www/adorapos && npm install --no-audit --no-fund --prefer-offline" 2>&1; then
        if sudo -u nodejs bash -c "cd /var/www/adorapos && test -d node_modules/express" 2>/dev/null; then
            INSTALL_SUCCESS=true
            echo "✓ Dependencies installed successfully"
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ "$INSTALL_SUCCESS" = false ]; then
    echo "ERROR: Failed to install dependencies after $MAX_RETRIES attempts"
    exit 1
fi

echo "Building application (using .env.production)..."
sudo -u nodejs bash -c "set -a && source /var/www/adorapos/.env.production && set +a && cd /var/www/adorapos && npm run build" || { echo "ERROR: Build failed"; exit 1; }

if [ ! -d "/var/www/adorapos/dist/public" ] || [ ! -f "/var/www/adorapos/dist/index.js" ]; then
    echo "ERROR: Build did not produce dist/public or dist/index.js"
    exit 1
fi
echo "✓ Build completed"

echo "Running database migrations..."
sudo -u nodejs bash -c "set -a && source /var/www/adorapos/.env.production && MIGRATION_QUIET=1 && set +a && cd /var/www/adorapos && npm run db:migrate:all" || echo "Warning: Migration had issues, but continuing..."

cp adorapos.service /etc/systemd/system/adorapos.service
systemctl daemon-reload
systemctl enable adorapos
systemctl restart adorapos
echo "✓ Adora POS deployed!"
free_memory
fi

# Deploy Sea POS
if [ "$DEPLOY_SEA" = "true" ]; then
echo ""
echo "=========================================="
echo "Deploying Sea POS..."
echo "=========================================="

cd /var/www/seapos
echo "Extracting package..."
tar -xzf /tmp/seapos-deploy.tar.gz --overwrite

if [ -f "ecosystem-sea.config.cjs" ] && [ ! -f "ecosystem.config.cjs" ]; then
    cp ecosystem-sea.config.cjs ecosystem.config.cjs
fi
if [ -f "start-bfc.sh" ] && [ ! -f "start.sh" ]; then
    cp start-bfc.sh start.sh
    chmod +x start.sh
fi

cat > start.sh << 'STARTSH'
#!/bin/bash
# Sea POS System - Startup Wrapper Script
set -e
set -a
source /var/www/seapos/.env.production
set +a
cd /var/www/seapos
exec node dist/index.js
STARTSH
chmod +x start.sh

if [ ! -f ".env.production" ]; then
    echo "Creating .env.production for Sea POS from example..."
    if [ -f "env.production.sea.example" ]; then
        cp env.production.sea.example .env.production
        SESSION_SECRET=$(openssl rand -base64 32)
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env.production
    else
        SESSION_SECRET=$(openssl rand -base64 32)
        cat > .env.production << ENVEOF
DATABASE_URL=postgresql://seapos_user:SeaPOS2024!Secure@localhost:5432/seapos_db
SESSION_SECRET=$SESSION_SECRET
PORT=7070
NODE_ENV=production
CENTRAL_DASHBOARD_API_KEY=central-dashboard-2024-secure-key
ENVEOF
    fi
    chmod 600 .env.production
fi

free_memory
echo "Setting permissions for Sea POS..."
sudo -u nodejs bash -c "cd /var/www/seapos && rm -rf node_modules" 2>/dev/null || true
chown -R nodejs:nodejs /var/www/seapos 2>/dev/null || echo "Warning: Failed to chown /var/www/seapos"
free_memory
check_memory

echo "Installing all dependencies (full install)..."
MAX_RETRIES=5
RETRY_COUNT=0
INSTALL_SUCCESS=false
while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$INSTALL_SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        free_memory
        check_memory
        sleep 2
    fi
    if sudo -u nodejs bash -c "cd /var/www/seapos && npm install --no-audit --no-fund --prefer-offline" 2>&1; then
        if sudo -u nodejs bash -c "cd /var/www/seapos && test -d node_modules/express" 2>/dev/null; then
            INSTALL_SUCCESS=true
            echo "✓ Dependencies installed successfully"
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ "$INSTALL_SUCCESS" = false ]; then
    echo "ERROR: Failed to install dependencies after $MAX_RETRIES attempts"
    exit 1
fi

echo "Building application (using .env.production)..."
sudo -u nodejs bash -c "set -a && source /var/www/seapos/.env.production && set +a && cd /var/www/seapos && npm run build" || { echo "ERROR: Build failed"; exit 1; }

if [ ! -d "/var/www/seapos/dist/public" ] || [ ! -f "/var/www/seapos/dist/index.js" ]; then
    echo "ERROR: Build did not produce dist/public or dist/index.js"
    exit 1
fi
echo "✓ Build completed"

echo "Running database migrations..."
sudo -u nodejs bash -c "set -a && source /var/www/seapos/.env.production && MIGRATION_QUIET=1 && set +a && cd /var/www/seapos && npm run db:migrate:all" || echo "Warning: Migration had issues, but continuing..."

cp seapos.service /etc/systemd/system/seapos.service
systemctl daemon-reload
systemctl enable seapos
systemctl restart seapos
echo "✓ Sea POS deployed!"
free_memory
fi

# Deploy Coffeehouse POS
if [ "$DEPLOY_COFFEEHOUSE" = "true" ]; then
echo ""
echo "=========================================="
echo "Deploying Coffeehouse POS..."
echo "=========================================="

cd /var/www/coffeehouse
echo "Extracting package..."
tar -xzf /tmp/coffeehouse-deploy.tar.gz --overwrite

if [ -f "ecosystem-coffeehouse.config.cjs" ] && [ ! -f "ecosystem.config.cjs" ]; then
    cp ecosystem-coffeehouse.config.cjs ecosystem.config.cjs
fi
if [ -f "start-bfc.sh" ] && [ ! -f "start.sh" ]; then
    cp start-bfc.sh start.sh
    chmod +x start.sh
fi

cat > start.sh << 'STARTSH'
#!/bin/bash
# Coffeehouse POS System - Startup Wrapper Script
set -e
set -a
source /var/www/coffeehouse/.env.production
set +a
cd /var/www/coffeehouse
exec node dist/index.js
STARTSH
chmod +x start.sh

if [ ! -f ".env.production" ]; then
    echo "Creating .env.production for Coffeehouse POS from example..."
    if [ -f "env.production.coffeehouse.example" ]; then
        cp env.production.coffeehouse.example .env.production
        SESSION_SECRET=$(openssl rand -base64 32)
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env.production
    else
        SESSION_SECRET=$(openssl rand -base64 32)
        cat > .env.production << ENVEOF
DATABASE_URL=postgresql://coffeehouse_user:CoffeehousePOS2024!Secure@localhost:5432/coffeehouse_db
SESSION_SECRET=$SESSION_SECRET
PORT=7080
NODE_ENV=production
CENTRAL_DASHBOARD_API_KEY=central-dashboard-2024-secure-key
ENVEOF
    fi
    chmod 600 .env.production
fi

free_memory
echo "Setting permissions for Coffeehouse POS..."
sudo -u nodejs bash -c "cd /var/www/coffeehouse && rm -rf node_modules" 2>/dev/null || true
chown -R nodejs:nodejs /var/www/coffeehouse 2>/dev/null || echo "Warning: Failed to chown /var/www/coffeehouse"
free_memory
check_memory

echo "Installing all dependencies (full install)..."
MAX_RETRIES=5
RETRY_COUNT=0
INSTALL_SUCCESS=false
while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$INSTALL_SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        free_memory
        check_memory
        sleep 2
    fi
    if sudo -u nodejs bash -c "cd /var/www/coffeehouse && npm install --no-audit --no-fund --prefer-offline" 2>&1; then
        if sudo -u nodejs bash -c "cd /var/www/coffeehouse && test -d node_modules/express" 2>/dev/null; then
            INSTALL_SUCCESS=true
            echo "✓ Dependencies installed successfully"
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ "$INSTALL_SUCCESS" = false ]; then
    echo "ERROR: Failed to install dependencies after $MAX_RETRIES attempts"
    exit 1
fi

echo "Building application (using .env.production)..."
sudo -u nodejs bash -c "set -a && source /var/www/coffeehouse/.env.production && set +a && cd /var/www/coffeehouse && npm run build" || { echo "ERROR: Build failed"; exit 1; }

if [ ! -d "/var/www/coffeehouse/dist/public" ] || [ ! -f "/var/www/coffeehouse/dist/index.js" ]; then
    echo "ERROR: Build did not produce dist/public or dist/index.js"
    exit 1
fi
echo "✓ Build completed"

echo "Running database migrations..."
sudo -u nodejs bash -c "set -a && source /var/www/coffeehouse/.env.production && MIGRATION_QUIET=1 && set +a && cd /var/www/coffeehouse && npm run db:migrate:all" || echo "Warning: Migration had issues, but continuing..."

cp coffeehouse.service /etc/systemd/system/coffeehouse.service
systemctl daemon-reload
systemctl enable coffeehouse
systemctl restart coffeehouse
echo "✓ Coffeehouse POS deployed!"
free_memory
fi

# Deploy Bar POS
if [ "$DEPLOY_BAR" = "true" ]; then
echo ""
echo "=========================================="
echo "Deploying Bar POS..."
echo "=========================================="

cd /var/www/bar
echo "Extracting package..."
tar -xzf /tmp/bar-deploy.tar.gz --overwrite

if [ -f "ecosystem-bar.config.cjs" ] && [ ! -f "ecosystem.config.cjs" ]; then
    cp ecosystem-bar.config.cjs ecosystem.config.cjs
fi
if [ -f "start-bfc.sh" ] && [ ! -f "start.sh" ]; then
    cp start-bfc.sh start.sh
    chmod +x start.sh
fi

cat > start.sh << 'STARTSH'
#!/bin/bash
# Bar POS System - Startup Wrapper Script
set -e
set -a
source /var/www/bar/.env.production
set +a
cd /var/www/bar
exec node dist/index.js
STARTSH
chmod +x start.sh

if [ ! -f ".env.production" ]; then
    echo "Creating .env.production for Bar POS from example..."
    if [ -f "env.production.bar.example" ]; then
        cp env.production.bar.example .env.production
        SESSION_SECRET=$(openssl rand -base64 32)
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env.production
    else
        SESSION_SECRET=$(openssl rand -base64 32)
        cat > .env.production << ENVEOF
DATABASE_URL=postgresql://barpos_user:BarPOS2024!Secure@localhost:5432/barpos_db
SESSION_SECRET=$SESSION_SECRET
PORT=7100
NODE_ENV=production
CENTRAL_DASHBOARD_API_KEY=central-dashboard-2024-secure-key
ENVEOF
    fi
    chmod 600 .env.production
fi

free_memory
echo "Setting permissions for Bar POS..."
sudo -u nodejs bash -c "cd /var/www/bar && rm -rf node_modules" 2>/dev/null || true
chown -R nodejs:nodejs /var/www/bar 2>/dev/null || echo "Warning: Failed to chown /var/www/bar"
free_memory
check_memory

echo "Installing all dependencies (full install)..."
MAX_RETRIES=5
RETRY_COUNT=0
INSTALL_SUCCESS=false
while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$INSTALL_SUCCESS" = false ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        free_memory
        check_memory
        sleep 2
    fi
    if sudo -u nodejs bash -c "cd /var/www/bar && npm install --no-audit --no-fund --prefer-offline" 2>&1; then
        if sudo -u nodejs bash -c "cd /var/www/bar && test -d node_modules/express" 2>/dev/null; then
            INSTALL_SUCCESS=true
            echo "✓ Dependencies installed successfully"
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
        fi
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ "$INSTALL_SUCCESS" = false ]; then
    echo "ERROR: Failed to install dependencies after $MAX_RETRIES attempts"
    exit 1
fi

echo "Building application (using .env.production)..."
sudo -u nodejs bash -c "set -a && source /var/www/bar/.env.production && set +a && cd /var/www/bar && npm run build" || { echo "ERROR: Build failed"; exit 1; }

if [ ! -d "/var/www/bar/dist/public" ] || [ ! -f "/var/www/bar/dist/index.js" ]; then
    echo "ERROR: Build did not produce dist/public or dist/index.js"
    exit 1
fi
echo "✓ Build completed"

echo "Running database migrations..."
sudo -u nodejs bash -c "set -a && source /var/www/bar/.env.production && MIGRATION_QUIET=1 && set +a && cd /var/www/bar && npm run db:migrate:all" || echo "Warning: Migration had issues, but continuing..."

cp barpos.service /etc/systemd/system/barpos.service
systemctl daemon-reload
systemctl enable barpos
systemctl restart barpos
echo "✓ Bar POS deployed!"
free_memory
fi

# Cleanup
[ "$DEPLOY_BFC" = "true" ] && rm -f /tmp/bfcpos-deploy.tar.gz || true
[ "$DEPLOY_ADORA" = "true" ] && rm -f /tmp/adorapos-deploy.tar.gz || true
[ "$DEPLOY_SEA" = "true" ] && rm -f /tmp/seapos-deploy.tar.gz || true
[ "$DEPLOY_COFFEEHOUSE" = "true" ] && rm -f /tmp/coffeehouse-deploy.tar.gz || true
[ "$DEPLOY_BAR" = "true" ] && rm -f /tmp/bar-deploy.tar.gz || true

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Services status:"
[ "$DEPLOY_BFC" = "true" ] && { echo "  BFC POS:"; systemctl status bfcpos --no-pager | head -5 || true; echo ""; }
[ "$DEPLOY_ADORA" = "true" ] && { echo "  Adora POS:"; systemctl status adorapos --no-pager | head -5 || true; echo ""; }
[ "$DEPLOY_SEA" = "true" ] && { echo "  Sea POS:"; systemctl status seapos --no-pager | head -5 || true; echo ""; }
[ "$DEPLOY_COFFEEHOUSE" = "true" ] && { echo "  Coffeehouse POS:"; systemctl status coffeehouse --no-pager | head -5 || true; echo ""; }
[ "$DEPLOY_BAR" = "true" ] && { echo "  Bar POS:"; systemctl status barpos --no-pager | head -5 || true; echo ""; }
echo "Access: http://bfc.bfcpos.com | http://adora.bfcpos.com | http://sea.bfcpos.com | http://coffeehouse.bfcpos.com | http://bar.bfcpos.com"
echo ""
