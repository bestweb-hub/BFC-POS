import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Coffeehouse database connection
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://coffeehouse_user:CoffeehousePOS2024!Secure@localhost:5432/coffeehouse_db";

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Import schema - try multiple locations
let schema;
const schemaPaths = [
  "./shared/schema.js",
  "../shared/schema.js",
  join(process.cwd(), "shared", "schema.js"),
];

for (const schemaPath of schemaPaths) {
  try {
    schema = await import(schemaPath);
    console.log(`✅ Loaded schema from: ${schemaPath}`);
    break;
  } catch (e) {
    // Continue to next path
  }
}

if (!schema) {
  console.error("❌ Could not load schema. Tried:");
  schemaPaths.forEach(path => console.error(`   - ${path}`));
  throw new Error("Schema file not found. Make sure you're running from the coffeehouse directory.");
}

const db = drizzle({ client: pool, schema: schema.default || schema });

// Helper function to create or get category
async function getOrCreateCategory(categoryName) {
  if (!categoryName || !categoryName.trim()) {
    return null;
  }

  const categories = (schema.default || schema).categories;
  const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Check if category exists
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new category
  const result = await db
    .insert(categories)
    .values({
      name: categoryName.trim(),
      slug: slug,
    })
    .returning();

  return result[0];
}

// Helper function to parse price
function parsePrice(priceStr) {
  if (!priceStr || priceStr.trim() === "") {
    return null;
  }
  // Remove $ and commas, then parse
  const cleaned = priceStr.toString().replace(/[$,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed.toFixed(2);
}

async function importProducts() {
  console.log("🚀 Starting Coffeehouse product import...");
  console.log(`📊 Connecting to database: ${DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`);

  try {
    // Read and parse CSV file - try multiple possible locations
    const possiblePaths = [
      join(process.cwd(), "coffeehouse-products.csv"),
      join(__dirname, "..", "Coffee House and BFC Fast Food menus Price -2026 - Final For Coffee House.csv"),
      join(process.cwd(), "Coffee House and BFC Fast Food menus Price -2026 - Final For Coffee House.csv"),
    ];
    
    let csvPath = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        csvPath = path;
        break;
      }
    }
    
    if (!csvPath) {
      throw new Error(`CSV file not found. Tried: ${possiblePaths.join(", ")}\nPlease ensure the CSV file is in the coffeehouse directory.`);
    }
    
    console.log(`📖 Reading CSV file: ${csvPath}`);
    
    const fileContent = readFileSync(csvPath, "utf-8");
    
    // Simple CSV parser
    const lines = fileContent.split("\n").filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }
    
    // Parse header - handle CSV with potential quoted fields
    const headerLine = lines[0];
    const headerValues = [];
    let currentHeader = "";
    let inQuotes = false;
    
    for (let j = 0; j < headerLine.length; j++) {
      const char = headerLine[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        headerValues.push(currentHeader.trim());
        currentHeader = "";
      } else {
        currentHeader += char;
      }
    }
    headerValues.push(currentHeader.trim()); // Add last header
    
    const headers = headerValues;
    console.log("📋 CSV Headers:", headers);
    
    // Parse records
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Simple CSV parsing (handles quoted fields)
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
      values.push(current.trim()); // Add last value
      
      // Create record object
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

    const products = (schema.default || schema).products;

    // Process each record
    for (const record of records) {
      try {
        // Skip empty rows - check all possible header variations
        const menuName = record["Menu Name "] || record["Menu Name"] || record["MenuName"] || "";
        if (!menuName.trim()) {
          continue;
        }

        const productName = menuName.trim();
        const categoryName = (record["Category"] || "").trim() || "Uncategorized";
        const finalPrice = parsePrice(record["Final Price "] || record["Final Price"] || record["FinalPrice"]);
        const sizeS = parsePrice(record["Size - S"] || record["Size-S"] || record["Size S"]);
        const sizeM = parsePrice(record["Size-M "] || record["Size-M"] || record["Size M"]);
        const imageUrl = (record["Image"] || "").trim() || null;

        // Skip if no valid price
        if (!finalPrice && !sizeS && !sizeM) {
          console.log(`⚠️  Skipping "${productName}" - no valid price found`);
          skipped++;
          continue;
        }

        // Get or create category
        const category = await getOrCreateCategory(categoryName);
        if (!category) {
          console.log(`⚠️  Skipping "${productName}" - could not create category`);
          skipped++;
          continue;
        }

        // Check if product already exists
        const existing = await db
          .select()
          .from(products)
          .where(eq(products.name, productName))
          .limit(1);

        if (existing.length > 0) {
          console.log(`⏭️  Skipping "${productName}" - already exists`);
          skipped++;
          continue;
        }

        // Determine base price and size prices
        // If we have both S and M sizes, use S as base and create size prices
        // If we only have final price, use that as base
        let basePrice;
        let sizePrices = null;

        if (sizeS && sizeM) {
          // Both sizes available - use S as base, M as size price
          basePrice = sizeS;
          sizePrices = { S: sizeS, M: sizeM };
        } else if (sizeS) {
          // Only S size
          basePrice = sizeS;
          sizePrices = { S: sizeS };
        } else if (sizeM) {
          // Only M size
          basePrice = sizeM;
          sizePrices = { M: sizeM };
        } else if (finalPrice) {
          // Use final price as base (no size pricing)
          basePrice = finalPrice;
        } else {
          // Fallback
          basePrice = "0.00";
        }

        // Create product
        const productData = {
          name: productName,
          price: basePrice,
          categoryId: category.id,
          unit: "cup", // Coffeehouse products are typically drinks
          imageUrl: imageUrl,
          quantity: "0", // Default quantity
          sizePrices: sizePrices,
        };

        const result = await db
          .insert(products)
          .values(productData)
          .returning();

        // Set barcode to product ID
        await db
          .update(products)
          .set({ barcode: result[0].id })
          .where(eq(products.id, result[0].id));

        console.log(`✅ Imported: "${productName}" (${categoryName}) - $${basePrice}${sizePrices ? ` [Sizes: ${Object.keys(sizePrices).join(", ")}]` : ""}`);
        imported++;
      } catch (error) {
        const errorRecordName = record["Menu Name "] || record["Menu Name"] || record["MenuName"] || "unknown";
        console.error(`❌ Error importing "${errorRecordName}":`, error.message);
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
    await pool.end();
  }
}

// Run import
importProducts().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
