module.exports = {
  apps: [
    {
      name: "viralsnipai-web",
      cwd: __dirname,
      script: "pnpm",
      args: "--filter web start",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1536M",
      kill_timeout: 30000,
      listen_timeout: 30000,
      autorestart: true,
      env_production: {
        NODE_ENV: "production",
        WEB_CONCURRENCY: "1",
      },
    },
  ],
};
