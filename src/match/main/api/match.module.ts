import type { FastifyInstance } from 'fastify';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client';
import { redis } from '../../../shared/infrastructure/redis/redis-client';
import { makeMatchController } from './factories/match-controller.factory';

/**
 * Monta a API de partida com os recursos compartilhados (Prisma, Redis) e
 * registra suas rotas na instância do Fastify. Os eventos são gravados na outbox
 * pela própria transação; a publicação no SNS fica a cargo do relay do outbox. O
 * Redis alimenta o stream SSE (`/matches/:id/stream`) via pub/sub.
 */
export function registerMatchModule(app: FastifyInstance): void {
  const controller = makeMatchController({ prisma, redis });

  controller.registerRoutes(app);
}
