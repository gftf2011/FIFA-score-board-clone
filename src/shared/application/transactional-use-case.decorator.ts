import type { UnitOfWork } from './unit-of-work';
import type { UseCase } from './use-case';

/**
 * Decorator que envolve um caso de uso numa {@link UnitOfWork}, garantindo
 * atomicidade: toda a execução roda dentro de uma transação — COMMIT se
 * concluir com sucesso, ROLLBACK se qualquer operação lançar.
 */
export class TransactionalUseCase<Input, Output> implements UseCase<Input, Output> {
  constructor(
    private readonly useCase: UseCase<Input, Output>,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(input: Input): Promise<Output> {
    return this.unitOfWork.runInTransaction(() => this.useCase.execute(input));
  }
}
