module.exports = {
  apps: [{
    name: 'aimolt',
    script: './src/index.js',
    cwd: '/home/ubuntu/discord/app',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
