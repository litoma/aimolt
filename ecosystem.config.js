module.exports = {
  apps: [
    {
      name: 'aimolt',
      script: './index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
    },
  ],
};
