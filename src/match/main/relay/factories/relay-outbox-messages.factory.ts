import { snsClient } from '../../../../shared/infrastructure/aws/sns-client';
import { prisma } from '../../../../shared/infrastructure/prisma/prisma-client';
import { RelayOutboxMessagesUseCase } from '../../../application/use-cases/relay-outbox-messages.use-case';
import { SnsMatchEventPublisher } from '../../../infrastructure/publishers/sns-match-event.publisher';
import { PrismaOutboxRepository } from '../../../infrastructure/repositories/prisma-outbox.repository';

/**
 * Composition root do relay do outbox: lê do Postgres (via raw queries) e
 * publica no SNS. Fonte e destino são injetados como ports no caso de uso.
 */
export function makeRelayOutboxMessages(): RelayOutboxMessagesUseCase {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (topicArn === undefined || topicArn === '') {
    throw new Error('Variável de ambiente ausente: SNS_TOPIC_ARN');
  }

  const outbox = new PrismaOutboxRepository(prisma);
  const publisher = new SnsMatchEventPublisher(snsClient, { topicArn });
  return new RelayOutboxMessagesUseCase(outbox, publisher);
}
