import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';
import type { OutboxRepository } from '../../domain/repositories/outbox.repository';

/**
 * Implementação do {@link MatchEventPublisher} que grava o evento no outbox
 * (transactional outbox) em vez de publicar direto no broker. Delega ao
 * {@link OutboxRepository}, cuja escrita participa da transação ambiente da
 * UnitOfWork — o evento é persistido **atomicamente** com o estado da partida,
 * eliminando o dual-write com o SNS.
 *
 * O relay ({@link file://src/main/outbox-relay.ts}) publica as mensagens no SNS.
 */
export class OutboxMatchEventPublisher implements MatchEventPublisher {
  constructor(private readonly outbox: OutboxRepository) {}

  async publish(event: MatchEvent): Promise<void> {
    await this.outbox.save(event);
  }
}
