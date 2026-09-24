import Fastify from 'fastify';
import { registerMatchStreamModule } from '../match/main/api/match-stream.module';
import { redis } from '../shared/infrastructure/redis/redis-client';

/**
 * Servidor de STREAM: serve o SSE ao vivo (`GET /matches/:id/stream`), mantendo
 * o estado do jogo em memória e alimentado pelo pub/sub do Redis. É separado da
 * ingestão (src/main/server.ts) para escalar de forma independente — este
 * processo segura as conexões SSE; aquele processa as escritas.
 */
function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  registerMatchStreamModule(app);

  return app;
}

async function main(): Promise<void> {
  const app = buildApp();
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.STREAM_PORT) || 3001;

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
