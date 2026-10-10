import type { Server } from 'node:http';
import { createApp, API_PREFIX } from './app.js';
import { closeDatabase, pingDatabase } from './config/database.js';
import { env, isCloudinaryConfigured } from './config/env.js';
import { logger } from './config/logger.js';
import { closeMailer } from './config/mailer.js';
import { emailDispatcher } from './modules/emails/email-dispatcher.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

async function start(): Promise<void> {
  try {
    await pingDatabase();
    logger.info({ host: env.DB_HOST, database: env.DB_NAME }, 'Database connected');
  } catch (err) {
    logger.fatal({ err }, 'Cannot connect to the database — check the DB_* settings in .env');
    process.exit(1);
  }

  if (!isCloudinaryConfigured) {
    logger.warn('Cloudinary is not configured — photo uploads will return 503.');
  }

  server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}${API_PREFIX} (${env.NODE_ENV})`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    const message =
      err.code === 'EADDRINUSE'
        ? `Port ${env.PORT} is already in use — change PORT in .env`
        : 'HTTP server error';
    logger.fatal({ err }, message);
    process.exit(1);
  });

  await emailDispatcher.resumeUnfinished();
}

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  emailDispatcher.stop();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await closeDatabase().catch((err: unknown) =>
    logger.error({ err }, 'Error closing the database pool'),
  );
  closeMailer();

  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});

void start();
