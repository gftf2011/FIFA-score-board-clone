import type { SNSClient } from '@aws-sdk/client-sns';
import type { PrismaClient } from '@prisma/client';
import { FinishMatchUseCase } from '../../application/use-cases/finish-match.use-case.js';
import { RegisterMatchEventUseCase } from '../../application/use-cases/register-match-event.use-case.js';
import { StartMatchUseCase } from '../../application/use-cases/start-match.use-case.js';
import { SnsMatchEventPublisher } from '../../infrastructure/publishers/sns-match-event.publisher.js';
import { PrismaMatchRepository } from '../../infrastructure/repositories/prisma-match.repository.js';
import { MatchController } from '../../presentation/http/match.controller.js';

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

  return new MatchController(
    new StartMatchUseCase(repository, publisher),
    new FinishMatchUseCase(repository, publisher),
    new RegisterMatchEventUseCase(repository, publisher),
  );
}
