/**
 * BUSIFY server entry point: validates configuration and the database,
 * then serves the REST API (and the built web app) over HTTP or HTTPS.
 */
import http from 'node:http';
import https from 'node:https';

async function main() {
  // Imported dynamically so configuration errors can be reported nicely.
  const { env, loadedEnvFile } = await import('./config/env').catch((err) => {
    if (err?.name === 'ConfigError') {
      console.error(`\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  });
  const { logger } = await import('./lib/logger');
  const { prisma } = await import('./lib/prisma');
  const { checkDatabase, StartupError } = await import('./lib/startup');
  const { createApp, CLIENT_DIST } = await import('./app');
  const { lanIPv4Addresses } = await import('./lib/network');
  const { purgeExpiredSessions } = await import('./lib/sessions');
  const { existsSync } = await import('node:fs');
  const path = await import('node:path');

  logger.info(`Configuration loaded from ${loadedEnvFile ?? 'environment variables only'}`);

  try {
    const { file } = await checkDatabase();
    logger.info(`Database ready: ${file}`);
  } catch (err) {
    if (err instanceof StartupError) {
      logger.error(err.message);
      await prisma.$disconnect();
      process.exit(1);
    }
    throw err;
  }

  await purgeExpiredSessions();
  const purgeTimer = setInterval(() => void purgeExpiredSessions().catch(() => undefined), 3600_000);
  purgeTimer.unref();

  const app = createApp();
  let server: http.Server | https.Server;
  if (env.HTTPS_ENABLED) {
    const { loadTlsCredentials } = await import('./lib/tls');
    server = https.createServer(loadTlsCredentials(), app);
  } else {
    server = http.createServer(app);
  }

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${env.PORT} is already in use. Stop the other program or change PORT in .env.`);
    } else if (err.code === 'EADDRNOTAVAIL') {
      logger.error(`HOST=${env.HOST} is not an address of this computer. Run \`npm run lan-info\` to list valid ones.`);
    } else {
      logger.error('Server failed to start', err);
    }
    process.exit(1);
  });

  server.listen(env.PORT, env.HOST, () => {
    const scheme = env.HTTPS_ENABLED ? 'https' : 'http';
    const hasClient = existsSync(path.join(CLIENT_DIST, 'index.html'));
    logger.info(`BUSIFY server listening on ${scheme}://${env.HOST}:${env.PORT}`);
    logger.info(`  This computer:  ${scheme}://localhost:${env.PORT}${hasClient ? '' : '/api/health'}`);
    if (env.HOST === '0.0.0.0' || env.HOST === '::') {
      for (const { name, address } of lanIPv4Addresses()) {
        logger.info(`  On your Wi-Fi:  ${scheme}://${address}:${env.PORT}   (${name})`);
      }
      if (!env.HTTPS_ENABLED) {
        logger.warn('  Phones need HTTPS for GPS. Set HTTPS_ENABLED=true in .env to test real location over Wi-Fi.');
      }
    } else if (env.HOST === '127.0.0.1' || env.HOST === 'localhost') {
      logger.info('  Only this computer can connect (HOST=127.0.0.1). Use `npm run lan` to allow phones on your Wi-Fi.');
    }
    if (!hasClient) logger.info('  Web app not built: use `npm run dev` (port 5173) or `npm run build`.');
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down…`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('BUSIFY failed to start:', err);
  process.exit(1);
});
