import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

// Coffeehouse database connection
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://coffeehouse_user:CoffeehousePOS2024!Secure@localhost:5432/coffeehouse_db";

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Helper function to parse price
function parsePrice(priceStr) {
  if (!priceStr || priceStr.trim() === "") {
    return null;
  }
  const cleaned = priceStr.toString().replace(/[$,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed.toFixed(2);
}

async function importProducts() {
  console.log("🚀 Starting Coffeehouse product import...");
  console.log(`📊 Connecting to database: ${DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`);

  const client = await pool.connect();

  try {
    // Read CSV file
    const csvPath = join(process.cwd(), "coffeehouse-products.csv");
    if (!existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    console.log(`📖 Reading CSV file: ${csvPath}`);
    const fileContent = readFileSync(csvPath, "utf-8");
    
    // Parse CSV
    const lines = fileContent.split("\n").filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }
    
    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split(",").map(h => h.trim());
    console.log("📋 CSV Headers:", headers);
    
    // Parse records
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = [];
      let current = "";
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || "";
      });
      records.push(record);
    }

    console.log(`📋 Found ${records.length} rows in CSV`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process each record
    for (const record of records) {
      try {
        const menuName = record["Menu Name "] || record["Menu Name"] || "";
        if (!menuName.trim()) continue;

        const productName = menuName.trim();
        const categoryName = (record["Category"] || "").trim() || "Uncategorized";
        const finalPrice = parsePrice(record["Final Price "] || record["Final Price"]);
        const sizeS = parsePrice(record["Size - S"] || record["Size-S"]);
        const sizeM = parsePrice(record["Size-M "] || record["Size-M"]);
        const imageUrl = (record["Image"] || "").trim() || null;

        if (!finalPrice && !sizeS && !sizeM) {
          console.log(`⚠️  Skipping "${productName}" - no valid price`);
          skipped++;
          continue;
        }

        // Get or create category
        const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        let categoryResult = await client.query(
          'SELECT id FROM categories WHERE slug = $1',
          [categorySlug]
        );
        
        let categoryId;
        if (categoryResult.rows.length > 0) {
          categoryId = categoryResult.rows[0].id;
        } else {
          const insertResult = await client.query(
            'INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id',
            [categoryName.trim(), categorySlug]
          );
          categoryId = insertResult.rows[0].id;
        }

        // Check if product exists
        const existing = await client.query(
          'SELECT id FROM products WHERE name = $1',
          [productName]
        );
        
        if (existing.rows.length > 0) {
          console.log(`⏭️  Skipping "${productName}" - already exists`);
          skipped++;
          continue;
        }

        // Determine price and size prices
        let basePrice = finalPrice || sizeS || sizeM || "0.00";
        let sizePrices = null;
        
        if (sizeS && sizeM) {
          basePrice = sizeS;
          sizePrices = JSON.stringify({ S: sizeS, M: sizeM });
        } else if (sizeS) {
          basePrice = sizeS;
          sizePrices = JSON.stringify({ S: sizeS });
        } else if (sizeM) {
          basePrice = sizeM;
          sizePrices = JSON.stringify({ M: sizeM });
        }

        // Insert product
        const productResult = await client.query(
          `INSERT INTO products (name, price, category_id, unit, image_url, quantity, size_prices)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING id`,
          [productName, basePrice, categoryId, "cup", imageUrl, "0", sizePrices]
        );
        
        const productId = productResult.rows[0].id;
        
        // Set barcode to product ID
        await client.query('UPDATE products SET barcode = $1 WHERE id = $1', [productId]);

        console.log(`✅ Imported: "${productName}" (${categoryName}) - $${basePrice}${sizePrices ? ` [Sizes: ${Object.keys(JSON.parse(sizePrices)).join(", ")}]` : ""}`);
        imported++;
      } catch (error) {
        console.error(`❌ Error importing "${record["Menu Name "] || "unknown"}":`, error.message);
        errors++;
      }
    }

    console.log("\n📊 Import Summary:");
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log("\n🎉 Import completed!");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importProducts().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
