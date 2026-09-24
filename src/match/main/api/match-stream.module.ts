import type { FastifyInstance } from 'fastify';
import { redis } from '../../../shared/infrastructure/redis/redis-client';
import { makeMatchStreamController } from './factories/match-stream-controller.factory';

/**
 * Registra a API de stream (SSE) na instância do Fastify. Usa apenas o Redis
 * (pub/sub para os eventos ao vivo e a projeção para o snapshot).
 */
export function registerMatchStreamModule(app: FastifyInstance): void {
  makeMatchStreamController({ redis }).registerRoutes(app);
}
