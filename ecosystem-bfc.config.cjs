// PM2 ecosystem configuration for BFC POS System
// This file manages the Node.js application process

module.exports = {
  apps: [{
    name: 'bfcpos-app',
    script: 'dist/index.js',
    interpreter: 'node',
    instances: 1,
    exec_mode: 'cluster',
    
    // Environment variables loaded via systemd EnvironmentFile
    // See bfcpos.service for environment configuration
    env_production: {
      NODE_ENV: 'production',
      PORT: 7050,
    },
    
    // Restart policy
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Logging
    error_file: '/var/log/bfcpos/error.log',
    out_file: '/var/log/bfcpos/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart delay
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 10000,
  }]
};

