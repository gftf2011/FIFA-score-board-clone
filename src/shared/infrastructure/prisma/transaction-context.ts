import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

/**
 * Propaga a transação Prisma em curso de forma ambiente (sem passá-la
 * explicitamente pelas assinaturas). Os repositórios consultam
 * {@link getTransactionClient} para reaproveitar a transação da UnitOfWork.
 */
const storage = new AsyncLocalStorage<Prisma.TransactionClient>();

/** Executa `work` com `tx` disponível como transação ambiente. */
export function runInTransactionContext<T>(
  tx: Prisma.TransactionClient,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(tx, work);
}

/** Transação ambiente atual, ou `undefined` se não houver. */
export function getTransactionClient(): Prisma.TransactionClient | undefined {
  return storage.getStore();
}
