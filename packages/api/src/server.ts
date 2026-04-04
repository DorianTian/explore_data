import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });
import { createDbClient } from '@nl2sql/db';
import { createApp } from './app.js';

const port = Number(process.env.API_PORT) || 3100;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  process.stderr.write(
    JSON.stringify({ level: 'error', msg: 'DATABASE_URL environment variable is required' }) + '\n',
  );
  process.exit(1);
}

const db = createDbClient(databaseUrl);
const app = createApp(db);

const server = app.listen(port, () => {
  app.context.logger.info({ port }, 'NL2SQL API server started');
});

// Graceful shutdown — drain connections on SIGTERM/SIGINT
function shutdown(signal: string) {
  app.context.logger.info({ signal }, 'Shutdown signal received, draining connections...');
  server.close(() => {
    app.context.logger.info('Server closed');
    process.exit(0);
  });
  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    app.context.logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
