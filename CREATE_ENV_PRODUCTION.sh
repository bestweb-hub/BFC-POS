#!/bin/bash
# Script to create .env.production files for both POS instances on the server
# Run this on the server after creating databases

set -e

echo "Creating .env.production files for BFC and Bond Coffee POS..."

# Generate secure session secrets
SESSION_SECRET_BFC=$(openssl rand -base64 32)
SESSION_SECRET_BONDCOFFEE=$(openssl rand -base64 32)

# Create BFC POS .env.production
sudo tee /var/www/bfcpos/.env.production > /dev/null <<EOF
# BFC POS System - Production Environment Variables
DATABASE_URL=postgresql://bfcpos_user:BfcPOS2024!Secure@localhost:5432/bfcpos_db
SESSION_SECRET=$SESSION_SECRET_BFC
PORT=7000
NODE_ENV=production
EOF

# Create Bond Coffee POS .env.production
sudo tee /var/www/bondcoffeepos/.env.production > /dev/null <<EOF
# Bond Coffee POS System - Production Environment Variables
DATABASE_URL=postgresql://bondcoffeepos_user:BondCoffeePOS2024!Secure@localhost:5432/bondcoffeepos_db
SESSION_SECRET=$SESSION_SECRET_BONDCOFFEE
PORT=8000
NODE_ENV=production
EOF

# Set correct ownership and permissions
sudo chown nodejs:nodejs /var/www/bfcpos/.env.production /var/www/bondcoffeepos/.env.production
sudo chmod 600 /var/www/bfcpos/.env.production /var/www/bondcoffeepos/.env.production

echo "✓ .env.production files created successfully!"
echo ""
echo "BFC POS .env.production location: /var/www/bfcpos/.env.production"
echo "Bond Coffee POS .env.production location: /var/www/bondcoffeepos/.env.production"
echo ""
echo "⚠️  Remember to change the database passwords if you used different ones!"

