#!/bin/bash
# Restore Bar POS sales (orders + order_items + due_payments + due_payment_allocations)
# from a barpos_db backup in /var/backups/pos-db-backups/
#
# Run on the VPS with: sudo bash restore-barpos-sales-from-backup.sh [TIMESTAMP]
# If TIMESTAMP is omitted, lists backups and prompts, or uses the latest.
# Example: sudo bash restore-barpos-sales-from-backup.sh 20260207-120000

set -e

BACKUP_PARENT="/var/backups/pos-db-backups"
BARPOS_BACKUP="barpos_db.sql.gz"
LIVE_DB="barpos_db"
TEMP_DB="barpos_restore_temp_$$"
# Tables to restore (order matters for FK: orders first, then order_items, then due_payments, then due_payment_allocations)
TABLES="orders order_items due_payments due_payment_allocations"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (sudo)."
  exit 1
fi

if [ -n "$1" ]; then
  TIMESTAMP="$1"
  BACKUP_DIR="$BACKUP_PARENT/$TIMESTAMP"
  if [ ! -f "$BACKUP_DIR/$BARPOS_BACKUP" ]; then
    echo "Backup not found: $BACKUP_DIR/$BARPOS_BACKUP"
    exit 1
  fi
else
  if [ ! -d "$BACKUP_PARENT" ]; then
    echo "Backup directory not found: $BACKUP_PARENT"
    exit 1
  fi
  echo "Available barpos backups (newest first):"
  echo ""
  for d in $(ls -1t "$BACKUP_PARENT" 2>/dev/null); do
    [ -f "$BACKUP_PARENT/$d/$BARPOS_BACKUP" ] && echo "  $d"
  done
  echo ""
  read -p "Enter backup timestamp to restore from (e.g. 20260207-120000): " TIMESTAMP
  BACKUP_DIR="$BACKUP_PARENT/$TIMESTAMP"
  if [ ! -f "$BACKUP_DIR/$BARPOS_BACKUP" ]; then
    echo "Backup not found: $BACKUP_DIR/$BARPOS_BACKUP"
    exit 1
  fi
fi

echo "=========================================="
echo "Bar POS Sales Restore"
echo "=========================================="
echo "Backup: $BACKUP_DIR/$BARPOS_BACKUP"
echo "Target DB: $LIVE_DB"
echo "Tables: $TABLES"
echo "=========================================="
read -p "This will REPLACE current orders/order_items/due_payments in barpos_db. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Create temp database and restore full backup into it
echo "Creating temporary database $TEMP_DB and restoring backup..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $TEMP_DB;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $TEMP_DB;"
gunzip -c "$BACKUP_DIR/$BARPOS_BACKUP" | sudo -u postgres psql -d "$TEMP_DB" -q

# Truncate sales-related tables in live DB (CASCADE handles FK order)
echo "Truncating sales tables in $LIVE_DB..."
sudo -u postgres psql -d "$LIVE_DB" -c "TRUNCATE due_payment_allocations, due_payments, order_items, orders CASCADE;"

# Copy data from temp DB to live DB (orders first, then order_items, then due_payments, then due_payment_allocations)
echo "Copying data from backup into $LIVE_DB..."
for table in $TABLES; do
  echo "  Restoring table: $table"
  sudo -u postgres pg_dump -d "$TEMP_DB" -t "$table" --data-only 2>/dev/null | sudo -u postgres psql -d "$LIVE_DB" -q
done

# Drop temp database
echo "Dropping temporary database..."
sudo -u postgres psql -c "DROP DATABASE $TEMP_DB;"

echo "=========================================="
echo "Restore complete."
echo "=========================================="
echo "Orders in barpos_db:"
sudo -u postgres psql -d "$LIVE_DB" -t -c "SELECT COUNT(*) FROM orders;"
echo "Order items:"
sudo -u postgres psql -d "$LIVE_DB" -t -c "SELECT COUNT(*) FROM order_items;"
echo ""
echo "Restart the Bar POS service to pick up changes: sudo systemctl restart barpos"
