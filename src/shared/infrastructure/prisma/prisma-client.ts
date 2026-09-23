import { PrismaClient } from '@prisma/client';

/**
 * Instância compartilhada do PrismaClient (recurso caro; deve ser único por
 * processo). Injete-a nos repositórios via construtor.
 */
export const prisma = new PrismaClient();
