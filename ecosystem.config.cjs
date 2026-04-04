// PM2 ecosystem config — nl2sql (data.askdorian.com)
// Deploy: pm2 startOrRestart ecosystem.config.cjs --env production
module.exports = {
  apps: [
    {
      name: "nl2sql-api",
      script: "packages/api/dist/server.js",
      cwd: "/opt/aix-ops-hub/nl2sql",
      instances: 1,
      exec_mode: "fork",
      node_args: "--enable-source-maps",
      env_production: {
        NODE_ENV: "production",
        API_PORT: 3100,
        NODE_EXTRA_CA_CERTS: "/certs/global-bundle.pem",
      },
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,
      // Auto-restart
      max_restarts: 10,
      min_uptime: 5000,
      max_memory_restart: "512M",
      // Logging
      error_file: "/opt/aix-ops-hub/logs/nl2sql-api-error.log",
      out_file: "/opt/aix-ops-hub/logs/nl2sql-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
    {
      name: "nl2sql-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      cwd: "/opt/aix-ops-hub/nl2sql/packages/web",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://data.askdorian.com",
      },
      // Graceful shutdown
      kill_timeout: 8000,
      listen_timeout: 10000,
      // Auto-restart
      max_restarts: 10,
      min_uptime: 5000,
      max_memory_restart: "384M",
      // Logging
      error_file: "/opt/aix-ops-hub/logs/nl2sql-web-error.log",
      out_file: "/opt/aix-ops-hub/logs/nl2sql-web-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
