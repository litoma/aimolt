module.exports = {
  apps: [{
    name: 'aimolt',
    script: './dist/main.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
    time: true
  }]
};
