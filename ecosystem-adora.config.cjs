// PM2 ecosystem configuration for Adora POS System
module.exports = {
  apps: [{
    name: 'adorapos-app',
    script: 'dist/index.js',
    interpreter: 'node',
    instances: 1,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 7060,
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/adorapos/error.log',
    out_file: '/var/log/adorapos/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 10000,
  }]
};
