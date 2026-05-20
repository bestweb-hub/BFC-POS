# Recover Bar POS Sales from Database Backup

If sales (orders) were deleted from **bar.bfcpos.com**, you can restore them from the backups created during deploy. Backups are stored on the VPS at `/var/backups/pos-db-backups/<timestamp>/barpos_db.sql.gz`.

## 1. SSH into the server

From PowerShell (with Cloudflared):

```powershell
ssh -o "ProxyCommand=cloudflared access ssh --hostname %h" admin93@ssh.bfcpos.com
```

## 2. List available backups

Backups are only readable as root:

```bash
sudo ls -la /var/backups/pos-db-backups/
```

Each subdirectory is a timestamp (e.g. `20260207-123000`). Pick one from **before** you deleted the sales (or the most recent if the deletion was very recent).

## 3. Run the restore script

**Option A – Upload and run the script from this repo**

From your **local** machine (in the repo directory):

```powershell
scp -o "ProxyCommand=cloudflared access ssh --hostname %h" scripts/restore-barpos-sales-from-backup.sh admin93@ssh.bfcpos.com:/tmp/
```

Then on the **server** (fix Windows line endings if the file was uploaded from Windows, then run):

```bash
sed -i 's/\r$//' /tmp/restore-barpos-sales-from-backup.sh
sudo bash /tmp/restore-barpos-sales-from-backup.sh
```

The script will list backups and ask which timestamp to use. Confirm when prompted.

**Option B – Restore a specific backup**

```bash
sudo bash /tmp/restore-barpos-sales-from-backup.sh 20260207-123000
```

Replace `20260207-123000` with the backup timestamp you want.

## 4. Restart Bar POS

After restore:

```bash
sudo systemctl restart barpos
```

Then check **bar.bfcpos.com/sales** – all restored sales should appear.

## What gets restored

- **orders** – all sales/orders  
- **order_items** – line items per order  
- **due_payments** – customer payments against dues  
- **due_payment_allocations** – which payments were applied to which orders  

Products, users, branches, and other data are **not** changed; only these sales-related tables are replaced with the backup data.

## If you don’t have the script on the server

You can list and inspect a backup manually:

```bash
# List backups
sudo ls /var/backups/pos-db-backups/

# Decompress and inspect (replace TIMESTAMP)
sudo gunzip -c /var/backups/pos-db-backups/TIMESTAMP/barpos_db.sql.gz | head -500
```

Full restore of only sales tables would require creating a temp database, restoring the dump there, then copying the four tables into `barpos_db` (as in the script). Using the provided script is recommended.
