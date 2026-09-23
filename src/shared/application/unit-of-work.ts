/**
 * Unidade de trabalho: executa um bloco de forma atômica. Se `work` resolver,
 * a transação é confirmada (COMMIT); se lançar, é desfeita (ROLLBACK).
 */
export interface UnitOfWork {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
