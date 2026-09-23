import type { FastifyInstance } from 'fastify';
import { snsClient } from '../../../shared/infrastructure/aws/sns-client';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client';
import { loadMatchModuleConfig } from './config';
import { makeMatchController } from './factories/match-controller.factory';

/**
 * Monta a API de partida com os recursos compartilhados (Prisma, SNS) e
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
