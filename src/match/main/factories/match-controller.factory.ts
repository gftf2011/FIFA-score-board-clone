import type { SNSClient } from '@aws-sdk/client-sns';
import type { PrismaClient } from '@prisma/client';
import { TransactionalUseCase } from '../../../shared/application/transactional-use-case.decorator';
import type { UseCase } from '../../../shared/application/use-case';
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma/prisma-unit-of-work';
import { FinishMatchUseCase } from '../../application/use-cases/finish-match.use-case';
import { RegisterMatchEventUseCase } from '../../application/use-cases/register-match-event.use-case';
import { StartMatchUseCase } from '../../application/use-cases/start-match.use-case';
import { SnsMatchEventPublisher } from '../../infrastructure/publishers/sns-match-event.publisher';
import { PrismaMatchRepository } from '../../infrastructure/repositories/prisma-match.repository';
import { MatchController } from '../../presentation/http/match.controller';

/** Dependências externas necessárias para montar o módulo de partida. */
export interface MatchControllerDeps {
  readonly prisma: PrismaClient;
  readonly snsClient: SNSClient;
  readonly snsTopicArn: string;
}

/**
 * Composition root do módulo de partida: instancia a implementação concreta dos
 * ports (repositório Prisma, publisher SNS), injeta nos casos de uso e monta o
 * controller HTTP.
 */
export function makeMatchController(deps: MatchControllerDeps): MatchController {
  const repository = new PrismaMatchRepository(deps.prisma);
  const publisher = new SnsMatchEventPublisher(deps.snsClient, { topicArn: deps.snsTopicArn });
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
