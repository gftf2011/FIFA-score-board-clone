import type { PrismaClient } from '@prisma/client';
import type { UnitOfWork } from '../../application/unit-of-work.js';
import { runInTransactionContext } from './transaction-context.js';

/**
 * Implementação da {@link UnitOfWork} sobre uma transação interativa do Prisma.
 * Abre `$transaction` e disponibiliza o `tx` como transação ambiente para que
 * os repositórios participem da mesma transação. O Prisma faz COMMIT se o bloco
 * resolver e ROLLBACK se lançar.
 */
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => runInTransactionContext(tx, work));
  }
}
