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
import { MatchIngestionController } from '../../../presentation/http/match-ingestion.controller';

/** Dependências da API de ingestão. */
export interface MatchIngestionControllerDeps {
  readonly prisma: PrismaClient;
}

/**
 * Composition root da ingestão: repositório (Prisma) + publisher de outbox nos
 * casos de uso de escrita, cada um dentro de uma UnitOfWork. O evento é gravado
 * no outbox na MESMA transação que persiste a partida; o relay publica no SNS.
 */
export function makeMatchIngestionController(
  deps: MatchIngestionControllerDeps,
): MatchIngestionController {
  const repository = new PrismaMatchRepository(deps.prisma);
  const publisher = new OutboxMatchEventPublisher(new PrismaOutboxRepository(deps.prisma));
  const unitOfWork = new PrismaUnitOfWork(deps.prisma);

  const transactional = <Input>(useCase: UseCase<Input, void>): UseCase<Input, void> =>
    new TransactionalUseCase(useCase, unitOfWork);

  return new MatchIngestionController(
    transactional(new StartMatchUseCase(repository, publisher)),
    transactional(new FinishMatchUseCase(repository, publisher)),
    transactional(new RegisterMatchEventUseCase(repository, publisher)),
  );
}
