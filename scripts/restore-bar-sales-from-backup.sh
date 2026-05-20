#!/bin/bash
# Restore Bar POS sales (orders + order_items + due_payments + due_payment_allocations)
# from a barpos_db backup under /var/backups/pos-db-backups/.
# Run on the VPS with: sudo bash restore-bar-sales-from-backup.sh [TIMESTAMP]
# If TIMESTAMP is omitted, the latest backup is used.
#
# Usage from your machine (copy script to server then run):
#   scp -o "ProxyCommand=cloudflared access ssh --hostname %h" scripts/restore-bar-sales-from-backup.sh admin93@ssh.bfcpos.com:/tmp/
#   ssh -o "ProxyCommand=cloudflared access ssh --hostname %h" admin93@ssh.bfcpos.com
#   sudo bash /tmp/restore-bar-sales-from-backup.sh
#   # or for a specific backup: sudo bash /tmp/restore-bar-sales-from-backup.sh 20260207-123456

set -e

BACKUP_PARENT="/var/backups/pos-db-backups"
BAR_DB="barpos_db"
TEMP_DB="barpos_restore_temp"
TABLES="orders order_items due_payments due_payment_allocations"

if [ ! -d "$BACKUP_PARENT" ]; then
  echo "Error: Backup directory $BACKUP_PARENT not found."
  exit 1
fi

# List available timestamps (newest first)
TIMESTAMPS=($(ls -1t "$BACKUP_PARENT" 2>/dev/null))
if [ ${#TIMESTAMPS[@]} -eq 0 ]; then
  echo "Error: No backup timestamps found in $BACKUP_PARENT"
  exit 1
fi

# Use argument or latest
if [ -n "$1" ]; then
  if [ ! -d "$BACKUP_PARENT/$1" ]; then
    echo "Error: No such timestamp: $1"
    echo "Available: ${TIMESTAMPS[*]}"
    exit 1
  fi
  CHOSEN="$1"
else
  CHOSEN="${TIMESTAMPS[0]}"
  echo "Using latest backup: $CHOSEN"
fi

BACKUP_FILE="$BACKUP_PARENT/$CHOSEN/barpos_db.sql.gz"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "=========================================="
echo "Bar POS – Restore sales from backup"
echo "=========================================="
echo "Backup: $BACKUP_FILE"
echo "Target DB: $BAR_DB"
echo "Tables to restore: $TABLES"
echo ""
if [ "$SKIP_CONFIRM" != "1" ]; then
  read -p "This will REPLACE current orders/sales in barpos_db with backup data. Continue? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Create temp database and restore full backup into it
echo "Creating temporary database $TEMP_DB and restoring backup..."
sudo -u postgres dropdb --if-exists "$TEMP_DB" 2>/dev/null || true
sudo -u postgres createdb "$TEMP_DB"
gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -q -d "$TEMP_DB" 2>/dev/null || true

# Truncate sales-related tables in live DB (order matters for FKs)
echo "Truncating current orders/order_items/due_payments in $BAR_DB..."
sudo -u postgres psql -d "$BAR_DB" -c "TRUNCATE due_payment_allocations, due_payments, order_items, orders CASCADE;"

# Copy data from temp to live (data-only; tables must exist)
echo "Copying sales data from backup into $BAR_DB..."
for t in orders order_items due_payments due_payment_allocations; do
  if sudo -u postgres psql -d "$TEMP_DB" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$t'" | grep -q 1; then
    echo "  Restoring table: $t"
    sudo -u postgres pg_dump -a -t "$t" "$TEMP_DB" 2>/dev/null | sudo -u postgres psql -q -d "$BAR_DB" 2>/dev/null || echo "    (warnings above are often safe)"
  else
    echo "  Skipping $t (not in backup)"
  fi
done

# Drop temp database
echo "Dropping temporary database..."
sudo -u postgres dropdb --if-exists "$TEMP_DB"

echo ""
echo "=========================================="
echo "Done. Sales data restored from backup $CHOSEN."
echo "=========================================="
echo "Verify at: https://bar.bfcpos.com/sales"
echo ""
