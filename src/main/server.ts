import Fastify from 'fastify';
import { registerMatchModule } from '../match/main/match.module.js';

function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  registerMatchModule(app);

  return app;
}

async function main(): Promise<void> {
  const app = buildApp();
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT) || 3000;

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
