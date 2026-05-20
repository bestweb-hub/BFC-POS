// Script to fix existing orders with paymentStatus='due' that don't have a customerId
// Run this script to link existing due orders to customers

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env files manually
function loadEnvFile(filePath) {
  try {
    const envFile = readFileSync(filePath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } catch (error) {
    // File doesn't exist, ignore
  }
}

loadEnvFile(join(__dirname, '..', '.env'));
loadEnvFile(join(__dirname, '..', '.env.production'));

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL must be set. Did you forget to provision a database?');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixDueOrdersWithoutCustomers() {
  console.log('🔍 Finding orders with paymentStatus="due" but no customerId...');
  
  // Find all due orders without customerId
  const result = await pool.query(`
    SELECT id, order_number, customer_name, customer_phone, branch_id, total, payment_status
    FROM orders
    WHERE payment_status = 'due' AND customer_id IS NULL
  `);
  
  const dueOrdersWithoutCustomer = result.rows;
  console.log(`Found ${dueOrdersWithoutCustomer.length} orders to fix.`);
  
  if (dueOrdersWithoutCustomer.length === 0) {
    console.log('✅ No orders need fixing!');
    await pool.end();
    return;
  }
  
  for (const order of dueOrdersWithoutCustomer) {
    const customerName = order.customer_name || 'Walk-in Customer';
    
    // Try to find existing customer by name
    const customerResult = await pool.query(
      'SELECT id FROM customers WHERE name = $1 LIMIT 1',
      [customerName]
    );
    
    let customerId;
    
    if (customerResult.rows.length > 0) {
      customerId = customerResult.rows[0].id;
      console.log(`  ✓ Found existing customer: ${customerName} (${customerId})`);
    } else {
      // Create new customer
      const insertResult = await pool.query(
        `INSERT INTO customers (name, phone, email, branch_id, notes)
         VALUES ($1, $2, NULL, $3, NULL)
         RETURNING id`,
        [customerName, order.customer_phone || null, order.branch_id || null]
      );
      customerId = insertResult.rows[0].id;
      console.log(`  ✓ Created new customer: ${customerName} (${customerId})`);
    }
    
    // Update the order with customerId and dueAmount
    await pool.query(
      `UPDATE orders 
       SET customer_id = $1, due_amount = $2, paid_amount = '0'
       WHERE id = $3`,
      [customerId, order.total, order.id]
    );
    
    console.log(`  ✓ Updated order ${order.order_number} (${order.id}) with customerId`);
  }
  
  console.log(`\n✅ Fixed ${dueOrdersWithoutCustomer.length} orders!`);
  await pool.end();
}

// Run the script
fixDueOrdersWithoutCustomers()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running script:', error);
    process.exit(1);
  });

