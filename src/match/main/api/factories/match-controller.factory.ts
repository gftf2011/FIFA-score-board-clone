import type { PrismaClient } from '@prisma/client';
import { TransactionalUseCase } from '../../../../shared/application/transactional-use-case.decorator';
import type { UseCase } from '../../../../shared/application/use-case';
import { PrismaUnitOfWork } from '../../../../shared/infrastructure/prisma/prisma-unit-of-work';
import { FinishMatchUseCase } from '../../../application/use-cases/finish-match.use-case';
import { RegisterMatchEventUseCase } from '../../../application/use-cases/register-match-event.use-case';
import { StartMatchUseCase } from '../../../application/use-cases/start-match.use-case';
import { OutboxMatchEventPublisher } from '../../../infrastructure/publishers/outbox-match-event.publisher';
import { PrismaMatchRepository } from '../../../infrastructure/repositories/prisma-match.repository';
import { PrismaOutboxRepository } from '../../../infrastructure/repositories/prisma-outbox.repository';
import { MatchController } from '../../../presentation/http/match.controller';

/** Dependências externas necessárias para montar a API de partida. */
export interface MatchControllerDeps {
  readonly prisma: PrismaClient;
}

/**
 * Composition root da API de partida: instancia o repositório (Prisma) e o
 * publisher de outbox, injeta nos casos de uso e monta o controller HTTP. Os
 * casos de uso gravam o evento na tabela de outbox dentro da MESMA transação
 * que persiste a partida; o relay (src/main/outbox-relay.ts) publica no SNS.
 */
export function makeMatchController(deps: MatchControllerDeps): MatchController {
  const repository = new PrismaMatchRepository(deps.prisma);
  const publisher = new OutboxMatchEventPublisher(new PrismaOutboxRepository(deps.prisma));
  const unitOfWork = new PrismaUnitOfWork(deps.prisma);

  // Cada caso de uso roda dentro de uma UnitOfWork (COMMIT/ROLLBACK atômico).
  const transactional = <Input>(useCase: UseCase<Input, void>): UseCase<Input, void> =>
    new TransactionalUseCase(useCase, unitOfWork);

  return new MatchController(
    transactional(new StartMatchUseCase(repository, publisher)),
    transactional(new FinishMatchUseCase(repository, publisher)),
    transactional(new RegisterMatchEventUseCase(repository, publisher)),
  );
}
