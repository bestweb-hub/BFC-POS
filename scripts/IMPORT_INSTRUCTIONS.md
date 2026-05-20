# Coffeehouse Product Import - Server Instructions

## Files Uploaded
✅ CSV file: `/tmp/coffeehouse-products.csv`
✅ Import script: `/tmp/import-coffeehouse-products.js`

## Steps to Run on Server

### 1. SSH into the server:
```bash
ssh admin93@192.168.1.2
```

### 2. Move files to coffeehouse directory:
```bash
sudo mv /tmp/coffeehouse-products.csv /var/www/coffeehouse/
sudo mv /tmp/import-coffeehouse-products.js /var/www/coffeehouse/
sudo chown nodejs:nodejs /var/www/coffeehouse/coffeehouse-products.csv
sudo chown nodejs:nodejs /var/www/coffeehouse/import-coffeehouse-products.js
```

### 3. Copy the shared schema (needed for the script):
```bash
# The script needs the schema, so we'll copy it from the coffeehouse app
# The coffeehouse app already has the schema in its shared folder
cd /var/www/coffeehouse
```

### 4. Update the script to use the correct schema path:
The script should work since coffeehouse has the same structure. If it doesn't, we may need to adjust the import path.

### 5. Run the import:
```bash
cd /var/www/coffeehouse
sudo -u nodejs bash -c "source .env.production && node import-coffeehouse-products.js"
```

## Alternative: Run via SSH command

You can also run it directly from your local machine:

```bash
ssh admin93@192.168.1.2 "cd /var/www/coffeehouse && sudo -u nodejs bash -c 'source .env.production && node import-coffeehouse-products.js'"
```

## Expected Output

The script will:
- Show progress for each product imported
- Show summary: imported, skipped, errors
- Create categories automatically
- Import products with size-based pricing where applicable
