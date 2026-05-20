import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixAdminPasswords() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing admin user passwords...\n');
    
    // Detect which POS instance this is
    const port = parseInt(process.env.PORT || '0');
    const databaseUrl = process.env.DATABASE_URL || '';
    
    let adminUsername, adminPassword;
    
    if (port === 7000 || databaseUrl.includes('bfcpos_db')) {
      adminUsername = 'admin@bfcpos.com';
      adminPassword = 'Admin@2024';
      console.log('📍 Detected BFC POS instance');
    } else if (port === 8000 || databaseUrl.includes('bondcoffeepos_db')) {
      adminUsername = 'admin@bondcoffeepos.com';
      adminPassword = 'Admin@2024';
      console.log('📍 Detected Bond Coffee POS instance');
    } else {
      console.error('❌ Could not detect POS instance. Please set PORT or DATABASE_URL.');
      process.exit(1);
    }
    
    // Check if admin user exists
    const result = await client.query(
      'SELECT id, username FROM users WHERE username = $1',
      [adminUsername]
    );
    
    if (result.rows.length === 0) {
      console.log(`⚠️  Admin user '${adminUsername}' does not exist. Run migration first.`);
      process.exit(1);
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await client.query(
      'UPDATE users SET password = $1 WHERE username = $2',
      [hashedPassword, adminUsername]
    );
    
    console.log(`✅ Updated password for admin user: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('\n🎉 Password fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing admin passwords:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAdminPasswords().catch(console.error);

