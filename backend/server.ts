import 'dotenv/config';
import path from 'node:path';
import { closeDatabasePool } from '../database/index.ts';
import { ensureSeeded } from '../database/seeds/seed.ts';
import { createApp } from './src/app.ts';
import { IS_STANDALONE_API, SERVER_PORT } from './src/config/env.ts';
import { startStreamMonitorCron, stopStreamMonitorCron } from './src/services/hlsMonitor.ts';

async function bootstrap() {
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled promise rejection:', reason);
  });

  const app = await createApp();
  const port = SERVER_PORT;

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(
      `VEXORA ${IS_STANDALONE_API ? 'Standalone Backend API' : 'Full-Stack Server'} running on http://0.0.0.0:${port}`
    );
    startStreamMonitorCron();
    ensureSeeded().catch((err) => {
      console.error('[Startup] Initial seed check deferred:', err);
    });
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the conflicting process or change PORT.`);
    } else {
      console.error('Server listen error:', err);
    }
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down VEXORA server cleanly...`);
    stopStreamMonitorCron();
    server.close(async () => {
      await closeDatabasePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const isMain =
  process.argv[1] &&
  path.basename(process.argv[1]).startsWith('server.');

if (isMain) {
  bootstrap().catch((err) => {
    console.error('Failed to start VEXORA backend server:', err);
    process.exit(1);
  });
}
