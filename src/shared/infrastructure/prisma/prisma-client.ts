import { PrismaClient } from '@prisma/client';

/**
 * Instância única (singleton) do PrismaClient. O client mantém um pool interno
 * de conexões, então uma única instância é reaproveitada por todas as chamadas
 * — nenhuma requisição abre uma conexão nova.
 *
 * A instância é guardada em `globalThis` para sobreviver aos hot-reloads em
 * desenvolvimento (ex.: `tsx watch`), evitando que cada recarga crie um novo
 * client e esgote as conexões do banco. Em produção, o cache de módulos do Node
 * já garante a instância única.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
