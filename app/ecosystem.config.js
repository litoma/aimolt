module.exports = {
  apps: [{
    name: 'aimolt',
    script: './src/index.js',
    cwd: '/app',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: process.env.NODE_ENV === 'development' ? ['src'] : false,
    ignore_watch: [
      'node_modules',
      'temp',
      'logs',
      '.git'
    ],
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PM2_SERVE_PATH: '.',
      PM2_SERVE_PORT: 8080
    },
    env_development: {
      NODE_ENV: 'development',
      PM2_SERVE_PATH: '.',
      PM2_SERVE_PORT: 8080
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
    // Health monitoring
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    // Node.js specific options
    node_args: process.env.NODE_ENV === 'development' ? ['--inspect=0.0.0.0:9229'] : [],
    // Docker specific settings
    container_name: 'aimolt-discord-bot'
  }]
};
