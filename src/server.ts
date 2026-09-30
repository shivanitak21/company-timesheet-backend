import { env } from './config/env';
import { connectDb, disconnectDb } from './config/db';
import { app } from './app';
import { logger } from './utils/logger';

async function main() {
  await connectDb();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server started');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutdown started');
    server.close(() => {
      disconnectDb()
        .catch((error: unknown) => logger.error({ err: error }, 'disconnect failed'))
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'server failed to start');
  process.exit(1);
});
