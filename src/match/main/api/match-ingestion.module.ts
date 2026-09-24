import type { FastifyInstance } from 'fastify';
import { prisma } from '../../../shared/infrastructure/prisma/prisma-client';
import { makeMatchIngestionController } from './factories/match-ingestion-controller.factory';

/**
 * Registra a API de ingestão (comandos de escrita) na instância do Fastify.
 * Usa apenas o Postgres; a publicação dos eventos fica a cargo do relay do outbox.
 */
export function registerMatchIngestionModule(app: FastifyInstance): void {
  makeMatchIngestionController({ prisma }).registerRoutes(app);
}
