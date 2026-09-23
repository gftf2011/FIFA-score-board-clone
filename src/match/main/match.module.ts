import type { FastifyInstance } from 'fastify';
import { snsClient } from '../../shared/infrastructure/aws/sns-client.js';
import { prisma } from '../../shared/infrastructure/prisma/prisma-client.js';
import { loadMatchModuleConfig } from './config.js';
import { makeMatchController } from './factories/match-controller.factory.js';

/**
 * Monta o módulo de partida com os recursos compartilhados (Prisma, SNS) e
 * registra suas rotas na instância do Fastify.
 */
export function registerMatchModule(app: FastifyInstance): void {
  const config = loadMatchModuleConfig();
  const controller = makeMatchController({
    prisma,
    snsClient,
    snsTopicArn: config.snsTopicArn,
  });

  controller.registerRoutes(app);
}
