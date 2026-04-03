import { createDbClient } from '@nl2sql/db';
import { createApp } from './app.js';

const port = Number(process.env.API_PORT) || 3100;
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://tianqiyin:@localhost:5432/nl2sql';

const db = createDbClient(databaseUrl);
const app = createApp(db);

app.listen(port, () => {
  app.context.logger.info({ port }, 'NL2SQL API server started');
});
