# Coffeehouse Product Import Script

This script imports products from the CSV file into the coffeehouse.bfcpos.com database.

## Prerequisites

1. The CSV file must be in the `LocalPOS-new` directory
2. Node.js must be installed
3. Database connection must be accessible

## Running the Import

### Option 1: Run Locally (if you have access to the coffeehouse database)

```bash
cd /d/payment-gateway/asthacash/LocalPOS-new
export DATABASE_URL="postgresql://coffeehouse_user:CoffeehousePOS2024!Secure@192.168.1.2:5432/coffeehouse_db"
npm run import:coffeehouse
```

### Option 2: Run on Server (Recommended)

1. **Copy the CSV file and script to the server:**
   ```bash
   scp "Coffee House and BFC Fast Food menus Price -2026 - Final For Coffee House.csv" admin93@192.168.1.2:/var/www/coffeehouse/
   scp scripts/import-coffeehouse-products.js admin93@192.168.1.2:/var/www/coffeehouse/
   ```

2. **SSH into the server:**
   ```bash
   ssh admin93@192.168.1.2
   ```

3. **Navigate to coffeehouse directory:**
   ```bash
   cd /var/www/coffeehouse
   ```

4. **Run the import script:**
   ```bash
   sudo -u nodejs bash -c "source .env.production && node import-coffeehouse-products.js"
   ```

## What the Script Does

1. **Reads the CSV file** and parses product data
2. **Creates categories** automatically if they don't exist:
   - Hot Drinks
   - Cold Drinks
   - Frappe
   - Smoothies
   - Milkshake
   - Soft Drinks & Fresh Juice
   - Hot Tea
   - Hot - MasalaTea
3. **Creates products** with:
   - Name from "Menu Name" column
   - Category from "Category" column
   - Base price from "Final Price" or "Size - S"
   - Size-based pricing (S and M sizes) where applicable
   - Unit set to "cup" (for drinks)
   - Default quantity of 0
4. **Skips duplicates** - won't import products that already exist
5. **Generates barcodes** automatically using product ID

## CSV Format Expected

- **Menu Name**: Product name
- **Category**: Product category
- **Final Price**: Base price (with $ sign)
- **Size - S**: Small size price (optional)
- **Size-M**: Medium size price (optional)
- **Image**: Image URL (optional)

## Size-Based Pricing

If a product has both S and M sizes, the script will:
- Set base price to S size
- Enable size-based pricing with both S and M options
- Products can then be sold with size selection on the POS page

## Notes

- Empty rows are automatically skipped
- Products with no valid price are skipped
- The script will show a summary of imported, skipped, and error counts
