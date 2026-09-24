import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';
import type { MatchProjectionRepository } from '../../domain/repositories/match-projection.repository';

/**
 * Consumidor dos eventos vindos da fila (SQS). Guarda o evento na linha do tempo
 * do read model (Redis) e o publica no pub/sub para os assinantes SSE.
 *
 * O estado derivado (status, placar) NÃO é materializado aqui: ele é
 * reconstruído da linha do tempo pelo reducer de projeção ({@link applyEvent})
 * na leitura. `appendEvent` é idempotente (membro único por `sequence`), então a
 * reentrega do SQS é segura.
 */
export class NotifyMatchEventConsumer {
  constructor(
    private readonly projection: MatchProjectionRepository,
    private readonly publisher: MatchEventPublisher,
  ) {}

  async handle(event: MatchEvent): Promise<void> {
    await this.projection.appendEvent(event);
    await this.publisher.publish(event);
  }
}
