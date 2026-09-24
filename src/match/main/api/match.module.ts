import type { FastifyInstance } from 'fastify';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client';
import { makeMatchController } from './factories/match-controller.factory';

/**
 * Monta a API de partida com os recursos compartilhados (Prisma) e registra
 * suas rotas na instância do Fastify. Os eventos são gravados na outbox pela
 * própria transação; a publicação no SNS fica a cargo do relay do outbox.
 */
export function registerMatchModule(app: FastifyInstance): void {
  const controller = makeMatchController({ prisma });

  controller.registerRoutes(app);
}
